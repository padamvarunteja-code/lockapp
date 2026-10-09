import React, { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import {
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  VideoOff,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

export const CallModals: React.FC = () => {
  const {
    callSession,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
  } = useCall();

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach media streams when available
  useEffect(() => {
    if (callSession?.remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = callSession.remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = callSession.remoteStream;
      }
    }
    if (callSession?.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = callSession.localStream;
    }
  }, [callSession?.remoteStream, callSession?.localStream, callSession?.state]);

  if (!callSession) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. INCOMING CALL SCREEN
  if (callSession.state === 'incoming') {
    return (
      <div className="absolute inset-0 z-50 bg-[#07060B]/95 backdrop-blur-md flex flex-col items-center justify-between p-8 text-neutral-100 selection:bg-purple-900/60 selection:text-purple-200">
        <div className="w-full flex justify-between items-center text-xs text-purple-300/70">
          <span className="flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
            ACTIVE FOREGROUND SESSION
          </span>
          <span className="uppercase tracking-wider font-semibold font-mono text-purple-300">WebRTC Signaled</span>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#1F1435] border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-2xl">
              {callSession.callType === 'video' ? <Video size={40} /> : <Phone size={40} />}
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-purple-400/30 animate-ping"></div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-purple-300/80 mb-1 font-mono">
              Incoming {callSession.callType} Call
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-mono">
              @{callSession.targetUsername}
            </h2>
            <p className="text-xs text-purple-300/70 mt-2 max-w-xs leading-relaxed">
              End-to-end encrypted direct peer-to-peer stream. Zero call recordings.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-12 mb-6">
          <button
            onClick={rejectCall}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95">
              <PhoneOff size={28} />
            </div>
            <span className="text-xs font-medium text-purple-300/70">Decline</span>
          </button>

          <button
            onClick={acceptCall}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white flex items-center justify-center shadow-xl shadow-purple-950/60 transition-transform active:scale-95 animate-bounce">
              <Phone size={28} />
            </div>
            <span className="text-xs font-medium text-purple-300">Accept</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. VIDEO CALL SCREEN
  if (callSession.callType === 'video') {
    return (
      <div className="absolute inset-0 z-50 bg-[#07060B] flex flex-col justify-between overflow-hidden">
        {/* Remote Video Stream */}
        <div className="absolute inset-0 bg-[#07060B] flex items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {(!callSession.remoteStream || callSession.state !== 'connected') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07060B]/85 p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-[#18122B] border border-purple-900/50 flex items-center justify-center text-purple-300 mb-4 shadow-xl">
                <Video size={36} />
              </div>
              <h3 className="text-lg font-medium text-white font-mono">@{callSession.targetUsername}</h3>
              <p className="text-xs text-purple-300/70 mt-1 capitalize font-mono">
                {callSession.state === 'calling' ? 'Calling...' : callSession.state}
              </p>
              {callSession.failureReason && (
                <div className="mt-3 p-3 bg-red-950/50 border border-red-800/40 rounded-xl text-xs text-red-300 max-w-xs">
                  {callSession.failureReason}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Local PIP Video Stream */}
        <div className="absolute top-4 right-4 w-28 h-36 bg-[#18122B] rounded-2xl overflow-hidden border border-purple-800/60 shadow-2xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${callSession.facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          {callSession.isVideoOff && (
            <div className="absolute inset-0 bg-[#140E24] flex items-center justify-center text-purple-400">
              <VideoOff size={20} />
            </div>
          )}
        </div>

        {/* Top Floating Header */}
        <div className="relative z-30 p-4 bg-gradient-to-b from-[#07060B]/90 to-transparent flex items-center justify-between text-white">
          <div>
            <div className="text-sm font-semibold tracking-tight font-mono">@{callSession.targetUsername}</div>
            <div className="text-xs font-mono text-purple-300">
              {callSession.state === 'connected' ? formatDuration(callSession.durationSeconds) : 'Connecting...'}
            </div>
          </div>
          <div className="bg-[#18122B]/85 backdrop-blur border border-purple-900/50 px-2.5 py-1 rounded-full text-[10px] font-mono text-purple-200">
            OnlyUs E2E WebRTC Video
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div className="relative z-30 p-6 bg-gradient-to-t from-[#07060B]/95 to-transparent flex items-center justify-center gap-5">
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              callSession.isMuted ? 'bg-red-600 text-white' : 'bg-[#18122B]/90 border border-purple-900/50 text-purple-200 hover:bg-[#251842]'
            }`}
            title="Mute Mic"
          >
            {callSession.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              callSession.isVideoOff ? 'bg-red-600 text-white' : 'bg-[#18122B]/90 border border-purple-900/50 text-purple-200 hover:bg-[#251842]'
            }`}
            title="Toggle Camera"
          >
            {callSession.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            onClick={switchCamera}
            className="w-12 h-12 rounded-full bg-[#18122B]/90 border border-purple-900/50 text-purple-200 hover:bg-[#251842] flex items-center justify-center transition-colors cursor-pointer"
            title="Flip Camera"
          >
            <RefreshCw size={20} />
          </button>

          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            title="End Call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    );
  }

  // 3. VOICE CALL SCREEN
  return (
    <div className="absolute inset-0 z-50 bg-[#07060B]/98 flex flex-col justify-between p-8 text-neutral-100 selection:bg-purple-900/60 selection:text-purple-200">
      {/* Hidden audio element for WebRTC audio track */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Top Header */}
      <div className="flex items-center justify-between text-xs text-purple-300/70">
        <span className="font-mono text-purple-300">ONLYUS SECURE VOICE CALL</span>
        <span className="font-mono bg-[#18122B] border border-purple-900/40 px-2.5 py-1 rounded-full text-[10px] text-purple-200">
          WebRTC Opus 48kHz
        </span>
      </div>

      {/* Center Avatar & Status */}
      <div className="flex flex-col items-center justify-center text-center my-auto">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-full bg-[#18122B] border-2 border-purple-800/60 flex items-center justify-center text-purple-300 shadow-2xl">
            <Phone size={44} />
          </div>
          {callSession.state === 'connected' && (
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-pulse"></div>
          )}
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight font-mono">@{callSession.targetUsername}</h2>
        <div className="text-sm font-mono text-purple-300 mt-2">
          {callSession.state === 'connected'
            ? formatDuration(callSession.durationSeconds)
            : callSession.state === 'calling'
            ? 'Calling...'
            : callSession.state === 'connecting'
            ? 'Establishing secure direct channel...'
            : callSession.state}
        </div>

        {/* Audio Wave Visualizer Simulation */}
        {callSession.state === 'connected' && (
          <div className="flex items-center gap-1.5 mt-8 h-8">
            {[40, 75, 55, 90, 60, 85, 45, 95, 65, 35].map((h, idx) => (
              <div
                key={idx}
                className="w-1 bg-purple-400 rounded-full animate-pulse shadow-sm shadow-purple-500/50"
                style={{
                  height: `${h}%`,
                  animationDuration: `${0.4 + (idx % 3) * 0.2}s`,
                }}
              ></div>
            ))}
          </div>
        )}

        {/* Failure alert banner */}
        {(callSession.state === 'failed' || callSession.state === 'unavailable') && (
          <div className="mt-6 p-3.5 bg-[#140E24] border border-purple-900/50 rounded-xl flex items-start gap-2.5 text-xs text-purple-200 max-w-xs text-left">
            <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              {callSession.failureReason ||
                'User is not active in the app. OnlyUs enforces a zero-notification architecture.'}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Voice Controls */}
      <div className="flex items-center justify-center gap-8 mb-4">
        <button
          onClick={toggleMute}
          disabled={callSession.state !== 'connected'}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
            callSession.isMuted
              ? 'bg-red-600 text-white'
              : 'bg-[#18122B] border border-purple-900/50 text-purple-200 hover:bg-[#251842]'
          }`}
          title="Mute Mic"
        >
          {callSession.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer"
          title="End Call"
        >
          <PhoneOff size={28} />
        </button>
      </div>
    </div>
  );
};
