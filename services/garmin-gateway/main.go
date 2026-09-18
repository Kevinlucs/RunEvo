package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ndeloof/go-garmin/pkg/garmin"
)

const (
	defaultPort        = "8080"
	defaultAppDeepLink = "runevo://profile/watches/garmin?garmin=connected"
)

var logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

type Server struct {
	store       *Store
	hmacSecret  string
	publicURL   string
	appDeepLink string
	locks       *UserLocks
}

type UserLocks struct{ values sync.Map }

func (locks *UserLocks) Lock(ctx context.Context, userID string) (func(), error) {
	// O gateway deve rodar com uma réplica. Este lock impede dois refreshes
	// concorrentes da mesma conta no processo, preservando o refresh token rotativo.
	_ = ctx
	value, _ := locks.values.LoadOrStore(userID, &sync.Mutex{})
	mutex := value.(*sync.Mutex)
	mutex.Lock()
	return mutex.Unlock, nil
}

type connectStartResponse struct {
	ConnectURL string `json:"connectUrl"`
}
type gatewayReply struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}
type gatewaySendRequest struct {
	Workout       json.RawMessage `json:"workout"`
	ScheduledDate string          `json:"scheduledDate"`
}
type gatewaySendResponse struct {
	Success         bool    `json:"success"`
	GarminWorkoutID *string `json:"garminWorkoutId"`
	Status          string  `json:"status"`
	Error           *string `json:"error"`
}

type templateData struct {
	State  string
	Error  string
	Method string
}

func newServer() (*Server, error) {
	supabaseURL := strings.TrimSuffix(os.Getenv("SUPABASE_URL"), "/")
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	hmacSecret := os.Getenv("WATCH_GATEWAY_HMAC_SECRET")
	tokenKeyText := os.Getenv("GARMIN_TOKEN_ENCRYPTION_KEY")
	publicURL := strings.TrimSuffix(os.Getenv("PUBLIC_BASE_URL"), "/")
	if !strings.HasPrefix(publicURL, "http://") && !strings.HasPrefix(publicURL, "https://") {
		publicURL = "https://" + publicURL
	}
	if supabaseURL == "" || serviceKey == "" || hmacSecret == "" || tokenKeyText == "" || publicURL == "" {
		return nil, errors.New("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WATCH_GATEWAY_HMAC_SECRET, GARMIN_TOKEN_ENCRYPTION_KEY e PUBLIC_BASE_URL são obrigatórios")
	}
	key, err := base64.StdEncoding.DecodeString(tokenKeyText)
	if err != nil || len(key) != 32 {
		return nil, errors.New("GARMIN_TOKEN_ENCRYPTION_KEY deve ser Base64 de 32 bytes")
	}
	appDeepLink := os.Getenv("APP_DEEP_LINK_URL")
	if appDeepLink == "" {
		appDeepLink = defaultAppDeepLink
	}
	return &Server{
		store:      &Store{baseURL: supabaseURL, apiKey: serviceKey, http: &http.Client{Timeout: 12 * time.Second}, key: key},
		hmacSecret: hmacSecret, publicURL: publicURL, appDeepLink: appDeepLink, locks: &UserLocks{},
	}, nil
}

func randomState() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func writeJSON(w http.ResponseWriter, status int, body gatewayReply) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, gatewayReply{OK: true, Data: map[string]string{"status": "ok"}})
}

func (s *Server) handleConnectStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, gatewayReply{OK: false, Error: "method_not_allowed"})
		return
	}
	userID, _, err := s.verifyInternalRequest(r)
	if err != nil {
		writeJSON(w, 401, gatewayReply{OK: false, Error: "unauthorized"})
		return
	}
	state, err := randomState()
	if err != nil {
		writeJSON(w, 500, gatewayReply{OK: false, Error: "internal_error"})
		return
	}
	if err := s.store.createAttempt(r.Context(), userID, hashString(state)); err != nil {
		logger.Error("garmin connect attempt failed", "error", err)
		writeJSON(w, 503, gatewayReply{OK: false, Error: "gateway_unavailable"})
		return
	}
	connectURL := s.publicURL + "/v1/connect?state=" + url.QueryEscape(state)
	writeJSON(w, 200, gatewayReply{OK: true, Data: connectStartResponse{ConnectURL: connectURL}})
}

