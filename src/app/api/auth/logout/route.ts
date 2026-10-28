import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.set({
    name: 'chessbase_session',
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}

