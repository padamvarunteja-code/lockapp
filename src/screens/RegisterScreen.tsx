import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { ShieldAlert, ArrowLeft, Loader2, Check } from 'lucide-react';

interface RegisterScreenProps {
  onBack: () => void;
  onGoLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onBack, onGoLogin }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acknowledged) {
      setError('You must acknowledge the warning regarding no password recovery to proceed.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          confirmPassword,
          warningAcknowledged: acknowledged,
        }),
      });

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 bg-[#07060B] text-neutral-100 overflow-y-auto selection:bg-purple-900/60 selection:text-purple-200">
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 pt-2 mb-6">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#18122B] border border-purple-900/50 flex items-center justify-center text-purple-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-semibold tracking-wider text-purple-300 uppercase font-mono">
            OnlyUs • Create Account
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Pick your private username
        </h2>
        <p className="text-xs text-purple-200/80 mb-6">
          Your username is your only identifier. No real names, emails, or phone numbers are ever collected.
        </p>

        {error && (
          <div className="mb-5 p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-start gap-2">
            <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-purple-200 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g. shadow_rider"
              className="w-full px-4 py-3 bg-[#150E24] border border-purple-900/50 focus:border-purple-400 rounded-xl text-sm text-white placeholder-purple-400/40 outline-none transition-all font-mono"
            />
            <span className="text-[10px] text-purple-400/60 mt-1 block">
              Case-insensitive, letters, numbers, and underscores only.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-purple-200 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-3 bg-[#150E24] border border-purple-900/50 focus:border-purple-400 rounded-xl text-sm text-white placeholder-purple-400/40 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-purple-200 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-4 py-3 bg-[#150E24] border border-purple-900/50 focus:border-purple-400 rounded-xl text-sm text-white placeholder-purple-400/40 outline-none transition-all"
            />
          </div>

          {/* Mandatory Warning Box */}
          <div className="mt-2 p-4 bg-[#18122B] border border-purple-700/40 rounded-2xl">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="text-purple-300 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-200 leading-relaxed font-medium">
                Mandatory Warning:
                <p className="mt-1 text-purple-100 font-semibold">
                  &ldquo;There is no password recovery. If you forget your password, you will permanently lose access to your account.&rdquo;
                </p>
              </div>
            </div>

            <label className="mt-4 pt-3 border-t border-purple-900/40 flex items-start gap-3 cursor-pointer select-none">
              <div
                onClick={() => setAcknowledged(!acknowledged)}
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                  acknowledged
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'border-purple-800 bg-[#140E24]'
                }`}
              >
                {acknowledged && <Check size={14} className="stroke-[3]" />}
              </div>
              <span className="text-xs text-purple-200/80">
                I understand and acknowledge that there is no recovery mechanism and my account cannot be restored if I lose my password.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !acknowledged}
            className="mt-3 w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 text-white font-medium rounded-2xl shadow-lg shadow-purple-950/60 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Register Account'}
          </button>
        </form>
      </div>

      <div className="text-center pt-6 pb-2">
        <span className="text-xs text-purple-300/60">Already registered? </span>
        <button
          onClick={onGoLogin}
          className="text-xs text-purple-300 hover:underline font-medium cursor-pointer"
        >
          Log in
        </button>
      </div>
    </div>
  );
};