func (s *Server) handleConnectPage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "", 405)
		return
	}
	state := r.URL.Query().Get("state")
	if state == "" {
		s.renderLogin(w, templateData{Error: "A conexão expirou. Volte ao RunEvo e tente novamente."})
		return
	}
	if _, err := s.store.activeAttempt(r.Context(), hashString(state)); err != nil {
		s.renderLogin(w, templateData{Error: "A conexão expirou. Volte ao RunEvo e tente novamente."})
		return
	}
	s.renderLogin(w, templateData{State: state})
}

func (s *Server) handleConnectComplete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "", 405)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "", 400)
		return
	}
	state, email, password := r.Form.Get("state"), r.Form.Get("email"), r.Form.Get("password")
	attempt, err := s.store.activeAttempt(r.Context(), hashString(state))
	if err != nil {
		s.renderLogin(w, templateData{Error: "A conexão expirou. Volte ao RunEvo e tente novamente."})
		return
	}
	if email == "" || password == "" {
		s.renderLogin(w, templateData{State: state, Error: "Informe e-mail e senha."})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	creds, challenge, err := garmin.Login(ctx, email, password)
	if err != nil {
		logger.Warn("garmin login rejected", "kind", garminErrorKind(err))
		s.renderLogin(w, templateData{State: state, Error: loginMessage(err)})
		return
	}
	if challenge != nil {
		encrypted, err := encryptJSON(s.store.key, challenge, attempt.StateHash)
		if err != nil || s.store.saveMFAChallenge(ctx, attempt.ID, encrypted) != nil {
			s.renderLogin(w, templateData{State: state, Error: "Não foi possível iniciar a verificação em duas etapas."})
			return
		}
		http.Redirect(w, r, "/v1/connect/mfa?state="+url.QueryEscape(state), http.StatusSeeOther)
		return
	}
	s.finishConnection(w, r, attempt, creds)
}

func (s *Server) handleMFAPage(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	attempt, err := s.store.activeAttempt(r.Context(), hashString(state))
	if err != nil || attempt.MFAChallengeCiphertext == "" {
		s.renderLogin(w, templateData{Error: "A verificação expirou. Volte ao RunEvo e tente novamente."})
		return
	}
	s.renderMFA(w, templateData{State: state, Method: "código de verificação"})
}

func (s *Server) handleMFAComplete(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "", 400)
		return
	}
	state, code := r.Form.Get("state"), r.Form.Get("code")
	attempt, err := s.store.activeAttempt(r.Context(), hashString(state))
	if err != nil || attempt.MFAChallengeCiphertext == "" {
		s.renderLogin(w, templateData{Error: "A verificação expirou. Volte ao RunEvo e tente novamente."})
		return
	}
	if code == "" {
		s.renderMFA(w, templateData{State: state, Error: "Informe o código recebido."})
		return
	}
	var challenge garmin.MFAChallenge
	if err := decryptJSON(s.store.key, attempt.MFAChallengeCiphertext, attempt.StateHash, &challenge); err != nil {
		s.renderLogin(w, templateData{Error: "A verificação expirou. Volte ao RunEvo e tente novamente."})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	creds, err := garmin.ResumeMFA(ctx, &challenge, code)
	if err != nil {
		logger.Warn("garmin mfa rejected", "kind", garminErrorKind(err))
		s.renderMFA(w, templateData{State: state, Error: loginMessage(err)})
		return
	}
	s.finishConnection(w, r, attempt, creds)
}

