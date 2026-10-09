import express from 'express';
import { db } from './db';
import { rateLimiter, requireAuth, type AuthenticatedRequest } from './middleware';
import { notifyUserWebSocket } from './ws';

export const chatRouter = express.Router();

// Per-user send throttle: 60 messages/min bursts to `POST /messages`.
const sendMessageLimiter = rateLimiter(60, 60 * 1000);
// Read/purge endpoints: generous but bounded.
const readLimiter = rateLimiter(120, 60 * 1000);

export const MAX_ENCRYPTED_CONTENT_CHARS = 64 * 1024; // 64KB ciphertext JSON cap (DoS bound)

// Get conversation messages (strictly unexpired)
chatRouter.get('/conversations/:conversationId/messages', requireAuth, readLimiter, (req: AuthenticatedRequest, res) => {
  const { conversationId } = req.params;
  const userId = req.user!.id;

  if (typeof conversationId !== 'string' || conversationId.length > 64) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  try {
    const messages = db.getMessages(conversationId, userId);
    return res.json({ messages });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Unable to access messages' });
  }
});

// Send an end-to-end encrypted message
chatRouter.post('/messages', requireAuth, sendMessageLimiter, (req: AuthenticatedRequest, res) => {
  const { conversationId, encryptedContent } = req.body;
  const senderId = req.user!.id;

  if (!conversationId || !encryptedContent || typeof encryptedContent !== 'string') {
    return res.status(400).json({ error: 'conversationId and encryptedContent are required' });
  }

  if (typeof conversationId !== 'string' || conversationId.length > 64) {
    return res.status(400).json({ error: 'Invalid conversationId' });
  }

  if (encryptedContent.length > MAX_ENCRYPTED_CONTENT_CHARS) {
    return res.status(413).json({ error: 'Message payload too large' });
  }

  try {
    const message = db.sendMessage(conversationId, senderId, encryptedContent);

    // Determine recipient
    const conv = db.getConversationById(conversationId);
    if (conv) {
      const recipientId = conv.user_one_id === senderId ? conv.user_two_id : conv.user_one_id;
      // Real-time dispatch via active WebSocket connection (foreground-only, NO push notifications)
      notifyUserWebSocket(recipientId, {
        type: 'message:new',
        message,
      });
    }

    return res.status(201).json({ message });
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Failed to send message' });
  }
});

// Trigger server-side message purge (also runs every 30s in background timer)
chatRouter.post('/cleanup', requireAuth, readLimiter, (_req, res) => {
  const purgedCount = db.purgeExpiredMessages();
  return res.json({
    success: true,
    purgedCount,
    message: `Cleanup completed. Permanently removed ${purgedCount} expired messages.`,
  });
});
