package main

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	return &Server{store: &Store{baseURL: "http://invalid.test", apiKey: "k", http: &http.Client{Timeout: 1 * time.Second}}, hmacSecret: "segredo-teste"}
}

func signedRequest(t *testing.T, secret, method, path, timestamp, nonce, userID, body string) *http.Request {
	t.Helper()
	request, err := http.NewRequest(method, "http://gateway.test"+path, strings.NewReader(body))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	canonical := strings.Join([]string{method, path, timestamp, nonce, userID, hashString(body)}, "\n")
	signature := hmacSHA256Hex([]byte(secret), []byte(canonical))
	request.Header.Set("X-RunEvo-Timestamp", timestamp)
	request.Header.Set("X-RunEvo-Nonce", nonce)
	request.Header.Set("X-RunEvo-User-Id", userID)
	request.Header.Set("X-RunEvo-Signature", signature)
	return request
}

func TestSignatureValidatesBeforeNonceStore(t *testing.T) {
	server := newTestServer(t)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	request := signedRequest(t, "segredo-teste", "POST", "/v1/workouts/send", timestamp, "nonce-1", "user-1", `{"ok":true}`)
	// A assinatura e validada antes do consumo do nonce (que precisa do Supabase).
	if _, _, err := server.verifyInternalRequest(request); err == nil || !strings.Contains(err.Error(), "nonce") {
		t.Fatalf("signature should validate, error should only come from nonce store: %v", err)
	}
}

func TestRejectsWrongSecret(t *testing.T) {
	server := newTestServer(t)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	request := signedRequest(t, "segredo-errado", "POST", "/v1/workouts/send", timestamp, "nonce-2", "user-1", `{"ok":true}`)
	_, _, err := server.verifyInternalRequest(request)
	if err == nil || !strings.Contains(err.Error(), "assinatura") {
		t.Fatalf("expected invalid signature, got: %v", err)
	}
}

func TestRejectsExpiredTimestamp(t *testing.T) {
	server := newTestServer(t)
	timestamp := strconv.FormatInt(time.Now().Add(-10*time.Minute).Unix(), 10)
	request := signedRequest(t, "segredo-teste", "POST", "/v1/workouts/send", timestamp, "nonce-3", "user-1", `{}`)
	_, _, err := server.verifyInternalRequest(request)
	if err == nil || !strings.Contains(err.Error(), "timestamp") {
		t.Fatalf("expected expired timestamp, got: %v", err)
	}
}

func TestRejectsFutureTimestamp(t *testing.T) {
	server := newTestServer(t)
	timestamp := strconv.FormatInt(time.Now().Add(5*time.Minute).Unix(), 10)
	request := signedRequest(t, "segredo-teste", "POST", "/v1/workouts/send", timestamp, "nonce-4", "user-1", `{}`)
	_, _, err := server.verifyInternalRequest(request)
	if err == nil {
		t.Fatal("expected future timestamp to be rejected")
	}
}

func TestRejectsMissingHeaders(t *testing.T) {
	server := newTestServer(t)
	request, err := http.NewRequest(http.MethodPost, "http://gateway.test/v1/workouts/send", nil)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if _, _, err := server.verifyInternalRequest(request); err == nil {
		t.Fatal("expected missing headers to be rejected")
	}
}

func TestConstantTimeEqual(t *testing.T) {
	if !constantTimeEqual("abc", "abc") {
		t.Fatal("equal strings must match")
	}
	if constantTimeEqual("abc", "abd") {
		t.Fatal("different strings must not match")
	}
	if constantTimeEqual("abc", "abcd") {
		t.Fatal("different lengths must not match")
	}
}