func (s *Server) finishConnection(w http.ResponseWriter, r *http.Request, attempt *ConnectionAttempt, creds *garmin.Credentials) {
	ctx, cancel := context.WithTimeout(r.Context(), 50*time.Second)
	defer cancel()
	client := garmin.NewClient(creds, garmin.WithHTTPClient(&http.Client{Timeout: 30 * time.Second}), garmin.WithRetry(3, 500*time.Millisecond))
	displayName, err := client.DisplayName(ctx)
	if err != nil {
		logger.Warn("garmin profile unavailable", "kind", garminErrorKind(err))
		displayName = ""
	}
	if err := s.store.saveCredentials(ctx, attempt.UserID, displayName, creds); err != nil {
		logger.Error("garmin credential save failed", "error", err)
		s.renderLogin(w, templateData{Error: "Não foi possível concluir a conexão. Tente novamente."})
		return
	}
	if devices, err := client.Devices.List(ctx); err == nil {
		if err := s.store.syncDevices(ctx, attempt.UserID, devices); err != nil {
			logger.Warn("garmin device sync failed", "error", err)
		}
	} else {
		logger.Warn("garmin devices unavailable", "kind", garminErrorKind(err))
	}
	_ = s.store.consumeAttempt(ctx, attempt.ID)
	http.Redirect(w, r, s.appDeepLink, http.StatusSeeOther)
}

func (s *Server) handleWorkoutSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, gatewayReply{OK: false, Error: "method_not_allowed"})
		return
	}
	userID, body, err := s.verifyInternalRequest(r)
	if err != nil {
		writeJSON(w, 401, gatewayReply{OK: false, Error: "unauthorized"})
		return
	}
	var request gatewaySendRequest
	if err := json.Unmarshal(body, &request); err != nil {
		writeJSON(w, 400, gatewayReply{OK: false, Error: "invalid_request"})
		return
	}
	workoutInput, err := decodeWorkout(request.Workout)
	if err != nil || !validDate(request.ScheduledDate) {
		writeJSON(w, 400, gatewayReply{OK: false, Error: "invalid_workout"})
		return
	}
	key := hashString(userID + ":" + workoutInput.ID + ":" + request.ScheduledDate + ":garmin")
	claim, err := s.store.claimWorkout(r.Context(), userID, workoutInput.ID, request.ScheduledDate, key)
	if err != nil {
		logger.Error("garmin claim failed", "error", err)
		writeJSON(w, 503, gatewayReply{OK: false, Error: "gateway_unavailable"})
		return
	}
	if !claim.Claimed {
		if claim.SyncStatus == "success" {
			writeJSON(w, 200, gatewayReply{OK: true, Data: gatewaySendResponse{Success: true, GarminWorkoutID: claim.ExternalWorkoutID, Status: "success"}})
			return
		}
		writeJSON(w, 202, gatewayReply{OK: true, Data: gatewaySendResponse{Success: false, GarminWorkoutID: claim.ExternalWorkoutID, Status: claim.SyncStatus}})
		return
	}
	response := s.sendWorkout(r.Context(), userID, request.ScheduledDate, workoutInput, claim)
	writeJSON(w, responseStatus(response), gatewayReply{OK: response.Success, Data: response, Error: responseError(response)})
}

