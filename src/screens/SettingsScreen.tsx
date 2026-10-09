import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  Lock,
  KeyRound,
  ShieldAlert,
  BellOff,
  LogOut,
  Smartphone,
  ShieldCheck,
  Clock,
  Terminal,
  Laptop,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ChangeVaultPinModal } from './ChangeVaultPinModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { SecurityAuditModal } from './SecurityAuditModal';
import { AndroidGuideModal } from './AndroidGuideModal';
import { AdminPanelModal } from './AdminPanelModal';

interface DeviceSession {
  id: string;
  deviceName: string;
  createdAt: number;
  lastActiveAt: number;
  isCurrent: boolean;
}

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const [showChangePass, setShowChangePass] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [totalDevices, setTotalDevices] = useState(1);
  const [revoking, setRevoking] = useState(false);

  const loadDevices = async () => {
    try {
      const data = await apiRequest<{ activeDevices: DeviceSession[]; totalCount: number; maxAllowed: number }>(
        '/api/auth/devices'
      );
      setDevices(data.activeDevices);
      setTotalDevices(data.totalCount);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleLogoutOthers = async () => {
    setRevoking(true);
    try {
      await apiRequest('/api/auth/devices/logout-others', { method: 'POST' });
      await loadDevices();
    } catch (err: any) {
      alert(err.message || 'Failed to logout other devices');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#07060B] text-neutral-100 overflow-y-auto p-4 sm:p-6 space-y-5 selection:bg-purple-900/60 selection:text-purple-200">
      {/* User Identifier Card */}
      <div className="p-4 bg-[#140E24]/90 border border-purple-900/40 rounded-3xl flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] text-purple-400/60 uppercase tracking-widest font-mono block mb-1">
            Account Identifier
          </span>
          <div className="text-lg font-bold text-white tracking-tight font-mono">
            @{user?.username}
          </div>
          <span className="text-[11px] text-purple-300/70">Zero-Profile Cryptographic Identity</span>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-[#20153B] border border-purple-800/50 flex items-center justify-center text-purple-300 font-mono font-bold shadow-inner">
          @
        </div>
      </div>

      {/* Security Architecture Badge */}
      <div className="p-4 bg-[#18122B]/70 border border-purple-800/40 rounded-3xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
          <ShieldCheck size={16} />
          <span>Security & Privacy Architecture</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-purple-200/90">
          <div className="flex items-center gap-1.5 p-2 bg-[#140E24] border border-purple-900/30 rounded-xl">
            <Clock size={13} className="text-purple-400 shrink-0" />
            <span>24h Auto-Purge Active</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-[#140E24] border border-purple-900/30 rounded-xl">
            <BellOff size={13} className="text-purple-300 shrink-0" />
            <span>0 Notifications (Strict)</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-[#140E24] border border-purple-900/30 rounded-xl">
            <Lock size={13} className="text-purple-400 shrink-0" />
            <span>AES-256-GCM E2E Chat</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-[#140E24] border border-purple-900/30 rounded-xl">
            <KeyRound size={13} className="text-purple-400 shrink-0" />
            <span>PBKDF2 Hardware Vault</span>
          </div>
        </div>
      </div>

      {/* Security Actions */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-purple-300/80 uppercase tracking-wider px-1">
          Security Controls
        </span>

        <button
          onClick={() => setShowChangePass(true)}
          className="w-full p-3.5 bg-[#140E24]/80 hover:bg-[#1F1435] border border-purple-900/40 rounded-2xl flex items-center justify-between text-xs text-purple-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Lock size={16} className="text-purple-300" />
            <span>Change Account Password</span>
          </div>
          <span className="text-purple-400/60 font-mono text-[11px]">scrypt</span>
        </button>

        <button
          onClick={() => setShowChangePin(true)}
          className="w-full p-3.5 bg-[#140E24]/80 hover:bg-[#1F1435] border border-purple-900/40 rounded-2xl flex items-center justify-between text-xs text-purple-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <KeyRound size={16} className="text-purple-300" />
            <span>{user?.hasVaultPin ? 'Change Vault PIN' : 'Set Vault PIN'}</span>
          </div>
          <span className="text-purple-300 font-mono text-[11px]">
            {user?.hasVaultPin ? 'Configured' : 'Setup Now'}
          </span>
        </button>

        <button
          onClick={() => setShowAuditModal(true)}
          className="w-full p-3.5 bg-[#18122B]/90 hover:bg-[#251842] border border-purple-800/50 rounded-2xl flex items-center justify-between text-xs text-purple-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Terminal size={16} />
            <span className="font-medium">Run Live Security & Functional Tests</span>
          </div>
          <span className="text-xs bg-[#2B1748] px-2 py-0.5 rounded text-purple-200 border border-purple-700/40">11 Tests</span>
        </button>

        <button
          onClick={() => setShowAdminModal(true)}
          className="w-full p-3.5 bg-[#1F1435]/90 hover:bg-[#2B1B48] border border-purple-700/40 rounded-2xl flex items-center justify-between text-xs text-purple-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert size={16} className="text-purple-400" />
            <span className="font-medium">OnlyUs SecOps Admin Console</span>
          </div>
          <span className="text-[10px] bg-[#2A1847] text-purple-200 border border-purple-600/40 px-2 py-0.5 rounded font-mono">
            Password Protected
          </span>
        </button>

        <button
          onClick={() => setShowAndroidGuide(true)}
          className="w-full p-3.5 bg-[#140E24]/80 hover:bg-[#1F1435] border border-purple-900/40 rounded-2xl flex items-center justify-between text-xs text-purple-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Smartphone size={16} className="text-purple-300" />
            <span>Android Build & Architecture Guide</span>
          </div>
          <span className="text-purple-400/60 text-[11px]">Flutter / PWA</span>
        </button>
      </div>

      {/* Connected Devices (Max 3 Devices) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-purple-300/80 uppercase tracking-wider">
            Connected Devices ({totalDevices} / 3 Max)
          </span>
          <span className="text-[10px] text-purple-300 font-mono">
            {totalDevices <= 3 ? 'Within Limit' : 'Rotating'}
          </span>
        </div>

        <div className="space-y-1.5">
          {devices.map((d) => (
            <div
              key={d.id}
              className="p-3 bg-[#140E24]/70 border border-purple-900/40 rounded-2xl flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#20153B] border border-purple-800/40 flex items-center justify-center text-purple-200">
                  {d.deviceName.toLowerCase().includes('pc') || d.deviceName.toLowerCase().includes('mac') || d.deviceName.toLowerCase().includes('desktop') ? (
                    <Laptop size={15} />
                  ) : (
                    <Smartphone size={15} />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span>{d.deviceName}</span>
                    {d.isCurrent && (
                      <span className="text-[9px] bg-[#2A1847] text-purple-300 border border-purple-600/40 px-1.5 py-0.2 rounded font-mono">
                        This Device
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-purple-400/60 font-mono">
                    Last active: {new Date(d.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {d.isCurrent ? (
                <div className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-500/80" title="Active Session" />
              ) : (
                <span className="text-[10px] text-purple-400/60 font-mono">Active</span>
              )}
            </div>
          ))}

          {devices.length > 1 && (
            <button
              onClick={handleLogoutOthers}
              disabled={revoking}
              className="w-full mt-1 py-2.5 px-3 bg-[#18122B] hover:bg-[#251842] border border-purple-900/50 text-purple-200 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut size={13} className="text-purple-300" />
              <span>{revoking ? 'Disconnecting...' : 'Log Out All Other Devices'}</span>
            </button>
          )}

          <div className="px-1 text-[10px] text-purple-400/60 leading-normal">
            Multi-device sync: your account can be active on up to 3 devices concurrently. If a 4th device logs in, the oldest device session is automatically rotated out.
          </div>
        </div>
      </div>

      {/* Account Deletion & Session */}
      <div className="space-y-2 pt-2">
        <span className="text-[11px] font-semibold text-purple-300/80 uppercase tracking-wider px-1">
          Account Actions
        </span>

        <button
          onClick={() => logout()}
          className="w-full p-3.5 bg-[#140E24]/80 hover:bg-[#1F1435] border border-purple-900/40 rounded-2xl flex items-center justify-between text-xs text-purple-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <LogOut size={16} className="text-purple-300" />
            <span>Log Out</span>
          </div>
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full p-3.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 rounded-2xl flex items-center justify-between text-xs text-red-400 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert size={16} className="text-red-400" />
            <span className="font-medium">Delete Account Permanently</span>
          </div>
          <span className="text-[10px] text-red-400/80 font-mono">Irreversible</span>
        </button>
      </div>

      {/* Modals */}
      {showChangePass && <ChangePasswordModal onClose={() => setShowChangePass(false)} />}
      {showChangePin && <ChangeVaultPinModal onClose={() => setShowChangePin(false)} />}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
      {showAuditModal && <SecurityAuditModal onClose={() => setShowAuditModal(false)} />}
      {showAndroidGuide && <AndroidGuideModal onClose={() => setShowAndroidGuide(false)} />}
      {showAdminModal && <AdminPanelModal onClose={() => setShowAdminModal(false)} />}
    </div>
  );
};
