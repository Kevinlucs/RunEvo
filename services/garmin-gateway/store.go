package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ndeloof/go-garmin/pkg/garmin"
)

type Store struct {
	baseURL string
	apiKey  string
	http    *http.Client
	key     []byte
}

type ConnectionAttempt struct {
	ID                     string     `json:"id"`
	UserID                 string     `json:"user_id"`
	StateHash              string     `json:"state_hash"`
	ExpiresAt              time.Time  `json:"expires_at"`
	ConsumedAt             *time.Time `json:"consumed_at"`
	MFAChallengeCiphertext string     `json:"mfa_challenge_ciphertext"`
	MFAAttempts            int        `json:"mfa_attempts"`
}

type storedAccount struct {
	TokenCiphertext string `json:"token_ciphertext"`
}

type ClaimResult struct {
	WorkoutSyncID     string  `json:"workout_sync_id"`
	Claimed           bool    `json:"claimed"`
	SyncStatus        string  `json:"sync_status"`
	ExternalWorkoutID *string `json:"external_workout_id"`
	Attempts          int     `json:"attempts"`
}

func (s *Store) request(ctx context.Context, method, path string, body any, prefer string, out any) error {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = strings.NewReader(string(encoded))
	}
	req, err := http.NewRequestWithContext(ctx, method, s.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("apikey", s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	if prefer != "" {
		req.Header.Set("Prefer", prefer)
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body); return fmt.Errorf("database request rejected: HTTP %d body=%s", resp.StatusCode, string(b))
	}
	if out != nil && resp.StatusCode != http.StatusNoContent {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil && err != io.EOF {
			return err
		}
	}
	return nil
}

func eq(value string) string { return url.QueryEscape("eq." + value) }

func (s *Store) consumeNonce(ctx context.Context, nonceHash string, expiresAt time.Time) error {
	return s.request(ctx, http.MethodPost, "/rest/v1/garmin_gateway_nonces", map[string]any{
		"nonce_hash": nonceHash, "expires_at": expiresAt.UTC().Format(time.RFC3339),
	}, "return=minimal", nil)
}

func (s *Store) createAttempt(ctx context.Context, userID, stateHash string) error {
	return s.request(ctx, http.MethodPost, "/rest/v1/garmin_connection_attempts", map[string]any{
		"user_id": userID, "state_hash": stateHash,
		"expires_at": time.Now().Add(15 * time.Minute).UTC().Format(time.RFC3339),
	}, "return=minimal", nil)
}

func (s *Store) activeAttempt(ctx context.Context, stateHash string) (*ConnectionAttempt, error) {
	var rows []ConnectionAttempt
	path := "/rest/v1/garmin_connection_attempts?state_hash=" + eq(stateHash) + "&consumed_at=is.null&select=id,user_id,state_hash,expires_at,consumed_at,mfa_challenge_ciphertext,mfa_attempts"
	if err := s.request(ctx, http.MethodGet, path, nil, "", &rows); err != nil {
		return nil, err
	}
	if len(rows) != 1 || time.Now().After(rows[0].ExpiresAt) {
		return nil, fmt.Errorf("attempt expired")
	}
	return &rows[0], nil
}

func (s *Store) saveMFAChallenge(ctx context.Context, attemptID, encrypted string) error {
	return s.request(ctx, http.MethodPatch, "/rest/v1/garmin_connection_attempts?id="+eq(attemptID), map[string]any{
		"mfa_challenge_ciphertext": encrypted,
		"mfa_attempts":             1,
	}, "return=minimal", nil)
}

func (s *Store) consumeAttempt(ctx context.Context, attemptID string) error {
	return s.request(ctx, http.MethodPatch, "/rest/v1/garmin_connection_attempts?id="+eq(attemptID), map[string]any{
		"consumed_at": time.Now().UTC().Format(time.RFC3339), "mfa_challenge_ciphertext": nil,
	}, "return=minimal", nil)
}

func (s *Store) saveCredentials(ctx context.Context, userID, providerUserID string, creds *garmin.Credentials) error {
	ciphertext, err := encryptJSON(s.key, creds, userID)
	if err != nil {
		return err
	}
	return s.request(ctx, http.MethodPost, "/rest/v1/connected_accounts?on_conflict=user_id,provider", map[string]any{
		"user_id": userID, "provider": "garmin", "provider_user_id": providerUserID,
		"status": "connected", "token_ciphertext": "gateway.v1." + ciphertext,
		"connected_at": time.Now().UTC().Format(time.RFC3339), "last_error": nil,
	}, "resolution=merge-duplicates,return=minimal", nil)
}