func (s *Server) sendWorkout(ctx context.Context, userID, date string, input RunEvoWorkout, claim *ClaimResult) gatewaySendResponse {
	failure := func(message string, externalID *int64) gatewaySendResponse {
		_ = s.store.finishWorkout(ctx, claim.WorkoutSyncID, "failed", externalID, &message)
		return gatewaySendResponse{Success: false, Status: "failed", Error: &message}
	}
	store := &GarminTokenStore{store: s.store, userID: userID, locks: s.locks}
	client, err := garmin.NewClientFromStore(ctx, store, garmin.WithHTTPClient(&http.Client{Timeout: 30 * time.Second}), garmin.WithRetry(3, 500*time.Millisecond))
	if err != nil {
		return failure("Sua conexão Garmin precisa ser refeita.", nil)
	}

	var workoutID int64
	if claim.ExternalWorkoutID != nil && *claim.ExternalWorkoutID != "" {
		workoutID, err = strconv.ParseInt(*claim.ExternalWorkoutID, 10, 64)
		if err != nil || workoutID <= 0 {
			return failure("Não foi possível retomar este envio com segurança.", nil)
		}
	} else {
		workout, err := mapRunEvoWorkout(input)
		if err != nil {
			return failure("Este treino não tem uma estrutura compatível para envio.", nil)
		}
		created, err := client.Workouts.CreateTyped(ctx, workout)
		if err != nil {
			return failure(sendMessage(err), nil)
		}
		workoutID = created.WorkoutID
		if err := s.store.recordExternalWorkoutID(ctx, claim.WorkoutSyncID, workoutID); err != nil {
			// Não tentamos criar novamente: não há idempotência remota garantida.
			return failure("O Garmin recebeu o treino, mas a confirmação falhou. Tente novamente mais tarde.", &workoutID)
		}
	}

	if _, err := client.Workouts.Schedule(ctx, workoutID, mustDate(date)); err != nil {
		return failure(sendMessage(err), &workoutID)
	}
	devices, err := client.Devices.List(ctx)
	if err != nil {
		return failure(sendMessage(err), &workoutID)
	}
	if err := s.store.syncDevices(ctx, userID, devices); err != nil {
		logger.Warn("garmin device sync failed", "error", err)
	}
	eligible, pushed := 0, 0
	for _, device := range devices {
		if !device.PrimaryTrainingCapable {
			continue
		}
		eligible++
		if _, err := client.Workouts.PushToDevice(ctx, workoutID, device.DeviceID); err == nil {
			pushed++
		} else {
			logger.Warn("garmin device push failed", "device", device.DeviceID, "kind", garminErrorKind(err))
		}
	}
	if eligible == 0 {
		return failure("Nenhum relógio Garmin compatível está disponível para receber o treino.", &workoutID)
	}
	if pushed == 0 {
		return failure("O Garmin não confirmou o envio para o relógio.", &workoutID)
	}
	if err := s.store.finishWorkout(ctx, claim.WorkoutSyncID, "success", &workoutID, nil); err != nil {
		return failure("O relógio recebeu o treino, mas a confirmação local falhou.", &workoutID)
	}
	id := fmt.Sprintf("%d", workoutID)
	return gatewaySendResponse{Success: true, GarminWorkoutID: &id, Status: "success"}
}
func (s *Server) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, gatewayReply{OK: false, Error: "method_not_allowed"})
		return
	}
	userID, _, err := s.verifyInternalRequest(r)
	if err != nil {
		writeJSON(w, 401, gatewayReply{OK: false, Error: "unauthorized"})
		return
	}
	if err := s.store.clearConnection(r.Context(), userID); err != nil {
		writeJSON(w, 503, gatewayReply{OK: false, Error: "gateway_unavailable"})
		return
	}
	writeJSON(w, 200, gatewayReply{OK: true, Data: map[string]bool{"disconnected": true}})
}

func validDate(value string) bool       { _, err := time.Parse("2006-01-02", value); return err == nil }
func mustDate(value string) garmin.Date { date, _ := garmin.ParseDate(value); return date }
func responseStatus(response gatewaySendResponse) int {
	if response.Success {
		return 200
	}
	return 422
}
func responseError(response gatewaySendResponse) string {
	if response.Error == nil {
		return ""
	}
	return *response.Error
}
func garminErrorKind(err error) string {
	if errors.Is(err, garmin.ErrRateLimited) {
		return "rate_limited"
	}
	if errors.Is(err, garmin.ErrInvalidCredentials) {
		return "invalid_credentials"
	}
	if errors.Is(err, garmin.ErrUnauthorized) {
		return "unauthorized"
	}
	return "request_failed"
}
func loginMessage(err error) string {
	if errors.Is(err, garmin.ErrInvalidCredentials) {
		return "E-mail, senha ou código inválido."
	}
	if errors.Is(err, garmin.ErrRateLimited) {
		return "O Garmin limitou tentativas temporariamente. Aguarde alguns minutos."
	}
	return "Não foi possível conectar agora. Tente novamente mais tarde."
}
func sendMessage(err error) string {
	if errors.Is(err, garmin.ErrRateLimited) {
		return "O Garmin limitou temporariamente as solicitações. Aguarde alguns minutos."
	}
	if errors.Is(err, garmin.ErrUnauthorized) {
		return "Sua conexão Garmin precisa ser refeita."
	}
	return "Não foi possível enviar o treino para o Garmin."
}

