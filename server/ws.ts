import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { db } from './db';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const userSockets = new Map<string, Set<AuthenticatedSocket>>();

const MAX_WS_MESSAGE_BYTES = 64 * 1024; // 64KB signaling cap
const AUTH_TIMEOUT_MS = 10 * 1000;

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_WS_MESSAGE_BYTES });

  wss.on('connection', (ws: AuthenticatedSocket) => {
    ws.isAlive = true;

    // Close sockets that never authenticate — prevents resource exhaustion
    // from unauthenticated connection hoarding.
    const authTimer = setTimeout(() => {
      if (!ws.userId) {
        try {
          ws.send(JSON.stringify({ type: 'auth:error', message: 'Authentication timeout' }));
        } catch { /* ignore */ }
        ws.terminate();
      }
    }, AUTH_TIMEOUT_MS);
    authTimer.unref?.();

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: string) => {
      try {
        if (typeof data === 'string' && data.length > MAX_WS_MESSAGE_BYTES) return;
        const payload = JSON.parse(data.toString());
        if (!payload || typeof payload.type !== 'string' || payload.type.length > 32) return;
        handleWsMessage(ws, payload);
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (ws.userId) {
        const set = userSockets.get(ws.userId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            userSockets.delete(ws.userId);
          }
        }
      }
    });
  });

  // Heartbeat keepalive every 30 seconds
  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (authClient.isAlive === false) {
        return client.terminate();
      }
      authClient.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

function handleWsMessage(ws: AuthenticatedSocket, message: any) {
  const { type, token } = message;

  // 1. Authentication
  if (type === 'auth') {
    if (!token) return;
    const session = db.getSession(token);
    if (!session) {
      ws.send(JSON.stringify({ type: 'auth:error', message: 'Invalid session' }));
      return;
    }

    ws.userId = session.user_id;
    if (!userSockets.has(ws.userId)) {
      userSockets.set(ws.userId, new Set());
    }
    userSockets.get(ws.userId)!.add(ws);

    ws.send(JSON.stringify({ type: 'auth:ok', userId: ws.userId }));
    return;
  }

  // All other events require authenticated socket
  if (!ws.userId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized WebSocket operation' }));
    return;
  }

  const senderId = ws.userId;
  const senderUser = db.findUserById(senderId);

  // 2. WebRTC Call Offer
  if (type === 'call:offer') {
    const { targetUserId, callType, sdp } = message;
    if (!targetUserId || !callType || !sdp) return;
    if (typeof targetUserId !== 'string' || targetUserId.length > 64) return;
    if (callType !== 'voice' && callType !== 'video') return;
    if (typeof sdp !== 'object' || JSON.stringify(sdp).length > 16 * 1024) return;

    // Verify authorized connection
    if (!db.areUsersConnected(senderId, targetUserId)) {
      ws.send(JSON.stringify({
        type: 'call:error',
        message: 'You can only call accepted connections',
      }));
      return;
    }

    const targetSockets = userSockets.get(targetUserId);
    if (!targetSockets || targetSockets.size === 0) {
      // Recipient is not currently active in the foreground app
      ws.send(JSON.stringify({
        type: 'call:unavailable',
        targetUserId,
        message: 'Recipient is not currently active in the app. No background notifications are sent.',
      }));
      return;
    }

    // Forward incoming call invite to active recipient
    notifyUserWebSocket(targetUserId, {
      type: 'call:incoming',
      fromUserId: senderId,
      callerUsername: senderUser?.username || 'User',
      callType, // 'voice' | 'video'
      sdp,
    });
  }

  // 3. WebRTC Call Answer
  else if (type === 'call:answer') {
    const { targetUserId, sdp } = message;
    if (!targetUserId || !sdp) return;
    if (typeof targetUserId !== 'string' || targetUserId.length > 64) return;
    if (!db.areUsersConnected(senderId, targetUserId)) return;
    if (typeof sdp !== 'object' || JSON.stringify(sdp).length > 16 * 1024) return;

    notifyUserWebSocket(targetUserId, {
      type: 'call:answer',
      fromUserId: senderId,
      sdp,
    });
  }

  // 4. WebRTC ICE Candidate Exchange
  else if (type === 'call:candidate') {
    const { targetUserId, candidate } = message;
    if (!targetUserId || !candidate) return;
    if (typeof targetUserId !== 'string' || targetUserId.length > 64) return;
    if (!db.areUsersConnected(senderId, targetUserId)) return;
    if (JSON.stringify(candidate).length > 8 * 1024) return;

    notifyUserWebSocket(targetUserId, {
      type: 'call:candidate',
      fromUserId: senderId,
      candidate,
    });
  }

  // 5. WebRTC Call Reject
  else if (type === 'call:reject') {
    const { targetUserId, reason } = message;
    if (!targetUserId) return;
    if (typeof targetUserId !== 'string' || targetUserId.length > 64) return;
    if (!db.areUsersConnected(senderId, targetUserId)) return;
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 256)) return;

    notifyUserWebSocket(targetUserId, {
      type: 'call:rejected',
      fromUserId: senderId,
      reason: reason || 'Call declined',
    });
  }

  // 6. WebRTC Call Hangup / End
  else if (type === 'call:end') {
    const { targetUserId } = message;
    if (!targetUserId) return;
    if (typeof targetUserId !== 'string' || targetUserId.length > 64) return;
    if (!db.areUsersConnected(senderId, targetUserId)) return;

    notifyUserWebSocket(targetUserId, {
      type: 'call:ended',
      fromUserId: senderId,
    });
  }
}

// Helper to notify a connected user if their app is open and connected
export function notifyUserWebSocket(userId: string, data: any): boolean {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) {
    return false;
  }

  const payload = JSON.stringify(data);
  for (const s of sockets) {
    if (s.readyState === WebSocket.OPEN) {
      s.send(payload);
    }
  }
  return true;
}

export function isUserActiveOnline(userId: string): boolean {
  const sockets = userSockets.get(userId);
  return !!sockets && sockets.size > 0;
}
