import express from 'express';
import { db } from './db';
import { rateLimiter, requireAuth, type AuthenticatedRequest } from './middleware';

export const connectionsRouter = express.Router();

const searchLimiter = rateLimiter(30, 60 * 1000);
const writeLimiter = rateLimiter(30, 60 * 1000);

// Search users by username
// STRICT REQUIREMENT: Only username and action returned. NO profiles, NO bios, NO photos.
connectionsRouter.get('/search', requireAuth, searchLimiter, (req: AuthenticatedRequest, res) => {
  const query = (req.query.q as string) || '';
  const currentUserId = req.user!.id;

  if (!query || query.trim().length < 2) {
    return res.json({ results: [] });
  }
  if (query.trim().length > 32) {
    return res.status(400).json({ error: 'Search query too long' });
  }

  const results = db.searchUsers(query, currentUserId);
  return res.json({ results });
});

// Send connection request
connectionsRouter.post('/request', requireAuth, writeLimiter, (req: AuthenticatedRequest, res) => {
  const { recipientId, username } = req.body;
  const requesterId = req.user!.id;

  let targetId = recipientId;
  if (!targetId && username) {
    const targetUser = db.findUserByUsername(username);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    targetId = targetUser.id;
  }

  if (!targetId) {
    return res.status(400).json({ error: 'Recipient is required' });
  }

  if (targetId === requesterId) {
    return res.status(400).json({ error: 'You cannot connect with yourself' });
  }

  try {
    const connection = db.createConnectionRequest(requesterId, targetId);
    return res.status(201).json({
      success: true,
      connection,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to send connection request' });
  }
});

// View pending requests
connectionsRouter.get('/pending', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const pending = db.getPendingRequests(userId);
  return res.json(pending);
});

// Respond to pending connection request (accept or reject)
connectionsRouter.post('/respond', requireAuth, writeLimiter, (req: AuthenticatedRequest, res) => {
  const { connectionId, action } = req.body;
  const userId = req.user!.id;

  if (!connectionId || !action || !['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Valid connectionId and action (accept or reject) required' });
  }

  try {
    const connection = db.respondToConnection(connectionId, userId, action);
    return res.json({
      success: true,
      connection,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to respond to request' });
  }
});

// View accepted connections list
connectionsRouter.get('/list', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const connections = db.getAcceptedConnections(userId);
  return res.json({ connections });
});
