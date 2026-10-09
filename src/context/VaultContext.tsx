import React, { createContext, useContext, useState } from 'react';
import type { VaultItem } from '../types';
import { apiRequest, getStoredToken } from '../lib/api';
import { decryptVaultFile, encryptVaultFile } from '../lib/crypto';

interface VaultContextType {
  isUnlocked: boolean;
  pin: string | null;
  items: VaultItem[];
  loading: boolean;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => void;
  fetchVaultItems: () => Promise<void>;
  uploadMedia: (file: File) => Promise<void>;
  getDecryptedBlobUrl: (item: VaultItem) => Promise<string | null>;
  deleteMedia: (id: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [decryptedUrls, setDecryptedUrls] = useState<Map<string, string>>(new Map());

  const unlockVault = async (enteredPin: string): Promise<boolean> => {
    try {
      // 1. Verify against server pin verification endpoint
      await apiRequest('/api/vault/pin/verify', {
        method: 'POST',
        body: JSON.stringify({ pin: enteredPin }),
      });

      setPin(enteredPin);
      setIsUnlocked(true);
      await loadItems();
      return true;
    } catch {
      return false;
    }
  };

  const lockVault = () => {
    // Revoke all in-memory decrypted object URLs
    decryptedUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    setDecryptedUrls(new Map());
    setPin(null);
    setIsUnlocked(false);
    setItems([]);
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: VaultItem[] }>('/api/vault/list');
      setItems(data.items);
    } catch (err) {
      console.error('Failed to load vault items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVaultItems = async () => {
    if (isUnlocked) {
      await loadItems();
    }
  };

  const uploadMedia = async (file: File) => {
    if (!pin) throw new Error('Vault is locked');

    const mediaType: 'photo' | 'video' = file.type.startsWith('video/') ? 'video' : 'photo';
    const arrayBuffer = await file.arrayBuffer();

    // Client-side AES-256-GCM encryption
    const { encryptedBase64, iv, salt } = await encryptVaultFile(arrayBuffer, pin);

    await apiRequest('/api/vault/upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mediaType,
        mimeType: file.type,
        fileSize: file.size,
        iv,
        salt,
        encryptedBase64,
      }),
    });

    await loadItems();
  };

  const getDecryptedBlobUrl = async (item: VaultItem): Promise<string | null> => {
    if (!pin) return null;

    if (decryptedUrls.has(item.id)) {
      return decryptedUrls.get(item.id)!;
    }

    try {
      const token = getStoredToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`/api/vault/media/${item.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error(`Failed to fetch encrypted media (${response.status})`);

      const iv = response.headers.get('X-Vault-IV') || item.iv;
      const salt = response.headers.get('X-Vault-Salt') || item.salt;
      const mime = response.headers.get('X-Vault-Mime') || item.mime_type;

      const encryptedBuffer = await response.arrayBuffer();
      const decryptedBuffer = await decryptVaultFile(encryptedBuffer, pin, iv, salt);

      const blob = new Blob([decryptedBuffer], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      setDecryptedUrls((prev) => new Map(prev).set(item.id, blobUrl));
      return blobUrl;
    } catch (err) {
      console.error('Failed to decrypt vault media:', err);
      return null;
    }
  };

  const deleteMedia = async (id: string) => {
    await apiRequest(`/api/vault/media/${id}`, { method: 'DELETE' });

    if (decryptedUrls.has(id)) {
      URL.revokeObjectURL(decryptedUrls.get(id)!);
      const updated = new Map(decryptedUrls);
      updated.delete(id);
      setDecryptedUrls(updated);
    }

    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <VaultContext.Provider
      value={{
        isUnlocked,
        pin,
        items,
        loading,
        unlockVault,
        lockVault,
        fetchVaultItems,
        uploadMedia,
        getDecryptedBlobUrl,
        deleteMedia,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within a VaultProvider');
  return ctx;
}
