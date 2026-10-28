import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Security Code Review', () => {
  const apiSrcPath = join(__dirname, '../api/src');

  describe('Password Security', () => {
    it('should use scrypt for password hashing', () => {
      const cryptoFile = readFileSync(join(apiSrcPath, 'common/crypto.ts'), 'utf-8');
      
      expect(cryptoFile).toContain('scrypt');
      expect(cryptoFile).toContain('timingSafeEqual');
      expect(cryptoFile).not.toContain('bcrypt');
      expect(cryptoFile).not.toContain('md5');
      expect(cryptoFile).not.toContain('sha1');
    });

    it('should use random salts', () => {
      const cryptoFile = readFileSync(join(apiSrcPath, 'common/crypto.ts'), 'utf-8');
      
      expect(cryptoFile).toContain('randomBytes(16)');
    });
  });

  describe('Encryption Security', () => {
    it('should use AES-256-GCM', () => {
      const cryptoFile = readFileSync(join(apiSrcPath, 'common/crypto.ts'), 'utf-8');
      
      expect(cryptoFile).toContain('aes-256-gcm');
      expect(cryptoFile).toContain('getAuthTag');
      expect(cryptoFile).toContain('setAuthTag');
    });

    it('should use random IVs', () => {
      const cryptoFile = readFileSync(join(apiSrcPath, 'common/crypto.ts'), 'utf-8');
      
      expect(cryptoFile).toContain('randomBytes(12)'); // 12 bytes for GCM IV
    });

    it('should validate encryption key length', () => {
      const cryptoFile = readFileSync(join(apiSrcPath, 'common/crypto.ts'), 'utf-8');
      
      expect(cryptoFile).toContain('key.length !== 32');
      expect(cryptoFile).toContain('DATA_ENCRYPTION_KEY must be a 32-byte hex key');
    });
  });

  describe('Session Security', () => {
    it('should hash refresh tokens before storage', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('hashToken(token)');
      expect(authServiceFile).not.toContain('refreshToken.create({data:{userId:user.id,token:');
    });

    it('should implement token rotation', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('revokedAt');
      expect(authServiceFile).toContain('Session already rotated');
    });

    it('should check session expiration', () => {
      const securityFile = readFileSync(join(apiSrcPath, 'common/security.ts'), 'utf-8');
      
      expect(securityFile).toContain('expiresAt < new Date()');
      expect(securityFile).toContain('Session expired');
    });

    it('should validate session ownership', () => {
      const securityFile = readFileSync(join(apiSrcPath, 'common/security.ts'), 'utf-8');
      
      expect(securityFile).toContain('session.userId !== claims.sub');
    });
  });

  describe('Authorization Security', () => {
    it('should check organization status', () => {
      const securityFile = readFileSync(join(apiSrcPath, 'common/security.ts'), 'utf-8');
      
      expect(securityFile).toContain('SUSPENDED');
      expect(securityFile).toContain('REJECTED');
      expect(securityFile).toContain('not permitted to access the platform');
    });

    it('should derive tenant from database', () => {
      const securityFile = readFileSync(join(apiSrcPath, 'common/security.ts'), 'utf-8');
      
      // Should get organizationId from user.organizationId, not from JWT claims
      expect(securityFile).toContain('user.organizationId');
      expect(securityFile).toContain('req.user = {');
    });

    it('should enforce role-based access', () => {
      const securityFile = readFileSync(join(apiSrcPath, 'common/security.ts'), 'utf-8');
      
      expect(securityFile).toContain('assertRole');
      expect(securityFile).toContain('ForbiddenException');
    });
  });

  describe('Action Token Security', () => {
    it('should implement single-use tokens', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('usedAt');
      expect(authServiceFile).toContain('Link already used');
      expect(authServiceFile).toContain('updateMany({where:{id:t.id,usedAt:null}');
    });

    it('should check token expiration', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('expiresAt < new Date()');
      expect(authServiceFile).toContain('invalid or expired');
    });

    it('should validate token purpose', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('purpose');
      expect(authServiceFile).toContain('VERIFY');
      expect(authServiceFile).toContain('RESET');
    });
  });

  describe('Admin Security', () => {
    it('should prevent admin self-modification', () => {
      const portalServiceFile = readFileSync(join(apiSrcPath, 'portal/portal.service.ts'), 'utf-8');
      
      expect(portalServiceFile).toContain('id===user.organizationId');
      expect(portalServiceFile).toContain('cannot change their own organization');
    });

    it('should prevent approval without email verification', () => {
      const portalServiceFile = readFileSync(join(apiSrcPath, 'portal/portal.service.ts'), 'utf-8');
      
      expect(portalServiceFile).toContain('emailVerified');
      expect(portalServiceFile).toContain('verify their email first');
    });

    it('should revoke sessions on suspension', () => {
      const portalServiceFile = readFileSync(join(apiSrcPath, 'portal/portal.service.ts'), 'utf-8');
      
      expect(portalServiceFile).toContain('SUSPENDED');
      expect(portalServiceFile).toContain('refreshToken.updateMany');
      expect(portalServiceFile).toContain('revokedAt');
    });
  });

  describe('Input Validation', () => {
    it('should use class-validator', () => {
      const mainFile = readFileSync(join(apiSrcPath, 'main.ts'), 'utf-8');
      
      expect(mainFile).toContain('ValidationPipe');
      expect(mainFile).toContain('whitelist:true');
      expect(mainFile).toContain('forbidNonWhitelisted:true');
    });

    it('should sanitize email input', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('toLowerCase()');
      expect(authServiceFile).toContain('trim()');
    });
  });

  describe('CSRF Protection', () => {
    it('should validate origin for state-changing requests', () => {
      const mainFile = readFileSync(join(apiSrcPath, 'main.ts'), 'utf-8');
      
      expect(mainFile).toContain('req.headers.origin');
      expect(mainFile).toContain('WEB_ORIGIN');
      expect(mainFile).toContain('Request origin is not allowed');
    });

    it('should use httpOnly cookies', () => {
      const authControllerFile = readFileSync(join(apiSrcPath, 'auth/auth.controller.ts'), 'utf-8');
      
      expect(authControllerFile).toContain('httpOnly:true');
      expect(authControllerFile).toContain('sameSite');
    });
  });

  describe('Rate Limiting', () => {
    it('should throttle sensitive endpoints', () => {
      const authControllerFile = readFileSync(join(apiSrcPath, 'auth/auth.controller.ts'), 'utf-8');
      
      expect(authControllerFile).toContain('@Throttle');
      expect(authControllerFile).toContain('limit:');
    });
  });

  describe('Production Safety', () => {
    it('should enforce fail-closed mode', () => {
      const mainFile = readFileSync(join(apiSrcPath, 'main.ts'), 'utf-8');
      
      expect(mainFile).toContain('APP_MODE');
      expect(mainFile).toContain('DEMO');
      expect(mainFile).toContain('only DEMO mode is implemented');
    });

    it('should require secure environment variables', () => {
      const mainFile = readFileSync(join(apiSrcPath, 'main.ts'), 'utf-8');
      
      expect(mainFile).toContain('DATABASE_URL is required');
      expect(mainFile).toContain('JWT_SECRET');
      expect(mainFile).toContain('DATA_ENCRYPTION_KEY');
      expect(mainFile).toContain('WEB_ORIGIN is required');
    });

    it('should enforce secure cookies in production', () => {
      const mainFile = readFileSync(join(apiSrcPath, 'main.ts'), 'utf-8');
      
      expect(mainFile).toContain('COOKIE_SECURE');
      expect(mainFile).toContain('production');
    });
  });

  describe('Sensitive Data Handling', () => {
    it('should encrypt sensitive fields', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('encrypt(');
      expect(authServiceFile).toContain('Encrypted');
    });

    it('should not log sensitive data', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).not.toContain('console.log(password');
      expect(authServiceFile).not.toContain('console.log(token');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should use Prisma parameterized queries', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      // Should use Prisma methods, not raw SQL
      expect(authServiceFile).toContain('findUnique');
      expect(authServiceFile).toContain('create');
      expect(authServiceFile).toContain('update');
      expect(authServiceFile).not.toContain('SELECT * FROM users WHERE email =');
    });
  });

  describe('TOTP Security', () => {
    it('should prevent TOTP replay attacks', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('totpLastStep');
      expect(authServiceFile).toContain('Code already used');
      expect(authServiceFile).toContain('step <= user.totpLastStep');
    });

    it('should use optimistic locking for TOTP', () => {
      const authServiceFile = readFileSync(join(apiSrcPath, 'auth/auth.service.ts'), 'utf-8');
      
      expect(authServiceFile).toContain('updateMany');
      expect(authServiceFile).toContain('OR:[{totpLastStep:null},{totpLastStep:{lt:step}}]');
    });
  });
});


