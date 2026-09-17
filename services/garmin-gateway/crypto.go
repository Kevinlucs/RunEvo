package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
)

func encryptJSON(key []byte, value any, associatedData string) (string, error) {
	plaintext, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, plaintext, []byte(associatedData))
	return base64.RawStdEncoding.EncodeToString(append(nonce, ciphertext...)), nil
}

func decryptJSON(key []byte, encoded string, associatedData string, target any) error {
	payload, err := base64.RawStdEncoding.DecodeString(encoded)
	if err != nil {
		return fmt.Errorf("decode ciphertext: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	if len(payload) < gcm.NonceSize() {
		return fmt.Errorf("ciphertext inválido")
	}
	plaintext, err := gcm.Open(nil, payload[:gcm.NonceSize()], payload[gcm.NonceSize():], []byte(associatedData))
	if err != nil {
		return fmt.Errorf("decrypt ciphertext: %w", err)
	}
	return json.Unmarshal(plaintext, target)
}
