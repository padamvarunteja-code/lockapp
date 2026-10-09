import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { OnlyUsLogoIcon } from '../components/branding/OnlyUsLogoIcon';

interface LoginScreenProps {
  onBack: () => void;
  onGoRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onBack, onGoRegister }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
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
          <div className="flex items-center gap-2">
            <OnlyUsLogoIcon size={20} variant="flat" />
            <span className="text-xs font-semibold tracking-wider text-purple-300 uppercase font-mono">
              OnlyUs • Log In
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Welcome back
        </h2>
        <p className="text-xs text-purple-200/80 mb-6">
          Access your private end-to-end encrypted session.
        </p>

        {error && (
          <div className="mb-5 p-3.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-start gap-2">
            <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
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
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              className="w-full px-4 py-3 bg-[#18122B] border border-purple-900/50 focus:border-purple-400 rounded-xl text-sm text-white placeholder-purple-300/30 outline-none transition-all font-mono"
            />
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
              placeholder="Your password"
              className="w-full px-4 py-3 bg-[#18122B] border border-purple-900/50 focus:border-purple-400 rounded-xl text-sm text-white placeholder-purple-300/30 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-2xl shadow-lg shadow-purple-950/50 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Log In'}
          </button>
        </form>
      </div>

      <div className="text-center pt-8 pb-2">
        <span className="text-xs text-purple-300/60">Need an account? </span>
        <button
          onClick={onGoRegister}
          className="text-xs text-purple-300 hover:text-white hover:underline font-medium cursor-pointer"
        >
          Create Account
        </button>
      </div>
    </div>
  );
};
