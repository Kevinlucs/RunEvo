package main

import (
	"bytes"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	encoded, err := encryptJSON(key, map[string]string{"di_token": "tok"}, "user-9")
	if err != nil {
		t.Fatalf("encryptJSON: %v", err)
	}
	var out map[string]string
	if err := decryptJSON(key, encoded, "user-9", &out); err != nil {
		t.Fatalf("decryptJSON: %v", err)
	}
	if out["di_token"] != "tok" {
		t.Fatalf("round trip: %v", out)
	}
}

func TestDecryptFailsWithWrongAssociatedData(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	encoded, err := encryptJSON(key, map[string]string{"x": "y"}, "user-9")
	if err != nil {
		t.Fatalf("encryptJSON: %v", err)
	}
	var out map[string]string
	if err := decryptJSON(key, encoded, "user-8", &out); err == nil {
		t.Fatal("ciphertext copied to another user must not decrypt")
	}
}

func TestDecryptRejectsShortCiphertext(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	var out any
	if err := decryptJSON(key, "AAAA", "user-9", &out); err == nil {
		t.Fatal("short ciphertext must be rejected")
	}
}
