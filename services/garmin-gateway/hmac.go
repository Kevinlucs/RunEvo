package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const maxRequestAge = 5 * time.Minute

func hashBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func hashString(value string) string { return hashBytes([]byte(value)) }

func (s *Server) verifyInternalRequest(r *http.Request) (userID string, body []byte, err error) {
	if r.Body != nil {
		body, err = io.ReadAll(io.LimitReader(r.Body, 256*1024))
		if err != nil {
			return "", nil, fmt.Errorf("read request: %w", err)
		}
	} else {
		body = []byte{}
	}

	timestamp := r.Header.Get("X-RunEvo-Timestamp")
	nonce := r.Header.Get("X-RunEvo-Nonce")
	userID = r.Header.Get("X-RunEvo-User-Id")
	signature := r.Header.Get("X-RunEvo-Signature")
	if timestamp == "" || nonce == "" || userID == "" || signature == "" {
		return "", nil, fmt.Errorf("cabeçalhos internos ausentes")
	}
	ts, parseErr := strconv.ParseInt(timestamp, 10, 64)
	if parseErr != nil {
		return "", nil, fmt.Errorf("timestamp inválido")
	}
	requestTime := time.Unix(ts, 0)
	if time.Since(requestTime) > maxRequestAge || requestTime.After(time.Now().Add(time.Minute)) {
		return "", nil, fmt.Errorf("timestamp expirado")
	}

	expected := s.sign(r.Method, r.URL.Path, timestamp, nonce, userID, hashBytes(body))
	if !constantTimeEqual(signature, expected) {
		return "", nil, fmt.Errorf("assinatura inválida")
	}
	if err := s.store.consumeNonce(r.Context(), hashString(nonce), time.Now().Add(maxRequestAge)); err != nil {
		return "", nil, fmt.Errorf("nonce rejeitado: %w", err)
	}
	return userID, body, nil
}

func (s *Server) sign(method, path, timestamp, nonce, userID, bodyHash string) string {
	canonical := strings.Join([]string{method, path, timestamp, nonce, userID, bodyHash}, "\n")
	return hmacSHA256Hex([]byte(s.hmacSecret), []byte(canonical))
}

func constantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var diff byte
	for i := 0; i < len(a); i++ {
		diff |= a[i] ^ b[i]
	}
	return diff == 0
}

func hmacSHA256Hex(key, value []byte) string {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(value)
	return hex.EncodeToString(mac.Sum(nil))
}
