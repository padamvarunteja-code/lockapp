import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Lock,
  UserCheck,
  Database,
  RefreshCw,
  LogOut,
  AlertTriangle,
  Clock,
  Terminal,
  X,
  Loader2,
  CheckCircle2,
  FileText,
  Activity,
  Layers,
  Users,
  Save,
  Key,
} from 'lucide-react';

interface AccountRecord {
  id: string;
  username: string;
  created_at: number;
  status: 'active' | 'inactive';
  activeSessionsCount: number;
  lastActiveAt: number;
  hasVaultPin: boolean;
  vaultItemsCount: number;
  mustChangePassword: boolean;
  mustChangeVaultPin: boolean;
}

interface AuditLog {
  id: string;
  timestamp: number;
  event_type: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  actor: string;
  ip_address: string;
  details: string;
  current_hash: string;
}

interface TelemetryData {
  users: {
    totalAccounts: number;
    activeDeviceSessions: number;
    maxDevicesAllowedPerUser: number;
  };
  connections: {
    mutualAccepted: number;
    pendingRequests: number;
  };
  messaging: {
    activeConversations: number;
    unexpiredMessages: number;
    retentionPolicyHours: number;
    shredderIntervalSeconds: number;
  };
  vault: {
    encryptedFilesStored: number;
    aggregateEncryptedBytes: number;
    encryptionStandard: string;
  };
  securityPosture: {
    userPasswordStorage: string;
    plaintextPasswordsStored: boolean;
    vaultKeysStoredOnServer: boolean;
    notificationsDisabled: boolean;
    inactivityTimeoutMinutes: number;
  };
  databaseEnvironment?: {
    mode: string;
    isProduction: boolean;
    databaseFile: string;
  };
}

interface AdminPanelModalProps {
  onClose: () => void;
}

