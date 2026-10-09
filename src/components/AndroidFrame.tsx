import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  const [isFrameEnabled, setIsFrameEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#07060B] flex flex-col items-center justify-center p-0 sm:p-4 text-neutral-100 font-sans selection:bg-purple-900/60 selection:text-purple-200">
      {/* Top Floating Viewport Control */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 bg-[#18122B]/90 backdrop-blur-md border border-purple-900/40 rounded-full px-3 py-1.5 shadow-xl text-xs">
        <span className="text-purple-300/70 font-mono hidden md:inline">Mode:</span>
        <button
          onClick={() => setIsFrameEnabled(true)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all cursor-pointer ${
            isFrameEnabled
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium shadow-sm'
              : 'text-purple-300 hover:text-white'
          }`}
          title="Android Device Frame"
        >
          <Smartphone size={13} />
          <span>Android Frame</span>
        </button>
        <button
          onClick={() => setIsFrameEnabled(false)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all cursor-pointer ${
            !isFrameEnabled
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium shadow-sm'
              : 'text-purple-300 hover:text-white'
          }`}
          title="Full Viewport Mode"
        >
          <Monitor size={13} />
          <span>Full Width</span>
        </button>
      </div>

      {isFrameEnabled ? (
        /* Android Phone Frame */
        <div className="relative w-full max-w-[412px] h-[100dvh] sm:h-[860px] bg-[#140E24] sm:rounded-[44px] shadow-2xl sm:border-[8px] sm:border-[#22163B] flex flex-col overflow-hidden sm:ring-1 sm:ring-purple-500/20">
          {/* Status Bar */}
          <div className="h-10 bg-[#07060B]/90 backdrop-blur px-6 flex items-center justify-between text-xs text-neutral-300 select-none z-30 shrink-0 border-b border-purple-900/30">
            <span className="font-semibold text-purple-200 tracking-tight">{currentTime || '12:00'}</span>
            {/* Front Camera Punch-hole */}
            <div className="w-3.5 h-3.5 rounded-full bg-[#07060B] border border-purple-900/60 shadow-inner hidden sm:block"></div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-[10px] text-purple-300 font-bold">5G</span>
              <svg className="w-3.5 h-3.5 fill-current text-purple-300" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9zm0 2c3.87 0 7 3.13 7 7 0 1.5-.47 2.89-1.28 4.04L12 19.34l-5.72-3.3C5.47 14.89 5 13.5 5 12c0-3.87 3.13-7 7-7z" />
              </svg>
              <div className="w-5 h-2.5 border border-purple-400/80 rounded-sm p-0.5 flex items-center">
                <div className="w-full h-full bg-purple-400 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* Android App Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative bg-[#07060B]">
            {children}
          </div>

          {/* Bottom Android Gesture Navigation Bar */}
          <div className="h-5 bg-[#07060B] flex items-center justify-center shrink-0 z-30 border-t border-purple-950/40">
            <div className="w-32 h-1 bg-purple-900/70 rounded-full"></div>
          </div>
        </div>
      ) : (
        /* Full Viewport */
        <div className="w-full max-w-4xl min-h-screen bg-[#07060B] flex flex-col shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
};
