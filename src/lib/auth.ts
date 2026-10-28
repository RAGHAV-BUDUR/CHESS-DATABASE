/**
 * ChessBase Authentication & Role-Based Access Control (RBAC)
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'chessbase_super_secret_jwt_key_2026_pes_dbms_level3'
);

export type UserRole = 'ADMIN' | 'PLAYER';

export interface UserSession {
  userId: number;
  username: string;
  email: string;
  role: UserRole;
}

/**
 * Hash plain-text password using bcrypt (10 salt rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare candidate password with stored bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate cryptographically signed JWT token (7-day validity)
 */
export async function createSessionToken(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode JWT session token
 */
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      email: payload.email as string,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

/**
 * Extract active user session from HTTP-only request cookies
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('chessbase_session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Enforce authentication in Next.js Route Handlers
 */
export async function requireAuth(req?: NextRequest): Promise<UserSession> {
  let token: string | undefined;
  if (req) {
    token = req.cookies.get('chessbase_session')?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
  } else {
    token = cookies().get('chessbase_session')?.value;
  }

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const session = await verifySessionToken(token);
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

/**
 * Enforce Admin role in Next.js Route Handlers
 */
export async function requireAdmin(req?: NextRequest): Promise<UserSession> {
  const session = await requireAuth(req);
  if (session.role !== 'ADMIN') {
    throw new Error('FORBIDDEN');
  }
  return session;
}

