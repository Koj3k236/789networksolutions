import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AccessGuard, assertRole } from '../api/dist/common/security';

describe('Security - assertRole', () => {
  it('should allow role in allowed list', () => {
    expect(() => assertRole('SUPER_ADMIN', ['SUPER_ADMIN', 'OPERATIONS_ADMIN'])).not.toThrow();
  });

  it('should reject role not in allowed list', () => {
    expect(() => assertRole('CUSTOMER', ['SUPER_ADMIN', 'OPERATIONS_ADMIN']))
      .toThrow(ForbiddenException);
  });

  it('should have correct error message', () => {
    try {
      assertRole('CUSTOMER', ['SUPER_ADMIN']);
    } catch (e: any) {
      expect(e.message).toBe('This action requires an authorized administrator.');
    }
  });
});

describe('Security - AccessGuard', () => {
  let guard: AccessGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let prismaService: any;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = {
      verify: vi.fn(),
    } as any;
    prismaService = {
      refreshToken: {
        findUnique: vi.fn(),
      },
    };
    guard = new AccessGuard(reflector, jwtService, prismaService);

    // Mock execution context
    mockContext = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn(() => ({
        getRequest: vi.fn(() => ({
          headers: {},
          user: undefined,
        })),
      })),
    } as any;
  });

  it('should allow public routes', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    
    const result = await guard.canActivate(mockContext);
    
    expect(result).toBe(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('should reject missing authorization header', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const req = { headers: {}, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject invalid JWT token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockImplementation(() => {
      throw new Error('Invalid token');
    });
    
    const req = { headers: { authorization: 'Bearer invalid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject expired session', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000), // Expired
      user: {
        id: 'user-id',
        organizationId: 'org-id',
        role: 'CUSTOMER',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'APPROVED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(mockContext)).rejects.toThrow('Session expired.');
  });

  it('should reject revoked session', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: new Date(), // Revoked
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'user-id',
        organizationId: 'org-id',
        role: 'CUSTOMER',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'APPROVED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject non-existent session', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue(null);

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject session with mismatched userId', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'different-user-id', // Mismatch
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'different-user-id',
        organizationId: 'org-id',
        role: 'CUSTOMER',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'APPROVED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject suspended organization', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'user-id',
        organizationId: 'org-id',
        role: 'CUSTOMER',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'SUSPENDED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockContext)).rejects.toThrow('This account is not permitted to access the platform.');
  });

  it('should reject rejected organization', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'user-id',
        organizationId: 'org-id',
        role: 'CUSTOMER',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'REJECTED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  it('should reject wrong role', async () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // Not public
      .mockReturnValueOnce(['SUPER_ADMIN', 'OPERATIONS_ADMIN']); // Required roles
    
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'user-id',
        organizationId: 'org-id',
        role: 'CUSTOMER', // Wrong role
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'APPROVED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  it('should allow valid session with correct role', async () => {
    vi.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // Not public
      .mockReturnValueOnce(['SUPER_ADMIN']); // Required roles
    
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'user-id',
        organizationId: 'org-id',
        role: 'SUPER_ADMIN',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'APPROVED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    const result = await guard.canActivate(mockContext);
    
    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user-id',
      organizationId: 'org-id',
      role: 'SUPER_ADMIN',
      email: 'test@example.com',
      fullName: 'Test User',
      emailVerified: true,
    });
  });

  it('should derive tenant from DB session not JWT claims', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    
    // JWT claims have wrong org ID
    vi.mocked(jwtService.verify).mockReturnValue({ 
      sub: 'user-id', 
      sid: 'session-id',
      organizationId: 'fake-org-id', // This should be ignored
    });
    
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'user-id',
        organizationId: 'real-org-id', // This should be used
        role: 'CUSTOMER',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'APPROVED' },
      },
    });

    const req = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await guard.canActivate(mockContext);
    
    // Verify tenant is from DB, not JWT
    expect(req.user.organizationId).toBe('real-org-id');
  });

  it('should strip Bearer prefix from authorization header', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    vi.mocked(jwtService.verify).mockReturnValue({ sub: 'user-id', sid: 'session-id' });
    vi.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: {
        id: 'user-id',
        organizationId: 'org-id',
        role: 'CUSTOMER',
        email: 'test@example.com',
        fullName: 'Test User',
        emailVerified: true,
        organization: { status: 'APPROVED' },
      },
    });

    const req = { headers: { authorization: 'Bearer my-jwt-token' }, user: undefined };
    mockContext.switchToHttp = vi.fn(() => ({ getRequest: () => req })) as any;

    await guard.canActivate(mockContext);
    
    expect(jwtService.verify).toHaveBeenCalledWith('my-jwt-token');
  });
});
