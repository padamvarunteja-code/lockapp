import express from 'express';
import fs from 'node:fs';
import { db } from './db';
import { rateLimiter, requireAuth, type AuthenticatedRequest } from './middleware';

export const vaultRouter = express.Router();

// Brute-force protection for PIN setup/verify (10 attempts/min per IP+route).
const pinLimiter = rateLimiter(10, 60 * 1000);
const vaultReadLimiter = rateLimiter(60, 60 * 1000);

const PIN_RE = /^\d{4,8}$/;
const MAX_VAULT_BYTES = 25 * 1024 * 1024; // 25MB decoded cap per file
const ALLOWED_MIME: Record<string, string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm'],
};

function sanitizeFileName(name: string): string {
  // Strip path components, control chars; cap length. Stored value is
  // rendered in the UI so this also bounds stored-XSS payload size.
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 128) || 'file';
}

function isPlausibleBase64(s: string, maxChars: number): boolean {
  return (
    typeof s === 'string' &&
    s.length > 0 &&
    s.length <= maxChars &&
    /^[A-Za-z0-9+/=]+$/.test(s)
  );
}

// Setup or change Vault PIN
vaultRouter.post('/pin', requireAuth, pinLimiter, (req: AuthenticatedRequest, res) => {
  const { pin, currentPin } = req.body;
  const user = req.user!;

  if (!pin || typeof pin !== 'string' || !PIN_RE.test(pin)) {
    return res.status(400).json({ error: 'Vault PIN must be 4 to 8 digits' });
  }

  // If PIN already exists, verify current PIN
  if (user.vault_pin_hash) {
    if (!currentPin) {
      return res.status(400).json({ error: 'Current Vault PIN is required' });
    }
    const isCurrentValid = db.verifyPassword(currentPin, user.vault_pin_hash);
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Incorrect current Vault PIN' });
    }
  }

  const newPinHash = db.hashPassword(pin);
  db.updateVaultPin(user.id, newPinHash);

  return res.json({
    success: true,
    message: 'Vault PIN saved securely.',
  });
});

// Verify Vault PIN
vaultRouter.post('/pin/verify', requireAuth, pinLimiter, (req: AuthenticatedRequest, res) => {
  const { pin } = req.body;
  const user = req.user!;

  if (!user.vault_pin_hash) {
    return res.status(400).json({ error: 'No Vault PIN has been configured yet' });
  }

  if (typeof pin !== 'string' || !PIN_RE.test(pin)) {
    return res.status(401).json({ error: 'Incorrect Vault PIN' });
  }

  const isValid = db.verifyPassword(pin, user.vault_pin_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Incorrect Vault PIN' });
  }

  return res.json({ success: true, verified: true });
});

// Upload encrypted media into Private Vault
// Payload contains client-encrypted ciphertext (Base64) + IV + Salt + metadata
vaultRouter.post('/upload', requireAuth, vaultReadLimiter, (req: AuthenticatedRequest, res) => {
  const { fileName, mediaType, mimeType, fileSize, iv, salt, encryptedBase64 } = req.body;
  const userId = req.user!.id;

  if (!fileName || !mediaType || !mimeType || !iv || !salt || !encryptedBase64) {
    return res.status(400).json({ error: 'Missing required encrypted media payload' });
  }

  if (mediaType !== 'photo' && mediaType !== 'video') {
    return res.status(400).json({ error: 'Invalid mediaType. Must be photo or video.' });
  }

  if (typeof fileName !== 'string' || fileName.length > 256) {
    return res.status(400).json({ error: 'Invalid fileName' });
  }
  if (typeof mimeType !== 'string' || !ALLOWED_MIME[mediaType].includes(mimeType)) {
    return res.status(400).json({ error: 'Invalid mimeType for mediaType' });
  }
  if (!isPlausibleBase64(iv, 64) || !isPlausibleBase64(salt, 64)) {
    return res.status(400).json({ error: 'Invalid iv or salt encoding' });
  }
  if (typeof encryptedBase64 !== 'string' || encryptedBase64.length > 40 * 1024 * 1024) {
    return res.status(413).json({ error: 'Encrypted payload too large' });
  }

  try {
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
    if (encryptedBuffer.length === 0 || encryptedBuffer.length > MAX_VAULT_BYTES) {
      return res.status(413).json({ error: 'Decoded media exceeds 25MB limit' });
    }
    const cleanName = sanitizeFileName(fileName);
    const item = db.addVaultMedia(
      userId,
      cleanName,
      mediaType,
      mimeType,
      fileSize || encryptedBuffer.length,
      iv,
      salt,
      encryptedBuffer
    );

    return res.status(201).json({
      success: true,
      item,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save encrypted media to vault' });
  }
});

// List owner's encrypted media items
vaultRouter.get('/list', requireAuth, vaultReadLimiter, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const items = db.getVaultItems(userId);
  return res.json({ items });
});

// Retrieve raw encrypted ciphertext (Owner-only verified stream)
vaultRouter.get('/media/:id', requireAuth, vaultReadLimiter, (req: AuthenticatedRequest, res) => {
  const mediaId = req.params.id;
  const userId = req.user!.id;

  if (typeof mediaId !== 'string' || mediaId.length > 64) {
    return res.status(400).json({ error: 'Invalid media id' });
  }

  const result = db.getVaultMediaById(mediaId, userId);
  if (!result) {
    return res.status(404).json({ error: 'Vault media not found or unauthorized' });
  }

  const { item, filePath } = result;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Encrypted storage file is missing from disk.' });
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-Vault-IV, X-Vault-Salt, X-Vault-Mime, X-Vault-Type, X-Vault-Name'
  );
  res.setHeader('X-Vault-IV', item.iv);
  res.setHeader('X-Vault-Salt', item.salt);
  res.setHeader('X-Vault-Mime', item.mime_type);
  res.setHeader('X-Vault-Type', item.media_type);
  res.setHeader('X-Vault-Name', encodeURIComponent(item.file_name));

  const readStream = fs.createReadStream(filePath);
  readStream.on('error', (err) => {
    console.error('[Vault] Error streaming file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream encrypted file' });
    }
  });
  readStream.pipe(res);
});

// Delete media permanently
vaultRouter.delete('/media/:id', requireAuth, vaultReadLimiter, (req: AuthenticatedRequest, res) => {
  const mediaId = req.params.id;
  const userId = req.user!.id;

  if (typeof mediaId !== 'string' || mediaId.length > 64) {
    return res.status(400).json({ error: 'Invalid media id' });
  }

  const success = db.deleteVaultMedia(mediaId, userId);
  if (!success) {
    return res.status(404).json({ error: 'Vault media not found or unauthorized' });
  }

  return res.json({
    success: true,
    message: 'Encrypted media and storage file permanently deleted.',
  });
});
