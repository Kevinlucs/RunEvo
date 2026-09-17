/** Criptografia simétrica de tokens antes da persistência. A chave só existe
 * nas secrets das Edge Functions; o frontend nunca recebe o ciphertext. */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const V2_PREFIX = 'v2';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const encoded = Deno.env.get('INTEGRATION_ENCRYPTION_KEY');
  if (!encoded) throw new Error('INTEGRATION_ENCRYPTION_KEY ausente.');
  const raw = fromBase64(encoded);
  if (raw.byteLength !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY deve ter 32 bytes em Base64.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export type EncryptionContext = {
  /**
   * Liga o segredo ao dono e ao provedor. Um ciphertext copiado para outra
   * conta deixa de ser válido, mesmo que a chave principal seja a mesma.
   */
  associatedData?: string;
};

export async function encryptIntegrationToken(
  payload: unknown,
  context: EncryptionContext = {},
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const additionalData = context.associatedData
    ? encoder.encode(context.associatedData)
    : undefined;
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, ...(additionalData ? { additionalData } : {}) },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  const value = `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
  return context.associatedData ? `${V2_PREFIX}.${value}` : value;
}

export async function decryptIntegrationToken<T>(
  ciphertext: string,
  context: EncryptionContext = {},
): Promise<T> {
  const values = ciphertext.split('.');
  const isV2 = values[0] === V2_PREFIX;
  if (isV2 && !context.associatedData) {
    throw new Error('Contexto de criptografia ausente.');
  }
  if (!isV2 && context.associatedData) {
    throw new Error('Token sem vínculo criptográfico.');
  }
  const [ivEncoded, dataEncoded] = isV2 ? values.slice(1) : values;
  if (!ivEncoded || !dataEncoded) throw new Error('Token cifrado inválido.');
  const key = await encryptionKey();
  const additionalData = context.associatedData
    ? encoder.encode(context.associatedData)
    : undefined;
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(ivEncoded),
      ...(additionalData ? { additionalData } : {}),
    },
    key,
    fromBase64(dataEncoded),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}
