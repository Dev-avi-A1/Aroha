import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { isDisposableEmail } from '../lib/email-guard.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUserId?: number;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
    return;
  }

  if (decodedToken.email && isDisposableEmail(decodedToken.email)) {
    res.status(403).json({
      error: 'Temporary or disposable email addresses are not permitted.',
    });
    return;
  }

  req.user = decodedToken;

  try {
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name,
      decodedToken.picture
    );
    req.dbUserId = dbUser.id;
    next();
  } catch (error) {
    console.error('Database error initializing user workspace:', error);
    res.status(503).json({ error: 'Workspace database is temporarily unavailable. Please retry in a moment.' });
  }
};
