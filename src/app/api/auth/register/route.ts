import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // Check duplicate
    const existing = await query(
      'SELECT user_id FROM users WHERE email = $1 OR username = $2',
      [cleanEmail, cleanUsername]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Username or email already in use' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const insertRes = await query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'PLAYER')
       RETURNING user_id, username, email, role`,
      [cleanUsername, cleanEmail, passwordHash]
    );

    const newUser = insertRes.rows[0];
    const sessionPayload = {
      userId: newUser.user_id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    };

    const token = await createSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
    }, { status: 201 });

    response.cookies.set({
      name: 'chessbase_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 });
  }
}

