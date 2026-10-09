import React, { createContext, useContext, useEffect, useState } from 'react';
import { webrtcManager, type CallSession } from '../lib/webrtc';

interface CallContextType {
  callSession: CallSession | null;
  startVoiceCall: (targetUserId: string, targetUsername: string) => Promise<void>;
  startVideoCall: (targetUserId: string, targetUsername: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callSession, setCallSession] = useState<CallSession | null>(null);

  useEffect(() => {
    webrtcManager.setListener((session) => {
      if (session.state === 'ended') {
        // Clear after a brief animation delay
        setCallSession({ ...session });
        setTimeout(() => setCallSession(null), 1500);
      } else {
        setCallSession({ ...session });
      }
    });
  }, []);

  const startVoiceCall = async (targetUserId: string, targetUsername: string) => {
    await webrtcManager.startCall(targetUserId, targetUsername, 'voice');
  };

  const startVideoCall = async (targetUserId: string, targetUsername: string) => {
    await webrtcManager.startCall(targetUserId, targetUsername, 'video');
  };

  const acceptCall = async () => {
    await webrtcManager.acceptCall();
  };

  const rejectCall = () => {
    webrtcManager.rejectCall();
  };

  const endCall = () => {
    webrtcManager.endCall();
  };

  const toggleMute = () => {
    webrtcManager.toggleMute();
  };

  const toggleVideo = () => {
    webrtcManager.toggleVideo();
  };

  const switchCamera = () => {
    webrtcManager.switchCamera();
  };

  return (
    <CallContext.Provider
      value={{
        callSession,
        startVoiceCall,
        startVideoCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        switchCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}
