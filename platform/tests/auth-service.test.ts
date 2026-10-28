import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { AuthService } from '../api/dist/auth/auth.service';
import { hashPassword, hashToken } from '../api/dist/common/crypto';

describe('AuthService - Token Behavior', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwt: JwtService;

  beforeEach(() => {
    // Set required env vars
    process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.WEB_ORIGIN = 'https://example.com';

    mockJwt = {
      sign: vi.fn(() => 'mock-jwt-token'),
    } as any;

    mockPrisma = {
      $transaction: vi.fn((callback) => callback(mockPrisma)),
      user: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      organization: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      wallet: { create: vi.fn() },
      kycRequest: { create: vi.fn(), updateMany: vi.fn() },
      actionToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      developmentMessage: { create: vi.fn() },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      loginHistory: { create: vi.fn() },
      auditLog: { create: vi.fn() },
    };

    authService = new AuthService(mockPrisma, mockJwt);
  });

  describe('Refresh Token Rotation', () => {
    it('should rotate refresh token on successful refresh', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-id',
          organizationId: 'org-id',
          fullName: 'Test User',
          email: 'test@example.com',
          role: 'CUSTOMER',
          emailVerified: true,
          totpEnabled: false,
          organization: { status: 'APPROVED' },
        },
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockSession);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'new-session-id' });

      const result = await authService.refresh('old-token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.refreshToken).toBeDefined();
      expect(result.accessToken).toBe('mock-jwt-token');
    });

    it('should reject already-rotated session (single-use)', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-id',
          organizationId: 'org-id',
          fullName: 'Test User',
          email: 'test@example.com',
          role: 'CUSTOMER',
          emailVerified: true,
          totpEnabled: false,
          organization: { status: 'APPROVED' },
        },
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockSession);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 }); // Already revoked

      await expect(authService.refresh('token')).rejects.toThrow(UnauthorizedException);
      await expect(authService.refresh('token')).rejects.toThrow('Session already rotated.');
    });

    it('should reject expired refresh token', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
        user: {
          id: 'user-id',
          organizationId: 'org-id',
          fullName: 'Test User',
          email: 'test@example.com',
          role: 'CUSTOMER',
          emailVerified: true,
          totpEnabled: false,
          organization: { status: 'APPROVED' },
        },
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockSession);

      await expect(authService.refresh('token')).rejects.toThrow(UnauthorizedException);
      await expect(authService.refresh('token')).rejects.toThrow('Session expired.');
    });

    it('should reject revoked refresh token', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: new Date(), // Already revoked
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-id',
          organizationId: 'org-id',
          fullName: 'Test User',
          email: 'test@example.com',
          role: 'CUSTOMER',
          emailVerified: true,
          totpEnabled: false,
          organization: { status: 'APPROVED' },
        },
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockSession);

      await expect(authService.refresh('token')).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh for suspended organization', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-id',
          organizationId: 'org-id',
          fullName: 'Test User',
          email: 'test@example.com',
          role: 'CUSTOMER',
          emailVerified: true,
          totpEnabled: false,
          organization: { status: 'SUSPENDED' },
        },
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockSession);

      await expect(authService.refresh('token')).rejects.toThrow(ForbiddenException);
      await expect(authService.refresh('token')).rejects.toThrow('Account access is restricted.');
    });
  });

  describe('Action Token Single-Use (Verify)', () => {
    it('should consume verify token on first use', async () => {
      const mockToken = {
        id: 'token-id',
        userId: 'user-id',
        purpose: 'VERIFY',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      };

      const mockUser = {
        id: 'user-id',
        organizationId: 'org-id',
        emailVerified: false,
      };

      mockPrisma.actionToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.actionToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.organization.updateMany.mockResolvedValue({ count: 1 });

      const result = await authService.verify('test-token');

      expect(mockPrisma.actionToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-id', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(result.message).toContain('Email verified');
    });

    it('should reject already-used verify token', async () => {
      const mockToken = {
        id: 'token-id',
        userId: 'user-id',
        purpose: 'VERIFY',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrisma.actionToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.actionToken.updateMany.mockResolvedValue({ count: 0 }); // Already used

      await expect(authService.verify('test-token')).rejects.toThrow(BadRequestException);
      await expect(authService.verify('test-token')).rejects.toThrow('Link already used.');
    });

    it('should reject expired verify token', async () => {
      const mockToken = {
        id: 'token-id',
        userId: 'user-id',
        purpose: 'VERIFY',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockPrisma.actionToken.findUnique.mockResolvedValue(mockToken);

      await expect(authService.verify('test-token')).rejects.toThrow(BadRequestException);
      await expect(authService.verify('test-token')).rejects.toThrow('Verification link is invalid or expired.');
    });

    it('should reject token with wrong purpose', async () => {
      const mockToken = {
        id: 'token-id',
        userId: 'user-id',
        purpose: 'RESET', // Wrong purpose
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrisma.actionToken.findUnique.mockResolvedValue(mockToken);

      await expect(authService.verify('test-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('Action Token Single-Use (Reset)', () => {
    it('should consume reset token and revoke all sessions', async () => {
      const mockToken = {
        id: 'token-id',
        userId: 'user-id',
        purpose: 'RESET',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      };

      const mockUser = {
        id: 'user-id',
        organizationId: 'org-id',
      };

      mockPrisma.actionToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.actionToken.updateMany.mockResolvedValueOnce({ count: 1 }); // First call for consuming token
      mockPrisma.actionToken.updateMany.mockResolvedValueOnce({ count: 2 }); // Second call for invalidating other reset tokens
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await authService.reset('test-token', 'NewPassword123!');

      // Verify token consumed
      expect(mockPrisma.actionToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-id', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      // Verify all sessions revoked
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });

      // Verify other reset tokens invalidated
      expect(mockPrisma.actionToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', purpose: 'RESET', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      expect(result.message).toContain('Password updated');
    });

    it('should reject already-used reset token', async () => {
      const mockToken = {
        id: 'token-id',
        userId: 'user-id',
        purpose: 'RESET',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrisma.actionToken.findUnique.mockResolvedValue(mockToken);
      mockPrisma.actionToken.updateMany.mockResolvedValue({ count: 0 }); // Already used

      await expect(authService.reset('test-token', 'NewPassword123!')).rejects.toThrow(BadRequestException);
      await expect(authService.reset('test-token', 'NewPassword123!')).rejects.toThrow('Link already used.');
    });

    it('should reject expired reset token', async () => {
      const mockToken = {
        id: 'token-id',
        userId: 'user-id',
        purpose: 'RESET',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockPrisma.actionToken.findUnique.mockResolvedValue(mockToken);

      await expect(authService.reset('test-token', 'NewPassword123!')).rejects.toThrow(BadRequestException);
      await expect(authService.reset('test-token', 'NewPassword123!')).rejects.toThrow('Reset link is invalid or expired.');
    });
  });

  describe('Login Security', () => {
    it('should reject login for suspended organization', async () => {
      const passwordHash = await hashPassword('Password123!');
      const mockUser = {
        id: 'user-id',
        organizationId: 'org-id',
        email: 'test@example.com',
        passwordHash,
        totpEnabled: false,
        organization: { status: 'SUSPENDED' },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(authService.login(
        { email: 'test@example.com', password: 'Password123!' },
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow(ForbiddenException);
      await expect(authService.login(
        { email: 'test@example.com', password: 'Password123!' },
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow('Account access is restricted.');
    });

    it('should reject login for rejected organization', async () => {
      const passwordHash = await hashPassword('Password123!');
      const mockUser = {
        id: 'user-id',
        organizationId: 'org-id',
        email: 'test@example.com',
        passwordHash,
        totpEnabled: false,
        organization: { status: 'REJECTED' },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(authService.login(
        { email: 'test@example.com', password: 'Password123!' },
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow(ForbiddenException);
    });

    it('should log failed login attempt', async () => {
      const passwordHash = await hashPassword('CorrectPassword');
      const mockUser = {
        id: 'user-id',
        organizationId: 'org-id',
        email: 'test@example.com',
        passwordHash,
        totpEnabled: false,
        organization: { status: 'APPROVED' },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.loginHistory.create.mockResolvedValue({});

      await expect(authService.login(
        { email: 'test@example.com', password: 'WrongPassword' },
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.loginHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          successful: false,
        },
      });
    });

    it('should use timing-safe password comparison', async () => {
      // Even for non-existent users, should perform hash comparison
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const start = Date.now();
      await expect(authService.login(
        { email: 'nonexistent@example.com', password: 'Password123!' },
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow(UnauthorizedException);
      const duration = Date.now() - start;

      // Should take some time due to scrypt comparison
      expect(duration).toBeGreaterThan(10);
    });
  });

  describe('Registration', () => {
    it('should reject registration without terms acceptance', async () => {
      await expect(authService.register(
        {
          email: 'test@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+1234567890',
          address: '123 Test St',
          acceptTerms: false, // Not accepted
        },
        '127.0.0.1'
      )).rejects.toThrow(BadRequestException);
      await expect(authService.register(
        {
          email: 'test@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+1234567890',
          address: '123 Test St',
          acceptTerms: false,
        },
        '127.0.0.1'
      )).rejects.toThrow('Accept the terms and acceptable use policy.');
    });

    it('should reject registration with mismatched passwords', async () => {
      await expect(authService.register(
        {
          email: 'test@example.com',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+1234567890',
          address: '123 Test St',
          acceptTerms: true,
        },
        '127.0.0.1'
      )).rejects.toThrow(BadRequestException);
      await expect(authService.register(
        {
          email: 'test@example.com',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+1234567890',
          address: '123 Test St',
          acceptTerms: true,
        },
        '127.0.0.1'
      )).rejects.toThrow('Passwords do not match.');
    });

    it('should reject duplicate email', async () => {
      // Create a proper Prisma error using the actual class
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '6.19.2' }
      );
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      await expect(authService.register(
        {
          email: 'existing@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+1234567890',
          address: '123 Test St',
          acceptTerms: true,
        },
        '127.0.0.1'
      )).rejects.toThrow(ConflictException);
    });
  });
});
