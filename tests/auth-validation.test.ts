import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from '../src/lib/auth';

describe('Security & Authentication Module', () => {
  it('hashes passwords using bcrypt and verifies correctly', async () => {
    const raw = 'SecretPassword123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2')).toBe(true);

    const valid = await verifyPassword(raw, hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword('WrongPassword', hash);
    expect(invalid).toBe(false);
  });

  it('creates and verifies cryptographically signed JWT session tokens', async () => {
    const payload = {
      userId: 42,
      username: 'grandmaster',
      email: 'gm@chessbase.local',
      role: 'ADMIN' as const,
    };

    const token = await createSessionToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(42);
    expect(decoded?.role).toBe('ADMIN');
    expect(decoded?.username).toBe('grandmaster');
  });

  it('rejects tampered or forged JWT tokens', async () => {
    const payload = {
      userId: 1,
      username: 'user',
      email: 'user@chessbase.local',
      role: 'PLAYER' as const,
    };

    const token = await createSessionToken(payload);
    const tampered = token.slice(0, -6) + 'abcdef';

    const decoded = await verifySessionToken(tampered);
    expect(decoded).toBeNull();
  });
});

