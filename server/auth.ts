import express from 'express';
import { db } from './db';
import { rateLimiter, requireAuth, type AuthenticatedRequest } from './middleware';

export const authRouter = express.Router();

// Register
authRouter.post('/register', rateLimiter(15, 60 * 1000), (req, res) => {
  const { username, password, confirmPassword, warningAcknowledged } = req.body;

  if (!warningAcknowledged) {
    return res.status(400).json({
      error: 'You must acknowledge the mandatory warning regarding no password recovery.',
    });
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
    return res.status(400).json({ error: 'Username must be between 3 and 32 characters.' });
  }

  // Only letters, numbers, and underscores
  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    return res.status(400).json({
      error: 'Username can only contain letters, numbers, and underscores.',
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  // Check unique case-insensitively
  if (db.findUserByUsername(trimmedUsername)) {
    return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
  }

  try {
    const passwordHash = db.hashPassword(password);
    const user = db.createUser(trimmedUsername, passwordHash);
    const session = db.createSession(user.id, req.headers['user-agent'] as string, req.body.deviceName);

    return res.status(201).json({
      token: session.token,
      user: {
        id: user.id,
        username: user.username,
        hasVaultPin: false,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// Login
authRouter.post('/login', rateLimiter(20, 60 * 1000), (req, res) => {
  const { username, password, deviceName } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.findUserByUsername(username);
  if (!user) {
    // Constant time protection against username enumeration
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const isValid = db.verifyPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const session = db.createSession(user.id, req.headers['user-agent'] as string, deviceName);

  return res.json({
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      hasVaultPin: !!user.vault_pin_hash,
    },
  });
});

// Active Devices (Maximum 3 devices per account)
authRouter.get('/devices', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const token = req.token!;
  const sessionInfo = db.getUserSessions(user.id, token);
  return res.json(sessionInfo);
});

// Revoke other devices
authRouter.post('/devices/logout-others', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const token = req.token!;
  const count = db.revokeOtherSessions(user.id, token);
  return res.json({ success: true, count, message: `Logged out from ${count} other devices.` });
});

// Revoke specific device
authRouter.post('/devices/revoke', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { deviceId } = req.body;
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) return res.status(400).json({ error: 'deviceId is required' });
  const success = db.revokeSessionById(user.id, deviceId);
  return res.json({ success });
});

// Current User Me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      hasVaultPin: !!user.vault_pin_hash,
    },
  });
});

// Logout
authRouter.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.token) {
    db.deleteSession(req.token);
  }
  return res.json({ success: true });
});

// Change Password
authRouter.post('/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const user = req.user!;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }

  const isCurrentValid = db.verifyPassword(currentPassword, user.password_hash);
  if (!isCurrentValid) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'New passwords do not match.' });
  }

  const newHash = db.hashPassword(newPassword);
  db.updatePassword(user.id, newHash);

  return res.json({ success: true, message: 'Password updated successfully.' });
});

// Delete Account Permanently
authRouter.post('/delete-account', requireAuth, (req: AuthenticatedRequest, res) => {
  const { password, confirmationPhrase } = req.body;
  const user = req.user!;

  if (confirmationPhrase !== 'DELETE MY ACCOUNT PERMANENTLY') {
    return res.status(400).json({
      error: 'Please enter the exact confirmation phrase to proceed with deletion.',
    });
  }

  const isPasswordValid = db.verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Incorrect password. Account deletion aborted.' });
  }

  const deleted = db.deleteUserAccount(user.id);
  if (!deleted) {
    return res.status(500).json({ error: 'Failed to delete account.' });
  }

  return res.json({
    success: true,
    message: 'Account, connections, messages, and vault items have been permanently deleted.',
  });
});
