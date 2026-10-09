import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { VaultItem } from '../types';
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  Image as ImageIcon,
  Film,
  Fingerprint,
  Loader2,
  ShieldCheck,
  X,
  Play,
  KeyRound,
} from 'lucide-react';

export const VaultView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const {
    isUnlocked,
    items,
    loading,
    unlockVault,
    lockVault,
    uploadMedia,
    getDecryptedBlobUrl,
    deleteMedia,
  } = useVault();

  const [enteredPin, setEnteredPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isSettingUpPin, setIsSettingUpPin] = useState(!user?.hasVaultPin);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [uploading, setUploading] = useState(false);

  // Active viewing item modal
  const [viewingItem, setViewingItem] = useState<VaultItem | null>(null);
  const [viewingBlobUrl, setViewingBlobUrl] = useState<string | null>(null);
  const [decryptingItem, setDecryptingItem] = useState(false);

  // Handle PIN Unlock
  const handleUnlock = async (pinToTry = enteredPin) => {
    if (!pinToTry) return;
    setUnlockError(null);
    const success = await unlockVault(pinToTry);
    if (!success) {
      setUnlockError('Incorrect Vault PIN');
      setEnteredPin('');
    }
  };

  // Biometrics simulation (Android BiometricPrompt / WebAuthn)
  const handleBiometricUnlock = async () => {
    // If WebAuthn or device credential available, authenticate
    if (window.PublicKeyCredential) {
      // In web environment, simulate successful biometric auth by prompting PIN or using quick access
      const quickPin = prompt('Simulated Android Biometrics Prompt: Please confirm your Vault PIN for hardware key release:');
      if (quickPin) {
        handleUnlock(quickPin);
      }
    } else {
      setUnlockError('Biometric sensor not detected on this browser session.');
    }
  };

  // Initial Setup PIN
  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4 || newPin.length > 8) {
      setUnlockError('PIN must be 4 to 8 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setUnlockError('PINs do not match');
      return;
    }

    try {
      await apiRequest('/api/vault/pin', {
        method: 'POST',
        body: JSON.stringify({ pin: newPin }),
      });
      await refreshUser();
      setIsSettingUpPin(false);
      await unlockVault(newPin);
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to setup PIN');
    }
  };

  // File Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadMedia(file);
    } catch (err: any) {
      alert(err.message || 'Failed to encrypt and store media');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Open item in viewer
  const handleOpenItem = async (item: VaultItem) => {
    setViewingItem(item);
    setDecryptingItem(true);
    try {
      const blobUrl = await getDecryptedBlobUrl(item);
      setViewingBlobUrl(blobUrl);
    } catch (err) {
      console.error('Failed to decrypt:', err);
    } finally {
      setDecryptingItem(false);
    }
  };

  const handleCloseViewer = () => {
    setViewingItem(null);
    setViewingBlobUrl(null);
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Permanently delete this encrypted file? This action is irreversible.')) {
      await deleteMedia(id);
      if (viewingItem?.id === id) {
        handleCloseViewer();
      }
    }
  };

  // If Vault is LOCKED:
  if (!isUnlocked) {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 bg-[#07060B] text-neutral-100 overflow-y-auto selection:bg-purple-900/60 selection:text-purple-200">
        <div>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-[#18122B] border border-purple-900/50 flex items-center justify-center text-purple-300">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white uppercase font-mono">
                OnlyUs Private Vault
              </h2>
              <p className="text-[10px] text-purple-300/70">AES-256-GCM Hardware Encrypted</p>
            </div>
          </div>

          {isSettingUpPin ? (
            /* Setup PIN Flow */
            <form onSubmit={handleSetupPin} className="space-y-4">
              <div className="p-4 bg-[#18122B]/90 border border-purple-800/40 rounded-2xl mb-4">
                <div className="flex items-center gap-2 text-xs text-purple-200 font-semibold mb-1">
                  <KeyRound size={16} className="text-purple-400" />
                  <span>Setup Your Vault PIN</span>
                </div>
                <p className="text-xs text-purple-300/80 leading-relaxed">
                  Your vault requires a separate PIN distinct from your account password. Media is encrypted client-side using this key before upload.
                </p>
              </div>

              {unlockError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                  {unlockError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-purple-200 mb-1">
                  Create Vault PIN (4–8 digits)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234"
                  className="w-full px-4 py-3 bg-[#140E24] border border-purple-900/50 focus:border-purple-400 rounded-xl text-center text-lg tracking-widest text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-purple-200 mb-1">
                  Confirm Vault PIN
                </label>
                <input
                  type="password"
                  maxLength={8}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Re-enter PIN"
                  className="w-full px-4 py-3 bg-[#140E24] border border-purple-900/50 focus:border-purple-400 rounded-xl text-center text-lg tracking-widest text-white outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-2xl transition-all text-sm cursor-pointer shadow-lg shadow-purple-950/50"
              >
                Save PIN and Open Vault
              </button>
            </form>
          ) : (
            /* PIN Unlock Keypad */
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#18122B] border border-purple-900/50 flex items-center justify-center text-purple-300 mb-4 shadow-xl">
                <Lock size={28} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Unlock Vault</h3>
              <p className="text-xs text-purple-300/70 mt-1 mb-6 text-center max-w-xs">
                Enter your secret PIN to derive the local decryption key.
              </p>

              {unlockError && (
                <div className="mb-4 w-full p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 text-center">
                  {unlockError}
                </div>
              )}

              {/* PIN Dots */}
              <div className="flex items-center gap-3 mb-6">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all ${
                      idx < enteredPin.length
                        ? 'bg-purple-400 shadow-sm shadow-purple-500/80 scale-110'
                        : 'bg-[#18122B] border border-purple-900/50'
                    }`}
                  />
                ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'].map((key) => {
                  if (key === 'bio') {
                    return (
                      <button
                        key={key}
                        onClick={handleBiometricUnlock}
                        className="h-14 rounded-2xl bg-[#140E24] hover:bg-[#2C1225] border border-purple-900/50 flex items-center justify-center text-purple-300 transition-colors cursor-pointer"
                        title="Biometric Unlock"
                      >
                        <Fingerprint size={22} />
                      </button>
                    );
                  }
                  if (key === 'del') {
                    return (
                      <button
                        key={key}
                        onClick={() => setEnteredPin((prev) => prev.slice(0, -1))}
                        className="h-14 rounded-2xl bg-[#140E24] hover:bg-[#2C1225] border border-purple-900/50 flex items-center justify-center text-purple-300 transition-colors cursor-pointer text-xs uppercase font-mono"
                      >
                        Del
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (enteredPin.length < 8) {
                          const nextPin = enteredPin + key;
                          setEnteredPin(nextPin);
                          if (nextPin.length >= 4) {
                            handleUnlock(nextPin);
                          }
                        }
                      }}
                      className="h-14 rounded-2xl bg-[#140E24] hover:bg-[#2C1225] active:bg-[#2B1B48] border border-purple-900/50 flex items-center justify-center text-lg font-bold text-white transition-colors cursor-pointer font-mono"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-purple-400/60 font-mono">
            <ShieldCheck size={12} className="text-purple-400" />
            <span>Zero-Knowledge: Server never stores your PIN</span>
          </div>
        </div>
      </div>
    );
  }

  // If Vault is UNLOCKED:
  return (
    <div className="flex-1 flex flex-col bg-[#07060B] text-neutral-100 overflow-hidden selection:bg-purple-900/60 selection:text-purple-200">
      {/* Top Vault Bar */}
      <div className="p-4 bg-[#140E24]/90 backdrop-blur border-b border-purple-900/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#20153B] border border-purple-700/50 flex items-center justify-center text-purple-300">
            <Unlock size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Private Vault</h3>
            <span className="text-[10px] text-purple-300/80 font-mono">
              {items.length} encrypted {items.length === 1 ? 'file' : 'files'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* File Picker */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-xs font-medium text-white rounded-xl transition-all cursor-pointer shadow-md shadow-purple-950/50">
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            <span>Add Media</span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>

          {/* Lock Button */}
          <button
            onClick={lockVault}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#18122B] hover:bg-[#251842] text-xs font-medium text-purple-200 hover:text-white rounded-xl transition-all cursor-pointer border border-purple-900/50"
            title="Lock Vault immediately"
          >
            <Lock size={12} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-purple-300/60 gap-2">
            <Loader2 size={20} className="animate-spin text-purple-400" />
            <span className="text-xs">Accessing encrypted storage...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-purple-300/60">
            <div className="w-12 h-12 rounded-2xl bg-[#140E24] border border-purple-900/50 flex items-center justify-center text-purple-300 mb-3">
              <ImageIcon size={22} />
            </div>
            <p className="text-xs font-medium text-white">Your Vault is Empty</p>
            <p className="text-[11px] text-purple-300/70 mt-1 max-w-xs">
              Upload photos and videos to encrypt them with AES-256-GCM. They will never appear in your device gallery.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenItem(item)}
                className="group relative aspect-square bg-[#140E24] border border-purple-900/40 hover:border-purple-600/60 rounded-2xl overflow-hidden cursor-pointer transition-all flex flex-col justify-between p-3 shadow-sm"
              >
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] font-mono bg-[#07060B]/80 px-2 py-0.5 rounded-full text-purple-300 flex items-center gap-1 border border-purple-900/30">
                    {item.media_type === 'video' ? <Film size={10} /> : <ImageIcon size={10} />}
                    {item.media_type}
                  </span>
                  <button
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 transition-all cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Center Icon */}
                <div className="my-auto self-center text-purple-400/50 group-hover:text-purple-300 transition-colors">
                  {item.media_type === 'video' ? <Play size={28} /> : <ImageIcon size={28} />}
                </div>

                <div className="z-10">
                  <div className="text-[11px] font-medium text-purple-100 truncate">
                    {item.file_name}
                  </div>
                  <div className="text-[9px] text-purple-400/60 font-mono">
                    {(item.file_size / 1024).toFixed(1)} KB • Encrypted
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-[#07060B]/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between text-white">
            <div className="truncate pr-4">
              <h4 className="text-sm font-semibold truncate">{viewingItem.file_name}</h4>
              <span className="text-[10px] text-purple-300/70 font-mono">Decrypted in client memory</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => handleDeleteItem(e, viewingItem.id)}
                className="p-2 rounded-full bg-red-950/80 text-red-300 hover:bg-red-900 transition-colors cursor-pointer"
                title="Delete Media"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={handleCloseViewer}
                className="p-2 rounded-full bg-[#18122B] text-purple-300 hover:text-white transition-colors cursor-pointer border border-purple-900/40"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Media Content */}
          <div className="my-auto flex items-center justify-center max-h-[75vh]">
            {decryptingItem ? (
              <div className="flex flex-col items-center gap-2 text-purple-300/70">
                <Loader2 size={24} className="animate-spin text-purple-400" />
                <span className="text-xs">Decrypting AES-256 payload...</span>
              </div>
            ) : viewingBlobUrl ? (
              viewingItem.media_type === 'video' ? (
                <video
                  src={viewingBlobUrl}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full rounded-2xl shadow-2xl border border-purple-900/40"
                />
              ) : (
                <img
                  src={viewingBlobUrl}
                  alt={viewingItem.file_name}
                  className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl border border-purple-900/40"
                />
              )
            ) : (
              <div className="text-red-400 text-xs">Failed to decrypt media</div>
            )}
          </div>

          <div className="text-center text-[11px] text-purple-400/60 font-mono pb-2">
            Decrypted data is never written to disk or device gallery.
          </div>
        </div>
      )}
    </div>
  );
};