func (s *Store) rotateCredentials(ctx context.Context, userID string, creds *garmin.Credentials) error {
	ciphertext, err := encryptJSON(s.key, creds, userID)
	if err != nil {
		return err
	}
	return s.request(ctx, http.MethodPatch, "/rest/v1/connected_accounts?user_id="+eq(userID)+"&provider=eq.garmin", map[string]any{
		"token_ciphertext": "gateway.v1." + ciphertext,
		"last_error":       nil,
	}, "return=minimal", nil)
}
func (s *Store) loadCredentials(ctx context.Context, userID string) (*garmin.Credentials, error) {
	var rows []storedAccount
	path := "/rest/v1/connected_accounts?user_id=" + eq(userID) + "&provider=eq.garmin&status=eq.connected&select=token_ciphertext"
	if err := s.request(ctx, http.MethodGet, path, nil, "", &rows); err != nil {
		return nil, err
	}
	if len(rows) != 1 || !strings.HasPrefix(rows[0].TokenCiphertext, "gateway.v1.") {
		return nil, fmt.Errorf("credentials unavailable")
	}
	var creds garmin.Credentials
	if err := decryptJSON(s.key, strings.TrimPrefix(rows[0].TokenCiphertext, "gateway.v1."), userID, &creds); err != nil {
		return nil, err
	}
	return &creds, nil
}

func (s *Store) clearConnection(ctx context.Context, userID string) error {
	return s.request(ctx, http.MethodPatch, "/rest/v1/connected_accounts?user_id="+eq(userID)+"&provider=eq.garmin", map[string]any{
		"status": "disconnected", "token_ciphertext": nil, "token_expires_at": nil,
		"provider_user_id": nil, "connected_at": nil, "last_sync_at": nil, "last_error": nil,
	}, "return=minimal", nil)
}

func (s *Store) syncDevices(ctx context.Context, userID string, devices []garmin.Device) error {
	if err := s.request(ctx, http.MethodPatch, "/rest/v1/garmin_devices?user_id="+eq(userID), map[string]any{"status": "removed"}, "return=minimal", nil); err != nil {
		return err
	}
	if len(devices) == 0 {
		return nil
	}
	rows := make([]map[string]any, 0, len(devices))
	for _, device := range devices {
		rows = append(rows, map[string]any{
			"user_id": userID, "external_device_id": fmt.Sprintf("%d", device.DeviceID),
			"device_name": func() string { if device.ProductDisplayName != "" { return device.ProductDisplayName }; if device.Model != "" { return device.Model }; return fmt.Sprintf("Garmin %d", device.DeviceID) }(), "device_type": device.Model, "status": "active",
			"last_sync_at": time.Now().UTC().Format(time.RFC3339),
		})
	}
	return s.request(ctx, http.MethodPost, "/rest/v1/garmin_devices?on_conflict=user_id,external_device_id", rows, "resolution=merge-duplicates,return=minimal", nil)
}

func (s *Store) claimWorkout(ctx context.Context, userID, workoutID, scheduledDate, idempotencyKey string) (*ClaimResult, error) {
	var rows []ClaimResult
	if err := s.request(ctx, http.MethodPost, "/rest/v1/rpc/claim_garmin_workout_sync", map[string]any{
		"p_user_id": userID, "p_planned_workout_id": workoutID,
		"p_scheduled_date": scheduledDate, "p_idempotency_key": idempotencyKey,
	}, "", &rows); err != nil {
		return nil, err
	}
	if len(rows) != 1 {
		return nil, fmt.Errorf("invalid claim response")
	}
	return &rows[0], nil
}

func (s *Store) recordExternalWorkoutID(ctx context.Context, syncID string, externalID int64) error {
	return s.request(ctx, http.MethodPatch, "/rest/v1/external_workouts?id="+eq(syncID), map[string]any{
		"external_workout_id": fmt.Sprintf("%d", externalID),
	}, "return=minimal", nil)
}
func (s *Store) finishWorkout(ctx context.Context, syncID, status string, externalID *int64, message *string) error {
	payload := map[string]any{"sync_status": status, "last_error": message, "processing_started_at": nil}
	if status == "success" {
		payload["synced_at"] = time.Now().UTC().Format(time.RFC3339)
	}
	if externalID != nil {
		payload["external_workout_id"] = fmt.Sprintf("%d", *externalID)
	}
	return s.request(ctx, http.MethodPatch, "/rest/v1/external_workouts?id="+eq(syncID), payload, "return=minimal", nil)
}

type GarminTokenStore struct {
	store  *Store
	userID string
	locks  *UserLocks
}

func (t *GarminTokenStore) Load(ctx context.Context) (*garmin.Credentials, error) {
	return t.store.loadCredentials(ctx, t.userID)
}
func (t *GarminTokenStore) Save(ctx context.Context, creds *garmin.Credentials) error {
	return t.store.rotateCredentials(ctx, t.userID, creds)
}
func (t *GarminTokenStore) Lock(ctx context.Context) (func(), error) {
	return t.locks.Lock(ctx, t.userID)
}
