import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { X, Users, ArrowRightLeft, ExternalLink, Check, Loader2 } from 'lucide-react';

interface TestAccountsModalProps {
  onClose: () => void;
}

export const TestAccountsModal: React.FC<TestAccountsModalProps> = ({ onClose }) => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loginAs = async (username: string) => {
    setLoading(true);
    setStatus(`Preparing @${username}...`);
    try {
      // Try login first
      let res;
      try {
        res = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username,
            password: 'Password123!',
          }),
        });
      } catch {
        // Register if not exist
        res = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username,
            password: 'Password123!',
            confirmPassword: 'Password123!',
            warningAcknowledged: true,
          }),
        });
      }

      login(res.token, res.user);
      setStatus(`Logged in as @${username}`);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setupAliceAndBobPair = async () => {
    setLoading(true);
    setStatus('Provisioning @alice and @bob with mutual connection...');
    try {
      // 1. Ensure Alice exists
      let aliceAuth;
      try {
        aliceAuth = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'alice', password: 'Password123!' }),
        });
      } catch {
        aliceAuth = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username: 'alice',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            warningAcknowledged: true,
          }),
        });
      }

      // 2. Ensure Bob exists
      let bobAuth;
      try {
        bobAuth = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'bob', password: 'Password123!' }),
        });
      } catch {
        bobAuth = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username: 'bob',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            warningAcknowledged: true,
          }),
        });
      }

      // 3. Alice requests Bob
      localStorage.setItem('onlyus_session_token', aliceAuth.token);
      let connRes;
      try {
        connRes = await apiRequest('/api/connections/request', {
          method: 'POST',
          body: JSON.stringify({ recipientId: bobAuth.user.id }),
        });
      } catch {
        // might already exist
      }

      // 4. Bob accepts Alice
      localStorage.setItem('onlyus_session_token', bobAuth.token);
      const pending = await apiRequest('/api/connections/pending');
      const aliceReq = pending.received?.find((r: any) => r.requesterId === aliceAuth.user.id);
      if (aliceReq) {
        await apiRequest('/api/connections/respond', {
          method: 'POST',
          body: JSON.stringify({ connectionId: aliceReq.id, action: 'accept' }),
        });
      }

      // Return logged in as Alice
      login(aliceAuth.token, aliceAuth.user);
      setStatus('Successfully paired @alice and @bob! Currently logged in as @alice.');
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setStatus(`Pairing error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07060B]/85 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-purple-900/60 selection:text-purple-200">
      <div className="w-full max-w-sm bg-[#140E24] border border-purple-900/50 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-purple-400" />
            <h3 className="font-bold text-white text-sm font-mono">Testing Helper & Dual Device</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-purple-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-purple-200/80 mb-4 leading-relaxed">
          To test real-time 1-to-1 Web Crypto E2E messaging, voice calling, and video calling, you can switch accounts or open a second browser tab.
        </p>

        {status && (
          <div className="p-3 bg-[#07060B] border border-purple-900/50 rounded-xl text-xs text-purple-300 font-mono mb-4 flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin shrink-0 text-purple-400" /> : <Check size={14} className="shrink-0 text-purple-400" />}
            <span className="truncate">{status}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            onClick={setupAliceAndBobPair}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-950/50"
          >
            <span>Auto-Connect @alice and @bob</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => loginAs('alice')}
              disabled={loading}
              className="py-2.5 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 rounded-xl text-xs font-mono font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft size={13} />
              <span>Log in as @alice</span>
            </button>
            <button
              onClick={() => loginAs('bob')}
              disabled={loading}
              className="py-2.5 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 rounded-xl text-xs font-mono font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft size={13} />
              <span>Log in as @bob</span>
            </button>
          </div>

          <div className="pt-2 border-t border-purple-900/40 text-[11px] text-purple-400/70 leading-normal flex items-start gap-2">
            <ExternalLink size={14} className="shrink-0 mt-0.5 text-purple-400" />
            <span>
              Tip: Open this application in a second tab or incognito window to simulate two users simultaneously on separate devices!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
