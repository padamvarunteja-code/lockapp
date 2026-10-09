// WebRTC Peer Connection Manager for One-to-One Encrypted Voice and Video Calls
import { socketClient } from './socket';

export interface CallSession {
  targetUserId: string;
  targetUsername: string;
  callType: 'voice' | 'video';
  isCaller: boolean;
  state: 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'failed' | 'unavailable';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  durationSeconds: number;
  isMuted: boolean;
  isVideoOff: boolean;
  facingMode: 'user' | 'environment';
  failureReason?: string;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private targetUserId: string | null = null;
  private onStateChange: ((session: CallSession) => void) | null = null;
  private currentSession: CallSession | null = null;
  private durationInterval: any = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    this.setupSocketListeners();
  }

  public setListener(listener: (session: CallSession) => void) {
    this.onStateChange = listener;
  }

  private notify() {
    if (this.onStateChange && this.currentSession) {
      this.onStateChange({ ...this.currentSession });
    }
  }

  private setupSocketListeners() {
    // Incoming call
    socketClient.on('call:incoming', async (data: any) => {
      const { fromUserId, callerUsername, callType, sdp } = data;

      // If already in a call, reject
      if (this.currentSession && this.currentSession.state !== 'ended') {
        socketClient.send({
          type: 'call:reject',
          targetUserId: fromUserId,
          reason: 'User is busy on another call',
        });
        return;
      }

      this.targetUserId = fromUserId;
      this.currentSession = {
        targetUserId: fromUserId,
        targetUsername: callerUsername,
        callType,
        isCaller: false,
        state: 'incoming',
        localStream: null,
        remoteStream: null,
        durationSeconds: 0,
        isMuted: false,
        isVideoOff: false,
        facingMode: 'user',
      };
      (this.currentSession as any).pendingOfferSdp = sdp;
      this.notify();
    });

    // Remote Answer
    socketClient.on('call:answer', async (data: any) => {
      if (this.pc && data.sdp) {
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          // Flush pending candidates
          for (const cand of this.pendingCandidates) {
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          this.pendingCandidates = [];

          if (this.currentSession) {
            this.currentSession.state = 'connected';
            this.startDurationTimer();
            this.notify();
          }
        } catch (err) {
          console.error('[WebRTC] Error setting remote description:', err);
        }
      }
    });

    // Remote ICE candidate
    socketClient.on('call:candidate', async (data: any) => {
      if (!data.candidate) return;
      if (this.pc && this.pc.remoteDescription) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err);
        }
      } else {
        this.pendingCandidates.push(data.candidate);
      }
    });

    // Remote Rejected
    socketClient.on('call:rejected', (data: any) => {
      if (this.currentSession) {
        this.currentSession.state = 'failed';
        this.currentSession.failureReason = data.reason || 'Call was declined';
        this.notify();
        this.cleanup();
      }
    });

    // Remote Ended
    socketClient.on('call:ended', () => {
      if (this.currentSession) {
        this.currentSession.state = 'ended';
        this.notify();
        this.cleanup();
      }
    });

    // Target unavailable (no notifications allowed)
    socketClient.on('call:unavailable', (data: any) => {
      if (this.currentSession) {
        this.currentSession.state = 'unavailable';
        this.currentSession.failureReason = data.message || 'Recipient is not active in the app';
        this.notify();
        this.cleanup();
      }
    });
  }

  // --- Start Call (Caller) ---
  public async startCall(targetUserId: string, targetUsername: string, callType: 'voice' | 'video') {
    this.targetUserId = targetUserId;
    this.currentSession = {
      targetUserId,
      targetUsername,
      callType,
      isCaller: true,
      state: 'calling',
      localStream: null,
      remoteStream: null,
      durationSeconds: 0,
      isMuted: false,
      isVideoOff: false,
      facingMode: 'user',
    };
    this.notify();

    try {
      await this.acquireLocalMedia(callType, 'user');
      this.initPeerConnection();

      const offer = await this.pc!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await this.pc!.setLocalDescription(offer);

      socketClient.send({
        type: 'call:offer',
        targetUserId,
        callType,
        sdp: offer,
      });
    } catch (err: any) {
      console.error('[WebRTC] Failed to start call:', err);
      if (this.currentSession) {
        this.currentSession.state = 'failed';
        this.currentSession.failureReason =
          err.name === 'NotAllowedError'
            ? 'Camera / Microphone permission denied.'
            : err.message || 'Call initialization failed';
        this.notify();
      }
      this.cleanup();
    }
  }

  // --- Accept Incoming Call (Recipient) ---
  public async acceptCall() {
    if (!this.currentSession || !this.targetUserId) return;
    const pendingSdp = (this.currentSession as any).pendingOfferSdp;
    const callType = this.currentSession.callType;

    this.currentSession.state = 'connecting';
    this.notify();

    try {
      await this.acquireLocalMedia(callType, 'user');
      this.initPeerConnection();

      await this.pc!.setRemoteDescription(new RTCSessionDescription(pendingSdp));

      // Flush queued candidates
      for (const cand of this.pendingCandidates) {
        await this.pc!.addIceCandidate(new RTCIceCandidate(cand));
      }
      this.pendingCandidates = [];

      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);

      socketClient.send({
        type: 'call:answer',
        targetUserId: this.targetUserId,
        sdp: answer,
      });

      this.currentSession.state = 'connected';
      this.startDurationTimer();
      this.notify();
    } catch (err: any) {
      console.error('[WebRTC] Accept call failed:', err);
      if (this.currentSession) {
        this.currentSession.state = 'failed';
        this.currentSession.failureReason = err.message || 'Failed to accept call';
        this.notify();
      }
      this.cleanup();
    }
  }

  // --- Reject Incoming Call ---
  public rejectCall() {
    if (this.targetUserId) {
      socketClient.send({
        type: 'call:reject',
        targetUserId: this.targetUserId,
        reason: 'Call declined by user',
      });
    }
    if (this.currentSession) {
      this.currentSession.state = 'ended';
      this.notify();
    }
    this.cleanup();
  }

  // --- Hangup Call ---
  public endCall() {
    if (this.targetUserId) {
      socketClient.send({
        type: 'call:end',
        targetUserId: this.targetUserId,
      });
    }
    if (this.currentSession) {
      this.currentSession.state = 'ended';
      this.notify();
    }
    this.cleanup();
  }

  // --- Toggle Mic ---
  public toggleMute(): boolean {
    if (!this.localStream || !this.currentSession) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.currentSession.isMuted = !audioTrack.enabled;
      this.notify();
      return this.currentSession.isMuted;
    }
    return false;
  }

  // --- Toggle Camera ---
  public toggleVideo(): boolean {
    if (!this.localStream || !this.currentSession) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.currentSession.isVideoOff = !videoTrack.enabled;
      this.notify();
      return this.currentSession.isVideoOff;
    }
    return false;
  }

  // --- Flip Camera (front / back) ---
  public async switchCamera() {
    if (!this.currentSession || this.currentSession.callType !== 'video') return;
    const newFacing = this.currentSession.facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.pc && this.localStream) {
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender && newVideoTrack) {
          sender.replaceTrack(newVideoTrack);
        }
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          this.localStream.removeTrack(oldVideoTrack);
        }
        this.localStream.addTrack(newVideoTrack);
      }

      this.currentSession.facingMode = newFacing;
      this.notify();
    } catch (err) {
      console.warn('[WebRTC] Camera switch failed, keeping current:', err);
    }
  }

  private createSyntheticAudioTrack(): MediaStreamTrack {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001; // subtle carrier keepalive for WebRTC SRTP
      osc.connect(gain);
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();
      return dest.stream.getAudioTracks()[0];
    } catch {
      // Fallback empty audio track
      const canvas = document.createElement('canvas');
      return (canvas.captureStream() as any).getAudioTracks()[0];
    }
  }

  private createSyntheticVideoTrack(): MediaStreamTrack {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ONLYUS ENCRYPTED STREAM', 320, 230);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#737373';
      ctx.fillText('(Hardware camera simulated)', 320, 260);
    }
    const stream = canvas.captureStream(15);
    return stream.getVideoTracks()[0];
  }

  private async acquireLocalMedia(callType: 'voice' | 'video', facingMode: 'user' | 'environment') {
    // 1. Try standard high-quality constraints
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          callType === 'video'
            ? {
                facingMode,
                width: { ideal: 640 },
                height: { ideal: 480 },
              }
            : false,
      });
    } catch (primaryErr: any) {
      console.warn('[WebRTC] Primary getUserMedia failed, attempting relaxed fallback:', primaryErr.message);

      // 2. Try relaxed constraints
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
      } catch (relaxedErr: any) {
        console.warn('[WebRTC] Relaxed getUserMedia failed, checking audio-only or synthetic:', relaxedErr.message);

        // 3. Try audio-only if video was requested
        let acquiredAudio: MediaStreamTrack | null = null;
        let acquiredVideo: MediaStreamTrack | null = null;

        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          acquiredAudio = audioStream.getAudioTracks()[0];
        } catch {
          // No physical microphone found on this device -> use synthetic audio
          acquiredAudio = this.createSyntheticAudioTrack();
        }

        if (callType === 'video') {
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            acquiredVideo = videoStream.getVideoTracks()[0];
          } catch {
            // No physical camera found -> use synthetic video
            acquiredVideo = this.createSyntheticVideoTrack();
          }
        }

        const combinedStream = new MediaStream();
        if (acquiredAudio) combinedStream.addTrack(acquiredAudio);
        if (acquiredVideo) combinedStream.addTrack(acquiredVideo);
        this.localStream = combinedStream;
      }
    }

    if (this.currentSession) {
      this.currentSession.localStream = this.localStream;
    }
  }

  private initPeerConnection() {
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    if (this.currentSession) {
      this.currentSession.remoteStream = this.remoteStream;
    }

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.localStream!);
      });
    }

    // Remote track reception
    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });
      if (this.currentSession) {
        this.currentSession.remoteStream = this.remoteStream;
        this.notify();
      }
    };

    // ICE candidate generation
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.targetUserId) {
        socketClient.send({
          type: 'call:candidate',
          targetUserId: this.targetUserId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      if (!this.pc || !this.currentSession) return;
      if (this.pc.connectionState === 'connected') {
        this.currentSession.state = 'connected';
        this.notify();
      } else if (
        this.pc.connectionState === 'disconnected' ||
        this.pc.connectionState === 'failed'
      ) {
        this.currentSession.state = 'failed';
        this.currentSession.failureReason = 'Media connection lost';
        this.notify();
        this.cleanup();
      }
    };
  }

  private startDurationTimer() {
    clearInterval(this.durationInterval);
    this.durationInterval = setInterval(() => {
      if (this.currentSession && this.currentSession.state === 'connected') {
        this.currentSession.durationSeconds++;
        this.notify();
      }
    }, 1000);
  }

  private cleanup() {
    clearInterval(this.durationInterval);
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.targetUserId = null;
    this.pendingCandidates = [];
  }
}

export const webrtcManager = new WebRTCManager();
