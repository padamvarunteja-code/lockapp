import React, { useState } from 'react';
import { X, Smartphone, ShieldCheck, Terminal, AlertCircle } from 'lucide-react';

interface AndroidGuideModalProps {
  onClose: () => void;
}

export const AndroidGuideModal: React.FC<AndroidGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'build' | 'privacy' | 'checklist'>('build');

  return (
    <div className="fixed inset-0 z-50 bg-[#07060B]/85 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-purple-900/60 selection:text-purple-200">
      <div className="w-full max-w-lg bg-[#140E24] border border-purple-900/50 rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Smartphone size={20} className="text-purple-400" />
            <h3 className="font-bold text-white text-sm font-mono">OnlyUs • Android Release & Architecture Guide</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-purple-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-purple-900/40 mb-4 shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('build')}
            className={`pb-2 px-3 font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === 'build'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-purple-300/60 hover:text-purple-100'
            }`}
          >
            Android Build
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-2 px-3 font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === 'privacy'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-purple-300/60 hover:text-purple-100'
            }`}
          >
            Privacy Policy & Disclosures
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-2 px-3 font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === 'checklist'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-purple-300/60 hover:text-purple-100'
            }`}
          >
            Release Checklist
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3 text-xs text-purple-200/90 leading-relaxed pr-1">
          {activeTab === 'build' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                  <Terminal size={14} className="text-purple-400" />
                  <span>Option A: Android PWA / TWA (Trusted Web Activity)</span>
                </div>
                <p className="text-purple-300/70 mb-2">
                  OnlyUs is built with progressive web app manifests and mobile-optimized viewports. It can be packaged directly into an Android APK using Bubblewrap CLI:
                </p>
                <pre className="bg-[#18122B] border border-purple-900/30 p-2.5 rounded-xl font-mono text-[11px] text-purple-300 overflow-x-auto">
{`npm install -g @bubblewrap/cli
bubblewrap init --manifest=manifest.json
bubblewrap build`}
                </pre>
              </div>

              <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                  <Terminal size={14} className="text-purple-400" />
                  <span>Option B: Native Flutter Architecture</span>
                </div>
                <p className="text-purple-300/70 mb-2">
                  For native Flutter compilation, use the provided REST and WebSocket backend contracts:
                </p>
                <ul className="list-disc list-inside space-y-1 text-purple-300/70">
                  <li><strong className="text-purple-100">flutter_webrtc:</strong> for peer-to-peer audio and video calls.</li>
                  <li><strong className="text-purple-100">cryptography:</strong> for client-side AES-GCM and PBKDF2.</li>
                  <li><strong className="text-purple-100">local_auth:</strong> for hardware biometric fingerprint/face unlock.</li>
                  <li><strong className="text-purple-100">AndroidManifest.xml:</strong> permissions: <code className="text-purple-300">RECORD_AUDIO</code>, <code className="text-purple-300">CAMERA</code>, <code className="text-purple-300">INTERNET</code>.</li>
                  <li><strong className="text-amber-300">Do NOT include:</strong> Firebase Messaging or Push Notification service declarations.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                <div className="font-semibold text-white mb-1">Strict No-Notification Architecture</div>
                <p className="text-purple-300/70">
                  OnlyUs deliberately excludes all push notification services (such as Firebase Cloud Messaging, OneSignal, or Apple Push Notification Service). Users are never tracked via device tokens, and the app never generates background wake-up notifications.
                </p>
              </div>

              <div className="p-3 bg-[#07060B] border border-purple-900/40 rounded-2xl">
                <div className="font-semibold text-white mb-1">Known Limitations (Documented Honestly)</div>
                <ul className="list-disc list-inside space-y-1.5 text-purple-300/70">
                  <li>
                    <strong className="text-purple-100">Incoming Calls:</strong> Because push notifications are prohibited, incoming calls and messages only alert the recipient if the recipient currently has the application open and connected.
                  </li>
                  <li>
                    <strong className="text-purple-100">24-Hour Message Shredder:</strong> The backend automatically permanently purges messages after 24 hours. The server stores only encrypted ciphertext.
                  </li>
                  <li>
                    <strong className="text-purple-100">Zero Password Recovery:</strong> If a user forgets their password, the account is permanently inaccessible by mathematical design.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-2">
              {[
                'Username-only registration with case-insensitive uniqueness verified',
                'Scrypt password hashing with unique 16-byte random salt enabled',
                'Strict 24-hour expiration server timestamp filter active',
                'Server-side automatic background message purge timer running',
                'Web Crypto AES-256-GCM client-side message encryption verified',
                'Private Vault PBKDF2 (100k rounds) client-side key derivation active',
                'WebRTC Opus 48kHz audio & VP8/H.264 video peer-to-peer transport enabled',
                'Zero push notification libraries included or configured',
                'Permanent account deletion workflow thoroughly tested',
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-[#07060B] rounded-xl border border-purple-900/40">
                  <ShieldCheck size={14} className="text-purple-400 shrink-0 mt-0.5" />
                  <span className="text-purple-200 text-[11px]">{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-purple-900/40 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 font-medium rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
