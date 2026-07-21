import * as Crypto from 'expo-crypto';

/** UUID v4 válido gerado no cliente (nunca IDs textuais em colunas UUID). */
export function newUuid(): string {
  return Crypto.randomUUID();
}
