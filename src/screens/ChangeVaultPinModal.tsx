import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { X, KeyRound, Loader2, Check } from 'lucide-react';

interface ChangeVaultPinModalProps {
  onClose: () => void;
}

export const ChangeVaultPinModal: React.FC<ChangeVaultPinModalProps> = ({ onClose }) => {
  const { user, refreshUser } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin.length < 4 || newPin.length > 8) {
      setError('PIN must be 4 to 8 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PINs do not match');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/api/vault/pin', {
        method: 'POST',
        body: JSON.stringify({
          pin: newPin,
          currentPin: user?.hasVaultPin ? currentPin : undefined,
        }),
      });

      await refreshUser();
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update Vault PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07060B]/85 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-purple-900/60 selection:text-purple-200">
      <div className="w-full max-w-sm bg-[#140E24] border border-purple-900/50 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-purple-400" />
            <h3 className="font-bold text-white text-sm font-mono">
              {user?.hasVaultPin ? 'Change Vault PIN' : 'Set Vault PIN'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-purple-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-4 bg-[#18122B] border border-purple-600/40 rounded-2xl flex items-center gap-3 text-purple-200 text-xs my-4">
            <Check size={18} className="text-purple-400 shrink-0" />
            <span>Vault PIN updated successfully!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300">
                {error}
              </div>
            )}

            {user?.hasVaultPin && (
              <div>
                <label className="block text-xs font-medium text-purple-200 mb-1">
                  Current Vault PIN
                </label>
                <input
                  type="password"
                  maxLength={8}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  required
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-purple-400 rounded-xl text-center font-mono text-sm tracking-widest text-white outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-purple-200 mb-1">
                New Vault PIN (4–8 digits)
              </label>
              <input
                type="password"
                maxLength={8}
                pattern="[0-9]*"
                inputMode="numeric"
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-8 digits"
                className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-purple-400 rounded-xl text-center font-mono text-sm tracking-widest text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-purple-200 mb-1">
                Confirm New PIN
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
                className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-purple-400 rounded-xl text-center font-mono text-sm tracking-widest text-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 text-white font-medium rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-950/50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Save Vault PIN'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
