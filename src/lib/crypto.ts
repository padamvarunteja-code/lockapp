// Client-side Web Crypto utilities for End-to-End message encryption and Vault media encryption
// Uses standard Web Crypto API (SubtleCrypto: AES-256-GCM, PBKDF2, SHA-256)

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// --- VAULT ENCRYPTION (AES-256-GCM with PBKDF2) ---

export async function deriveVaultKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const pinKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    pinKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptVaultFile(
  fileData: ArrayBuffer,
  pin: string
): Promise<{ encryptedBase64: string; iv: string; salt: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(pin, salt);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    fileData
  );

  return {
    encryptedBase64: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
  };
}

export async function decryptVaultFile(
  encryptedData: ArrayBuffer,
  pin: string,
  ivBase64: string,
  saltBase64: string
): Promise<ArrayBuffer> {
  const salt = new Uint8Array(base64ToBuffer(saltBase64));
  const iv = new Uint8Array(base64ToBuffer(ivBase64));
  const key = await deriveVaultKey(pin, salt);

  return window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encryptedData
  );
}

// --- E2E CHAT ENCRYPTION (AES-256-GCM) ---
//
// IMPORTANT HONESTY NOTE: this derives a per-message key from a channel label
// (`onlyus-e2e-channel-${conversationId}`) + random salt via PBKDF2. Because the
// server knows the conversationId, this provides transport + at-rest ciphertext
// opacity — NOT true end-to-end encryption against a malicious server. A proper
// upgrade path is X25519 ECDH per-device key exchange (e.g. Signal-style
// ratchet) with public-key pinning. Until then, do not represent this as
// server-blind E2E in user-facing copy.

// Derives a conversation-scoped shared key from conversation identifier and established secret
async function deriveConversationKey(
  conversationId: string,
  salt: Uint8Array,
  channelLabel = `onlyus-e2e-channel-${conversationId}`
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(channelLabel),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptChatMessage(
  plaintext: string,
  conversationId: string
): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveConversationKey(conversationId, salt);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    enc.encode(plaintext)
  );

  const payload = {
    v: 1,
    ct: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
  };

  return JSON.stringify(payload);
}

export async function decryptChatMessage(
  encryptedPayload: string,
  conversationId: string
): Promise<string> {
  try {
    const parsed = JSON.parse(encryptedPayload);
    if (!parsed.ct || !parsed.iv || !parsed.salt) {
      return encryptedPayload; // Fallback if plain
    }

    const salt = new Uint8Array(base64ToBuffer(parsed.salt));
    const iv = new Uint8Array(base64ToBuffer(parsed.iv));
    const ciphertext = base64ToBuffer(parsed.ct);

    // Try the current channel label first, then the legacy pre-rebrand label
    // so messages encrypted before the rename still decrypt.
    const labels = [
      `onlyus-e2e-channel-${conversationId}`,
      `aegis-e2e-channel-${conversationId}`,
    ];
    let lastErr: unknown = null;
    for (const label of labels) {
      try {
        const key = await deriveConversationKey(conversationId, salt, label);
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv,
          },
          key,
          ciphertext
        );
        const dec = new TextDecoder();
        return dec.decode(decryptedBuffer);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  } catch (err) {
    console.error('Failed to decrypt message:', err);
    return '[Encrypted message cannot be decrypted]';
  }
}
