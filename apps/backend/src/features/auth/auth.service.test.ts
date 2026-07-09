import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService, authTestUtils } from './auth.service';

function createService(prisma: unknown) {
  return new AuthService(
    {
      getOrThrow: vi.fn(),
    } as never,
    {
      signAsync: vi.fn(),
    } as never,
    prisma as never,
  );
}

describe('AuthService', () => {
  it('normalizes email addresses before lookup', () => {
    expect(authTestUtils.normalizeEmail('  USER@Example.COM ')).toBe('user@example.com');
  });

  it('parses supported token durations in seconds', () => {
    expect(authTestUtils.parseDurationSeconds('15m')).toBe(900);
    expect(authTestUtils.parseDurationSeconds('30d')).toBe(2_592_000);
  });

  it('serializes users without password hashes or deleted timestamps', () => {
    const service = createService({});
    const safeUser = service.toSafeUser({
      createdAt: new Date('2026-07-10T10:00:00.000Z'),
      deletedAt: null,
      displayName: 'Daoud',
      email: 'daoud@example.com',
      id: 'user_1',
      passwordHash: 'secret-hash',
      role: 'USER',
      updatedAt: new Date('2026-07-10T10:05:00.000Z'),
    });

    expect(safeUser).toEqual({
      createdAt: '2026-07-10T10:00:00.000Z',
      displayName: 'Daoud',
      email: 'daoud@example.com',
      id: 'user_1',
      role: 'USER',
      updatedAt: '2026-07-10T10:05:00.000Z',
    });
    expect(safeUser).not.toHaveProperty('passwordHash');
    expect(safeUser).not.toHaveProperty('deletedAt');
  });

  it('rejects duplicate registration emails after normalization', async () => {
    const prisma = {
      user: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: 'existing_user' }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.register(
        {
          email: 'USER@Example.COM',
          password: 'Password123',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
