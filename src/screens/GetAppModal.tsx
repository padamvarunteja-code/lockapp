import React, { useEffect, useState } from 'react';
import { X, Globe, Smartphone, Download, CheckCircle2, BellOff } from 'lucide-react';

interface GetAppModalProps {
  onClose: () => void;
  onContinueInBrowser: () => void;
}

interface AppInfo {
  name: string;
  version: string;
  apkUrl: string;
  hasApk: boolean;
}

export const GetAppModal: React.FC<GetAppModalProps> = ({ onClose, onContinueInBrowser }) => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    fetch('/api/app-info')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.version === 'string') setAppInfo(data);
      })
      .catch(() => {
        // Offline or unreachable — browser option still works from cache.
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#140E24] border border-purple-900/50 rounded-3xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">Get OnlyUs</div>
            <div className="text-[11px] text-purple-300/70 font-mono">
              {appInfo ? `v${appInfo.version}` : 'Private communication'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#18122B] border border-purple-900/50 text-purple-300 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Option 1: Use in browser */}
        <div className="p-4 bg-[#18122B]/70 border border-purple-800/40 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Globe size={16} className="text-purple-300" />
            <span>Use in your browser</span>
          </div>
          <p className="text-[11px] text-purple-300/70 leading-relaxed">
            No install needed. Works on any phone, tablet, or computer. You can also install
            it as an app later from your browser menu ("Install app" / "Add to Home screen").
          </p>
          <button
            onClick={onContinueInBrowser}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium rounded-xl text-xs transition-all cursor-pointer"
          >
            Continue in Browser
          </button>
        </div>

        {/* Option 2: Android APK */}
        <div className="p-4 bg-[#07060B] border border-purple-900/40 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Smartphone size={16} className="text-purple-300" />
            <span>Android app (APK)</span>
          </div>
          <p className="text-[11px] text-purple-300/70 leading-relaxed">
            Native wrapper with camera & microphone access for voice/video calls. Same account,
            same encryption — just an app icon.
          </p>
          {appInfo && appInfo.hasApk ? (
            <a
              href={appInfo.apkUrl}
              download
              className="w-full py-3 bg-[#18122B] hover:bg-[#251842] border border-purple-900/50 text-purple-200 font-medium rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download size={14} />
              <span>Download APK (v{appInfo.version})</span>
            </a>
          ) : (
            <div className="p-3 bg-[#18122B]/70 border border-purple-900/40 rounded-xl text-[11px] text-purple-300/80">
              {appInfo
                ? 'APK build not published yet — please use OnlyUs in the browser for now.'
                : 'Checking for APK build…'}
            </div>
          )}
          <p className="text-[10px] text-purple-400/50 leading-relaxed">
            After downloading, open the file and allow "Install unknown apps" when asked.
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-purple-400/60">
          <BellOff size={12} />
          <span>Zero notifications · Zero tracking · 24h disappearing messages</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-purple-300/70">
          <CheckCircle2 size={12} className="text-purple-400" />
          <span>Both options use the same account and the same encryption.</span>
        </div>
      </div>
    </div>
  );
};