func main() {
	server, err := newServer()
	if err != nil {
		logger.Error("gateway configuration invalid", "error", err)
		os.Exit(1)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", server.handleHealth)
	mux.HandleFunc("/v1/connect/start", server.handleConnectStart)
	mux.HandleFunc("/v1/connect", server.handleConnectPage)
	mux.HandleFunc("/v1/connect/complete", server.handleConnectComplete)
	mux.HandleFunc("/v1/connect/mfa", server.handleMFAPage)
	mux.HandleFunc("/v1/connect/mfa/complete", server.handleMFAComplete)
	mux.HandleFunc("/v1/workouts/send", server.handleWorkoutSend)
	mux.HandleFunc("/v1/disconnect", server.handleDisconnect)
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	logger.Info("garmin gateway started", "port", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		logger.Error("gateway stopped", "error", err)
		os.Exit(1)
	}
}

var loginTemplate = template.Must(template.New("login").Parse(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conectar Garmin | RunEvo</title><style>body{margin:0;background:#080909;color:#f4f4f0;font:16px Arial;display:grid;min-height:100vh;place-items:center}.card{width:min(410px,calc(100% - 40px));background:#171918;border:1px solid #303530;border-radius:18px;padding:28px;box-sizing:border-box}h1{margin:0 0 10px}p{color:#b8bdb7;line-height:1.5}label{display:block;margin:17px 0 7px}input{width:100%;box-sizing:border-box;border:1px solid #434a42;border-radius:10px;padding:13px;background:#0d0f0d;color:white;font-size:16px}button{width:100%;border:0;border-radius:999px;background:#d0ff00;padding:15px;margin-top:24px;font-weight:bold;font-size:16px;color:#101300}.err{background:#402323;color:#ffc7c7;border-radius:8px;padding:10px}</style></head><body><main class="card"><h1>Conectar Garmin</h1><p>Informe suas credenciais diretamente nesta página segura do RunEvo. Elas não são enviadas ao aplicativo.</p>{{if .Error}}<p class="err">{{.Error}}</p>{{end}}<form method="post" action="/v1/connect/complete"><input type="hidden" name="state" value="{{.State}}"><label for="email">E-mail Garmin Connect</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Continuar</button></form></main></body></html>`))
var mfaTemplate = template.Must(template.New("mfa").Parse(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verificação Garmin | RunEvo</title><style>body{margin:0;background:#080909;color:#f4f4f0;font:16px Arial;display:grid;min-height:100vh;place-items:center}.card{width:min(410px,calc(100% - 40px));background:#171918;border:1px solid #303530;border-radius:18px;padding:28px;box-sizing:border-box}p{color:#b8bdb7;line-height:1.5}input{width:100%;box-sizing:border-box;border:1px solid #434a42;border-radius:10px;padding:13px;background:#0d0f0d;color:white;font-size:16px}button{width:100%;border:0;border-radius:999px;background:#d0ff00;padding:15px;margin-top:24px;font-weight:bold;font-size:16px;color:#101300}.err{background:#402323;color:#ffc7c7;border-radius:8px;padding:10px}</style></head><body><main class="card"><h1>Verificação em duas etapas</h1><p>Informe o {{.Method}} enviado pelo Garmin.</p>{{if .Error}}<p class="err">{{.Error}}</p>{{end}}<form method="post" action="/v1/connect/mfa/complete"><input type="hidden" name="state" value="{{.State}}"><input name="code" inputmode="numeric" autocomplete="one-time-code" required><button type="submit">Confirmar</button></form></main></body></html>`))

func (s *Server) renderLogin(w http.ResponseWriter, data templateData) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = loginTemplate.Execute(w, data)
}
func (s *Server) renderMFA(w http.ResponseWriter, data templateData) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = mfaTemplate.Execute(w, data)
}
