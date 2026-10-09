import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteAccountModalProps {
  onClose: () => void;
}

const REQUIRED_PHRASE = 'DELETE MY ACCOUNT PERMANENTLY';

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ onClose }) => {
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (confirmationPhrase !== REQUIRED_PHRASE) {
      setError(`You must enter the exact phrase: ${REQUIRED_PHRASE}`);
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/api/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({
          password,
          confirmationPhrase,
        }),
      });

      // Clear all local session tokens and state
      await logout();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07060B]/85 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-purple-900/60 selection:text-purple-200">
      <div className="w-full max-w-sm bg-[#140E24] border border-red-900/50 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={20} />
            <h3 className="font-bold text-white text-sm font-mono">Permanent Account Deletion</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-purple-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3.5 bg-red-950/40 border border-red-800/40 rounded-2xl text-xs text-red-200/90 mb-4 leading-relaxed">
          <span className="font-bold text-red-300 block mb-1">Warning: Irreversible Action</span>
          This will permanently purge your username, authentication sessions, all connection records, all active 24-hour messages, and all encrypted media stored in your vault.
        </div>

        {error && (
          <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300 mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleDelete} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-purple-200 mb-1">
              Enter your password to verify
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-red-500 rounded-xl text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-purple-200 mb-1">
              Type <span className="font-mono text-red-400 select-all font-bold">{REQUIRED_PHRASE}</span>
            </label>
            <input
              type="text"
              required
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder={REQUIRED_PHRASE}
              className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-red-500 rounded-xl text-xs text-white font-mono outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 hover:text-white rounded-xl text-xs cursor-pointer font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || confirmationPhrase !== REQUIRED_PHRASE || !password}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs cursor-pointer font-medium transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Delete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