const ADMIN_TOKEN_KEY = 'onlyus_admin_session_token';

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ onClose }) => {
  const [adminToken, setAdminToken] = useState<string | null>(
    sessionStorage.getItem(ADMIN_TOKEN_KEY)
  );

  // Login form state
  const [username, setUsername] = useState('onlyus_admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Active admin dashboard state
  const [activeTab, setActiveTab] = useState<'telemetry' | 'accounts' | 'settings' | 'audit' | 'threat'>('telemetry');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [chainVerification, setChainVerification] = useState<{
    valid: boolean;
    verifiedBlocks: number;
  } | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);

  // Accounts view state (hashes are never fetched — zero-knowledge admin)

  // Admin settings state
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reauthentication state
  const [showReauth, setShowReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthAction, setReauthAction] = useState<(() => Promise<void>) | null>(null);

  // Idle timer display (15 min inactivity timeout)
  const [idleSeconds, setIdleSeconds] = useState(15 * 60);

  useEffect(() => {
    if (!adminToken) return;
    const interval = setInterval(() => {
      setIdleSeconds((prev) => {
        if (prev <= 1) {
          handleAdminLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [adminToken]);

  const adminFetch = async (endpoint: string, options: RequestInit = {}) => {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        ...(options.headers as any),
      },
    });

    if (res.status === 401) {
      handleAdminLogout();
      throw new Error('Admin session expired due to inactivity. Please re-authenticate.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.requiresReauth) {
        setShowReauth(true);
      }
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication rejected');
      }

      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setAdminToken(data.token);
      setIdleSeconds(15 * 60);
      loadDashboardData(data.token);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {
        // Ignored
      }
    }
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setTelemetry(null);
    setAuditLogs([]);
    setAccounts([]);
  };

  const loadDashboardData = async (token = adminToken) => {
    if (!token) return;
    setLoadingData(true);
    try {
      const [telemetryData, logsData, accountsData] = await Promise.all([
        fetch('/api/admin/telemetry', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch('/api/admin/audit-logs?limit=50', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch('/api/admin/accounts', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()).catch(() => ({ accounts: [] })),
      ]);

      if (telemetryData.users) {
        setTelemetry(telemetryData);
      }
      if (logsData.logs) {
        setAuditLogs(logsData.logs);
      }
      if (accountsData.accounts) {
        setAccounts(accountsData.accounts);
      }
    } catch (err) {
      console.warn('Failed to load admin data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg(null);
    if (!currentAdminPassword) {
      setSettingsMsg({ type: 'error', text: 'Current administrator password is required.' });
      return;
    }
    setSettingsSaving(true);
    try {
      const res = await adminFetch('/api/admin/settings/update-credentials', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: currentAdminPassword,
          newPassword: newAdminPassword.trim() || undefined,
        }),
      });
      setSettingsMsg({ type: 'success', text: res.message || 'Credentials updated successfully!' });
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      loadDashboardData();
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to update credentials' });
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      loadDashboardData();
    }
  }, [adminToken]);

  const verifyAuditChain = async () => {
    setVerifyingChain(true);
    try {
      const data = await adminFetch('/api/admin/audit-logs/verify-integrity', {
        method: 'POST',
      });
      setChainVerification({
        valid: data.valid,
        verifiedBlocks: data.verifiedBlocks,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVerifyingChain(false);
    }
  };

  const executeSensitiveAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err: any) {
      if (err.message.includes('reauthentication')) {
        setReauthAction(() => action);
        setShowReauth(true);
      } else {
        alert(err.message);
      }
    }
  };

  const handleConfirmReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthError(null);
    try {
      await adminFetch('/api/admin/auth/reauth', {
        method: 'POST',
        body: JSON.stringify({ password: reauthPassword }),
      });
      setShowReauth(false);
      setReauthPassword('');
      if (reauthAction) {
        await reauthAction();
        setReauthAction(null);
      }
    } catch (err: any) {
      setReauthError(err.message);
    }
  };

  const handleTriggerPurge = () => {
    executeSensitiveAction(async () => {
      const res = await adminFetch('/api/admin/ops/trigger-purge', { method: 'POST' });
      alert(`Purge Completed: Permanently shredded ${res.purgedCount} expired messages.`);
      loadDashboardData();
    });
  };

  const handleRevokeAllSessions = () => {
    if (confirm('Revoke all administrator sessions immediately?')) {
      executeSensitiveAction(async () => {
        const res = await adminFetch('/api/admin/auth/revoke-all-sessions', { method: 'POST' });
        alert(`Revoked ${res.revokedCount} admin sessions.`);
        handleAdminLogout();
      });
    }
  };

  const formatIdleTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07060B]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 selection:bg-purple-900/60 selection:text-purple-200">
      <div className="w-full max-w-2xl bg-[#140E24] border border-purple-900/50 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-neutral-100">
        {/* Top Header */}
        <div className="p-4 border-b border-purple-900/40 flex items-center justify-between bg-[#0F0A1B]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#20153B] border border-purple-700/50 flex items-center justify-center text-purple-300">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white tracking-tight uppercase font-mono">
                  OnlyUs SecOps Admin Console
                </h3>
                <span className="text-[10px] bg-[#2A1847] text-purple-200 border border-purple-600/40 px-2 py-0.5 rounded-full font-mono">
                  Privileged
                </span>
              </div>
              <p className="text-[10px] text-purple-300/70">Defense-in-Depth • Zero-Knowledge Guarantee</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {adminToken && (
              <div className="flex items-center gap-1.5 text-xs font-mono bg-[#18122B] border border-purple-900/40 px-3 py-1.5 rounded-full text-purple-300">
                <Clock size={12} />
                <span>Idle: {formatIdleTime(idleSeconds)}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-purple-300 hover:text-white hover:bg-[#251842] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!adminToken ? (
            /* Admin Authentication Gate */
            <div className="max-w-md mx-auto py-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#18122B] border border-purple-900/50 flex items-center justify-center text-purple-300 mx-auto mb-3 shadow-inner">
                  <KeyRound size={28} />
                </div>
                <h4 className="text-lg font-bold text-white">Privileged Authentication</h4>
                <p className="text-xs text-purple-300/70 mt-1 max-w-xs mx-auto leading-relaxed">
                  Master administrator credentials required. Public registration is permanently disabled.
                </p>
              </div>

              {loginError && (
                <div className="mb-4 p-3 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-purple-200 mb-1">
                    Admin Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="onlyus_admin"
                    className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-purple-400 rounded-xl text-xs text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-purple-200 mb-1">
                    Master Admin Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-purple-400 rounded-xl text-xs text-white outline-none"
                  />
                </div>

                {/* Pre-configured bootstrap credential autofill for demonstration */}
                <div className="p-3 bg-[#18122B]/70 border border-purple-900/40 rounded-xl text-[11px] text-purple-300/80 flex items-center justify-between">
                  <span>Bootstrap Credentials:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('onlyus_admin');
                      setPassword('SecOps@Defense2026!');
                    }}
                    className="text-xs text-purple-300 hover:text-white hover:underline font-mono cursor-pointer"
                  >
                    Load Bootstrap Keys
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 text-white font-medium rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50"
                >
                  {loggingIn ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Lock size={14} />
                  )}
                  <span>Authenticate Administrator Session</span>
                </button>
              </form>
            </div>
          ) : (
            /* Authenticated Admin Dashboard */
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex border-b border-purple-900/40 gap-3 text-xs font-medium overflow-x-auto pb-0.5">
                <button
                  onClick={() => setActiveTab('telemetry')}
                  className={`pb-2 whitespace-nowrap transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'telemetry'
                      ? 'border-purple-500 text-purple-300'
                      : 'border-transparent text-purple-300/60 hover:text-white'
                  }`}
                >
                  <Activity size={14} />
                  <span>Telemetry</span>
                </button>

                <button
                  onClick={() => setActiveTab('accounts')}
                  className={`pb-2 whitespace-nowrap transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'accounts'
                      ? 'border-purple-500 text-purple-300'
                      : 'border-transparent text-purple-300/60 hover:text-white'
                  }`}
                >
                  <Users size={14} />
                  <span>Accounts Inspector ({accounts.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`pb-2 whitespace-nowrap transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'settings'
                      ? 'border-purple-500 text-purple-300'
                      : 'border-transparent text-purple-300/60 hover:text-white'
                  }`}
                >
                  <KeyRound size={14} />
                  <span>Admin Setup & Keys</span>
                </button>

                <button
                  onClick={() => setActiveTab('audit')}
                  className={`pb-2 whitespace-nowrap transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'audit'
                      ? 'border-purple-500 text-purple-300'
                      : 'border-transparent text-purple-300/60 hover:text-white'
                  }`}
                >
                  <FileText size={14} />
                  <span>Audit Trail</span>
                </button>

                <button
                  onClick={() => setActiveTab('threat')}
                  className={`pb-2 whitespace-nowrap transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'threat'
                      ? 'border-purple-500 text-purple-300'
                      : 'border-transparent text-purple-300/60 hover:text-white'
                  }`}
                >
                  <Layers size={14} />
                  <span>Threat Model</span>
                </button>
              </div>

              {/* 1. TELEMETRY TAB */}
              {activeTab === 'telemetry' && telemetry && (
                <div className="space-y-4">
                  {/* Zero-Knowledge Guarantees Banner */}
                  <div className="p-3.5 bg-[#18122B]/90 border border-purple-700/40 rounded-2xl flex items-start gap-2.5 text-xs text-purple-200">
                    <ShieldCheck size={18} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white">Zero-Knowledge Architecture Enforced:</div>
                      Administrator endpoints mathematically cannot access user account passwords in plaintext, vault PINs, private keys, or message contents. All data is encrypted on the client using AES-256-GCM and passwords are mathematically hashed with Scrypt.
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                      <div className="text-[10px] text-purple-400/60 uppercase font-mono">Registered Accounts</div>
                      <div className="text-2xl font-bold text-white mt-1 font-mono">
                        {telemetry.users.totalAccounts}
                      </div>
                      <div className="text-[10px] text-purple-300/70 mt-0.5">Username-only accounts</div>
                    </div>

                    <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                      <div className="text-[10px] text-purple-400/60 uppercase font-mono">Active Device Sessions</div>
                      <div className="text-2xl font-bold text-white mt-1 font-mono">
                        {telemetry.users.activeDeviceSessions}
                      </div>
                      <div className="text-[10px] text-purple-300 mt-0.5">Max 3 per account</div>
                    </div>

                    <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                      <div className="text-[10px] text-purple-400/60 uppercase font-mono">Active 24h Messages</div>
                      <div className="text-2xl font-bold text-white mt-1 font-mono">
                        {telemetry.messaging.unexpiredMessages}
                      </div>
                      <div className="text-[10px] text-purple-300/70 mt-0.5">Hard purge active</div>
                    </div>

                    <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                      <div className="text-[10px] text-purple-400/60 uppercase font-mono">Vault Storage (Encrypted)</div>
                      <div className="text-2xl font-bold text-white mt-1 font-mono">
                        {(telemetry.vault.aggregateEncryptedBytes / 1024).toFixed(1)} KB
                      </div>
                      <div className="text-[10px] text-purple-300/70 mt-0.5">
                        {telemetry.vault.encryptedFilesStored} encrypted files
                      </div>
                    </div>
                  </div>

                  {/* Operational Controls */}
                  <div className="p-4 bg-[#07060B] border border-purple-900/40 rounded-2xl space-y-3">
                    <div className="text-xs font-semibold text-purple-200 uppercase tracking-wide font-mono">
                      Privileged Operational Actions (Re-Authentication Enforced)
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <button
                        onClick={handleTriggerPurge}
                        className="px-3.5 py-2 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw size={13} className="text-purple-400" />
                        <span>Trigger Immediate 24h Message Shredder</span>
                      </button>

                      <button
                        onClick={handleRevokeAllSessions}
                        className="px-3.5 py-2 bg-red-950/40 hover:bg-red-950/70 border border-red-900/60 text-red-300 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <AlertTriangle size={13} className="text-red-400" />
                        <span>Revoke All Admin Sessions</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ACCOUNTS INSPECTOR TAB */}
              {activeTab === 'accounts' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-[#18122B]/90 border border-purple-700/40 rounded-2xl flex items-start gap-2.5 text-xs text-purple-200">
                    <Users size={18} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white">Registered Accounts & Security Inspector:</div>
                      Total accounts: <strong className="text-white font-mono">{accounts.length}</strong>. Passwords are saved as secure mathematical Scrypt hashes with 16-byte random salts. Vault PINs derive client-side PBKDF2 keys directly on user devices.
                    </div>
                  </div>

                  {accounts.length === 0 ? (
                    <div className="p-8 text-center bg-[#07060B] border border-purple-900/40 rounded-2xl text-purple-300/60 text-xs">
                      No registered accounts found. Create an account via registration to inspect.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {accounts.map((acc) => {
                        return (
                          <div
                            key={acc.id}
                            className="p-4 bg-[#07060B] border border-purple-900/40 rounded-2xl space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#18122B] border border-purple-700/50 flex items-center justify-center font-bold text-purple-300 text-xs font-mono">
                                  @{acc.username[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-white text-sm font-mono flex items-center gap-2">
                                    <span>@{acc.username}</span>
                                    <span className="text-[10px] bg-[#18122B] text-purple-300 px-2 py-0.5 rounded-full border border-purple-900/40 font-normal">
                                      {acc.activeSessionsCount} / 3 Devices Active
                                    </span>
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full border font-normal ${
                                        acc.status === 'active'
                                          ? 'bg-purple-950/60 text-purple-300 border-purple-600/40'
                                          : 'text-purple-400/60 border-purple-900/30'
                                      }`}
                                    >
                                      {acc.status}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-purple-400/60 font-mono">
                                    Created: {new Date(acc.created_at).toLocaleString()} • ID: {acc.id.slice(0, 8)}...
                                  </div>
                                  <div className="text-[10px] text-purple-400/60 font-mono">
                                    Last active: {new Date(acc.lastActiveAt).toLocaleString()}
                                    {acc.mustChangePassword ? ' • Must change password' : ''}
                                    {acc.mustChangeVaultPin ? ' • Must change vault PIN' : ''}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Password Storage Record (zero-knowledge: hash never exposed) */}
                            <div className="p-2.5 bg-[#140E24] border border-purple-900/30 rounded-xl space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono text-purple-300 flex items-center gap-1.5">
                                  <Lock size={12} className="text-purple-400" />
                                  <span>Account Password Record (Scrypt Hash — never displayed):</span>
                                </span>
                              </div>
                              <div className="font-mono text-[10px] break-all p-1.5 bg-[#07060B] rounded-lg border border-purple-950 text-purple-200">
                                ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                              </div>
                              <span className="text-[9px] text-purple-400/50 block">
                                Storage Format: <code className="text-purple-300">salt:scrypt_derived_key</code> (one-way irreversible hash protecting user privacy).
                              </span>
                            </div>

                            {/* Vault Info Record (counts only — no salts or keys leave the server) */}
                            <div className="p-2.5 bg-[#140E24] border border-purple-900/30 rounded-xl space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono text-purple-300 flex items-center gap-1.5">
                                  <Key size={12} className="text-purple-400" />
                                  <span>Private Vault Storage Status:</span>
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                    acc.hasVaultPin
                                      ? 'bg-purple-950/60 text-purple-300 border border-purple-600/40'
                                      : 'bg-[#18122B] text-purple-400/60 border border-purple-900/30'
                                  }`}
                                >
                                  {acc.hasVaultPin ? 'Vault Initialized' : 'Not Setup Yet'}
                                </span>
                              </div>
                              <div className="text-[10px] text-purple-300/80 font-mono space-y-0.5">
                                <div>
                                  Encrypted Vault Files: <strong className="text-white">{acc.vaultItemsCount} files</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. ADMIN SETUP & KEYS TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-4 max-w-lg mx-auto py-2">
                  <div className="p-3.5 bg-[#18122B]/90 border border-purple-700/40 rounded-2xl flex items-start gap-2.5 text-xs text-purple-200">
                    <KeyRound size={18} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white">Administrator Password Configuration:</div>
                      Update the master administrator password. Changes take effect immediately and are recorded in the immutable audit log.
                    </div>
                  </div>

                  {settingsMsg && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                        settingsMsg.type === 'success'
                          ? 'bg-purple-950/50 border-purple-500/40 text-purple-200'
                          : 'bg-red-950/60 border-red-800 text-red-300'
                      }`}
                    >
                      {settingsMsg.type === 'success' ? (
                        <CheckCircle2 size={15} className="text-purple-400 shrink-0" />
                      ) : (
                        <AlertTriangle size={15} className="text-red-400 shrink-0" />
                      )}
                      <span>{settingsMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveCredentials} className="space-y-4 bg-[#07060B] border border-purple-900/40 rounded-2xl p-5">
                    <div>
                      <label className="block text-xs font-medium text-purple-200 mb-1">
                        Current Master Admin Password <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={currentAdminPassword}
                        onChange={(e) => setCurrentAdminPassword(e.target.value)}
                        placeholder="Enter current password to authorize"
                        className="w-full px-3.5 py-2.5 bg-[#140E24] border border-purple-900/50 focus:border-purple-400 rounded-xl text-xs text-white outline-none font-mono"
                      />
                    </div>

                    <div className="pt-2 border-t border-purple-900/30">
                      <label className="block text-xs font-medium text-purple-200 mb-1">
                        New Master Admin Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="Leave blank to keep unchanged (min 8 chars)"
                        className="w-full px-3.5 py-2.5 bg-[#140E24] border border-purple-900/50 focus:border-purple-400 rounded-xl text-xs text-white outline-none font-mono"
                      />
                    </div>

                    <div className="p-3 bg-[#18122B]/70 border border-purple-900/40 rounded-xl text-[11px] text-purple-300/80 space-y-1">
                      <div className="font-semibold text-white">Active Session Timeout:</div>
                      <div>Session timeout is enforced at <strong>15 minutes</strong> of inactivity with immediate automatic lock.</div>
                    </div>

                    <button
                      type="submit"
                      disabled={settingsSaving || !currentAdminPassword}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 text-white font-medium rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50"
                    >
                      {settingsSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      <span>Save Administrator Security Changes</span>
                    </button>
                  </form>
                </div>
              )}

              {/* 2. AUDIT TRAIL TAB */}
              {activeTab === 'audit' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white">Cryptographic Audit Chain</span>
                      <p className="text-[10px] text-purple-300/70">
                        HMAC-SHA256 blocks chained sequentially. Tampering or record deletion breaks chain hashes.
                      </p>
                    </div>
                    <button
                      onClick={verifyAuditChain}
                      disabled={verifyingChain}
                      className="px-3 py-1.5 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-xs text-purple-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {verifyingChain ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      <span>Verify Chain Integrity</span>
                    </button>
                  </div>

                  {chainVerification && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                        chainVerification.valid
                          ? 'bg-purple-950/40 border-purple-500/30 text-purple-200'
                          : 'bg-red-950/50 border-red-800 text-red-300'
                      }`}
                    >
                      {chainVerification.valid ? (
                        <>
                          <CheckCircle2 size={16} className="text-purple-400 shrink-0" />
                          <span>
                            Chain Verified: All {chainVerification.verifiedBlocks} audit blocks intact. Zero tampering detected.
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} className="text-red-400 shrink-0" />
                          <span>Tamper Alert: Audit chain verification failed!</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Logs List */}
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-[#07060B] border border-purple-900/40 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                              log.severity === 'CRITICAL'
                                ? 'bg-red-950 text-red-400 border border-red-800/50'
                                : log.severity === 'WARN'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                                : 'bg-[#18122B] text-purple-200 border border-purple-900/30'
                            }`}
                          >
                            {log.event_type}
                          </span>
                          <span className="text-[10px] text-purple-400/60 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()} • IP: {log.ip_address}
                          </span>
                        </div>
                        <p className="text-purple-200/90 text-[11px] leading-relaxed">{log.details}</p>
                        <div className="text-[9px] text-purple-400/50 font-mono truncate">
                          HMAC: {log.current_hash}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. THREAT MODEL & DISCLOSURES TAB (Req #16) */}
              {activeTab === 'threat' && (
                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="p-3.5 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                    <div className="font-semibold text-white mb-1.5 flex items-center gap-1.5">
                      <Terminal size={14} className="text-purple-400" />
                      <span>Security Posture: Defense-in-Depth</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-purple-200/80">
                      <li>Client-side Web Crypto AES-256-GCM encryption with local hardware keys.</li>
                      <li>Scrypt password hashing with 16-byte random salt and constant-time verification.</li>
                      <li>Strict 15-minute inactivity timeouts and re-authentication gates for privileged operations.</li>
                      <li>Cryptographic HMAC-SHA256 chained audit logs.</li>
                      <li>Absolute exclusion of push notification SDKs (zero device tracking).</li>
                    </ul>
                  </div>

                  <div className="p-3.5 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                    <div className="font-semibold text-amber-300 mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-400" />
                      <span>Documented Remaining Risks (Honest Threat Analysis)</span>
                    </div>
                    <div className="space-y-2 text-purple-300/70 text-[11px]">
                      <div>
                        <strong className="text-purple-100">1. Client Device Compromise:</strong> An attacker with physical access or root malware on an end user device could extract memory before vault lock or screen record. <em>Mitigation:</em> Biometric auto-relock and memory-only decrypted blobs.
                      </div>
                      <div>
                        <strong className="text-purple-100">2. Browser Extensions:</strong> Untrusted browser extensions could inspect DOM nodes in web mode. <em>Mitigation:</em> Recommend standalone Android APK / PWA execution.
                      </div>
                      <div>
                        <strong className="text-purple-100">3. Infrastructure Cold Backups:</strong> Cloud snapshot backups may temporarily retain expired encrypted ciphertext until backup retention cycles conclude. <em>Mitigation:</em> All stored content is ciphertext; without recipient keys, backup snapshots are mathematically unreadable.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {adminToken && (
          <div className="p-4 border-t border-purple-900/40 flex items-center justify-between bg-[#0F0A1B]/90">
            <span className="text-[11px] text-purple-400/60 font-mono">
              Admin Session Active • Inactivity Auto-Lock Enabled
            </span>
            <button
              onClick={handleAdminLogout}
              className="px-3.5 py-1.5 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-xs font-medium text-purple-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <LogOut size={13} className="text-red-400" />
              <span>Terminate Admin Session</span>
            </button>
          </div>
        )}

        {/* Reauthentication Modal Overlay */}
        {showReauth && (
          <div className="absolute inset-0 z-50 bg-[#07060B]/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#140E24] border border-red-900/50 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <Lock size={18} />
                <h4 className="font-bold text-white text-sm">Privileged Reauthentication</h4>
              </div>
              <p className="text-xs text-purple-300/70 mb-4">
                Recent reauthentication is required to perform sensitive operations. Please confirm your administrator password.
              </p>

              {reauthError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 mb-3">
                  {reauthError}
                </div>
              )}

              <form onSubmit={handleConfirmReauth} className="space-y-3">
                <input
                  type="password"
                  required
                  autoFocus
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Master Admin Password"
                  className="w-full px-3.5 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-red-500 rounded-xl text-xs text-white outline-none"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReauth(false);
                      setReauthAction(null);
                    }}
                    className="flex-1 py-2 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-300 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Verify
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
