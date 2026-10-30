import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TrunksService } from '../api/dist/trunks/trunks.service';
import { normalizePublicCidr, validateSipHost, generateSipCredential, validateTrunkLimits } from '../api/dist/trunks/policy';
import { decrypt } from '../api/dist/common/crypto';
import { createHash } from 'node:crypto';

// Set synthetic encryption key for tests only
process.env.DATA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('SIP Trunk Module - Unit Tests (Mocked Prisma)', () => {
  describe('Policy - normalizePublicCidr', () => {
    it('should normalize valid IPv4 address to /32 CIDR', () => {
      expect(normalizePublicCidr('8.8.8.8')).toBe('8.8.8.8/32');
    });

    it('should normalize valid IPv4 CIDR', () => {
      expect(normalizePublicCidr('8.8.8.0/24')).toBe('8.8.8.0/24');
    });

    it('should normalize valid IPv6 address to /128 CIDR', () => {
      expect(normalizePublicCidr('2001:4860:4860::8888')).toBe('2001:4860:4860::8888/128');
    });

    it('should normalize valid IPv6 CIDR', () => {
      expect(normalizePublicCidr('2001:4860:4860::/64')).toBe('2001:4860:4860::/64');
    });

    it('should reject private IPv4 addresses (10.0.0.0/8)', () => {
      expect(() => normalizePublicCidr('10.0.0.1')).toThrow('Only public networks are allowed');
    });

    it('should reject private IPv4 addresses (192.168.0.0/16)', () => {
      expect(() => normalizePublicCidr('192.168.1.1')).toThrow('Only public networks are allowed');
    });

    it('should reject private IPv4 addresses (172.16.0.0/12)', () => {
      expect(() => normalizePublicCidr('172.16.0.1')).toThrow('Only public networks are allowed');
    });

    it('should reject localhost (127.0.0.0/8)', () => {
      expect(() => normalizePublicCidr('127.0.0.1')).toThrow('Only public networks are allowed');
    });

    it('should reject link-local (169.254.0.0/16)', () => {
      expect(() => normalizePublicCidr('169.254.1.1')).toThrow('Only public networks are allowed');
    });

    it('should reject multicast (224.0.0.0/4)', () => {
      expect(() => normalizePublicCidr('224.0.0.1')).toThrow('Only public networks are allowed');
    });

    it('should reject reserved IPv6 (fc00::/7)', () => {
      expect(() => normalizePublicCidr('fc00::1')).toThrow('Only public networks are allowed');
    });

    it('should reject link-local IPv6 (fe80::/10)', () => {
      expect(() => normalizePublicCidr('fe80::1')).toThrow('Only public networks are allowed');
    });

    it('should reject multicast IPv6 (ff00::/8)', () => {
      expect(() => normalizePublicCidr('ff00::1')).toThrow('Only public networks are allowed');
    });

    it('should reject CIDR with whitespace', () => {
      expect(() => normalizePublicCidr('8.8.8.8 /32')).toThrow('without whitespace');
    });

    it('should reject CIDR with percent encoding', () => {
      expect(() => normalizePublicCidr('8.8.8.8%2F32')).toThrow('without whitespace');
    });

    it('should reject too long input (>80 chars)', () => {
      expect(() => normalizePublicCidr('a'.repeat(81))).toThrow('without whitespace');
    });

    it('should reject prefix smaller than /8 for IPv4', () => {
      expect(() => normalizePublicCidr('8.0.0.0/7')).toThrow('minimum prefix is /8 for IPv4');
    });

    it('should reject prefix smaller than /32 for IPv6', () => {
      expect(() => normalizePublicCidr('2001:4860::/31')).toThrow('minimum prefix is /8 for IPv4 or /32 for IPv6');
    });

    it('should reject non-unicast addresses', () => {
      expect(() => normalizePublicCidr('0.0.0.0')).toThrow('Only public networks are allowed');
    });

    it('should canonicalize CIDR by zeroing host bits', () => {
      expect(normalizePublicCidr('8.8.8.255/24')).toBe('8.8.8.0/24');
    });

    it('should handle IPv4-mapped IPv6 addresses as reserved', () => {
      expect(() => normalizePublicCidr('::ffff:192.168.1.1')).toThrow('Only public networks are allowed');
    });
  });

  describe('Policy - validateSipHost', () => {
    it('should validate and lowercase valid hostname', () => {
      expect(validateSipHost('sip.example.com')).toBe('sip.example.com');
      expect(validateSipHost('SIP.EXAMPLE.COM')).toBe('sip.example.com');
    });

    it('should validate hostname with hyphens', () => {
      expect(validateSipHost('sip-trunk.example.com')).toBe('sip-trunk.example.com');
    });

    it('should validate single-label hostname', () => {
      expect(validateSipHost('localhost')).toBe('localhost');
    });

    it('should reject hostname with port', () => {
      expect(() => validateSipHost('sip.example.com:5060')).toThrow('not a URL, userinfo, or port');
    });

    it('should reject hostname with userinfo', () => {
      expect(() => validateSipHost('user@sip.example.com')).toThrow('not a URL, userinfo, or port');
    });

    it('should reject hostname with scheme', () => {
      expect(() => validateSipHost('sip:sip.example.com')).toThrow('not a URL, userinfo, or port');
    });

    it('should reject hostname longer than 253 characters', () => {
      expect(() => validateSipHost('a'.repeat(254))).toThrow('not a URL, userinfo, or port');
    });

    it('should reject hostname with invalid characters', () => {
      expect(() => validateSipHost('sip_example.com')).toThrow('not a URL, userinfo, or port');
    });

    it('should reject hostname starting with hyphen', () => {
      expect(() => validateSipHost('-sip.example.com')).toThrow('not a URL, userinfo, or port');
    });

    it('should reject hostname ending with hyphen', () => {
      expect(() => validateSipHost('sip-.example.com')).toThrow('not a URL, userinfo, or port');
    });
  });

  describe('Policy - generateSipCredential', () => {
    it('should generate credential with username, password, and SHA-256 digest', () => {
      const result = generateSipCredential('sip.example.com');
      
      expect(result.persisted.username).toMatch(/^789_[a-f0-9]{24}$/);
      expect(result.persisted.realm).toBe('sip.example.com');
      expect(result.persisted.algorithm).toBe('SHA-256');
      expect(result.persisted.digestEncrypted).toMatch(/^[a-f0-9]+\.[a-f0-9]+\.[a-f0-9]+$/);
      expect(result.persisted.rotatedAt).toBeInstanceOf(Date);

      expect(result.reveal.username).toBe(result.persisted.username);
      expect(result.reveal.password).toMatch(/^[A-Za-z0-9_-]{43}$/); // base64url 32 bytes
      expect(result.reveal.realm).toBe('sip.example.com');
      expect(result.reveal.algorithm).toBe('SHA-256');
      expect(result.reveal.oneTime).toBe(true);
    });

    it('should generate unique passwords for same realm', () => {
      const result1 = generateSipCredential('sip.example.com');
      const result2 = generateSipCredential('sip.example.com');
      
      expect(result1.reveal.password).not.toBe(result2.reveal.password);
      expect(result1.persisted.username).not.toBe(result2.persisted.username);
    });

    it('should reuse existing username when provided', () => {
      const existingUsername = '789_test123';
      const result = generateSipCredential('sip.example.com', existingUsername);
      
      expect(result.persisted.username).toBe(existingUsername);
      expect(result.reveal.username).toBe(existingUsername);
    });

    it('should encrypt SHA-256 digest, not plaintext password', () => {
      const result = generateSipCredential('sip.example.com');
      
      // Decrypt the stored digest
      const decryptedDigest = decrypt(result.persisted.digestEncrypted);
      
      // Verify it's a SHA-256 hash (64 hex characters)
      expect(decryptedDigest).toMatch(/^[a-f0-9]{64}$/);
      
      // Verify it matches the expected HA1 hash
      const expectedHash = createHash('sha256')
        .update(`${result.reveal.username}:${result.reveal.realm}:${result.reveal.password}`)
        .digest('hex');
      
      expect(decryptedDigest).toBe(expectedHash);
    });

    it('should not store plaintext password in persisted data', () => {
      const result = generateSipCredential('sip.example.com');
      
      // Ensure password is not in persisted object
      expect(JSON.stringify(result.persisted)).not.toContain(result.reveal.password);
    });
  });

  describe('Policy - validateTrunkLimits', () => {
    it('should accept valid limits within account caps', () => {
      expect(() => validateTrunkLimits(10, 5, 20, 10)).not.toThrow();
    });

    it('should accept limits equal to account caps', () => {
      expect(() => validateTrunkLimits(20, 10, 20, 10)).not.toThrow();
    });

    it('should reject concurrent exceeding account cap', () => {
      expect(() => validateTrunkLimits(25, 5, 20, 10)).toThrow('within the customer account caps');
    });

    it('should reject CPS exceeding account cap', () => {
      expect(() => validateTrunkLimits(10, 15, 20, 10)).toThrow('within the customer account caps');
    });

    it('should reject zero concurrent', () => {
      expect(() => validateTrunkLimits(0, 5, 20, 10)).toThrow('positive integers');
    });

    it('should reject zero CPS', () => {
      expect(() => validateTrunkLimits(10, 0, 20, 10)).toThrow('positive integers');
    });

    it('should reject negative concurrent', () => {
      expect(() => validateTrunkLimits(-1, 5, 20, 10)).toThrow('positive integers');
    });

    it('should reject negative CPS', () => {
      expect(() => validateTrunkLimits(10, -1, 20, 10)).toThrow('positive integers');
    });

    it('should reject non-integer concurrent', () => {
      expect(() => validateTrunkLimits(10.5, 5, 20, 10)).toThrow('positive integers');
    });

    it('should reject non-integer CPS', () => {
      expect(() => validateTrunkLimits(10, 5.5, 20, 10)).toThrow('positive integers');
    });
  });

  describe('TrunksService - Unit Tests', () => {
    let service: TrunksService;
    let mockPrisma: any;
    let mockCallerIdService: any;

    const mockSuperAdmin = {
      id: 'admin-id',
      organizationId: 'admin-org-id',
      role: 'SUPER_ADMIN' as const,
      email: 'admin@example.com',
      fullName: 'Super Admin',
      emailVerified: true,
    };

    const mockOperationsAdmin = {
      id: 'ops-admin-id',
      organizationId: 'ops-org-id',
      role: 'OPERATIONS_ADMIN' as const,
      email: 'ops@example.com',
      fullName: 'Operations Admin',
      emailVerified: true,
    };

    const mockCustomer = {
      id: 'customer-id',
      organizationId: 'org-id',
      role: 'CUSTOMER' as const,
      email: 'customer@example.com',
      fullName: 'Customer User',
      emailVerified: true,
    };

    const mockOrganization = {
      id: 'org-id',
      businessName: 'Test Org',
      status: 'APPROVED',
      sipConcurrentLimit: 20,
      sipCpsLimit: 2,
    };

    const mockTrunk = {
      id: 'trunk-id',
      organizationId: 'org-id',
      name: 'Test Trunk',
      description: 'Test description',
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      enabled: false,
      mode: 'DEMO',
      authType: 'IP',
      domain: 'sip.example.com',
      transport: 'TLS',
      maxConcurrent: 10,
      cps: 1,
      callerIdPolicy: 'VERIFIED_ONLY',
      defaultCallerId: null,
      failoverUri: null,
      credentials: null,
      ips: [],
    };

    beforeEach(() => {
      mockPrisma = {
        $transaction: vi.fn((callback) => callback(mockPrisma)),
        $queryRaw: vi.fn(),
        organization: {
          findUnique: vi.fn().mockResolvedValue(mockOrganization),
          update: vi.fn(),
        },
        sipTrunk: {
          findFirst: vi.fn().mockResolvedValue(mockTrunk),
          findMany: vi.fn().mockResolvedValue([mockTrunk]),
          create: vi.fn().mockResolvedValue(mockTrunk),
          update: vi.fn().mockResolvedValue(mockTrunk),
          count: vi.fn().mockResolvedValue(0),
        },
        sipCredential: {
          create: vi.fn(),
          upsert: vi.fn(),
          deleteMany: vi.fn(),
        },
        authorizedIp: {
          create: vi.fn().mockResolvedValue({ id: 'ip-id', trunkId: 'trunk-id', cidr: '8.8.8.8/32' }),
          delete: vi.fn(),
          deleteMany: vi.fn(),
        },
        phoneNumber: {
          count: vi.fn().mockResolvedValue(0),
        },
        auditLog: {
          create: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      mockCallerIdService = {
        assertSelectable: vi.fn().mockResolvedValue('+12025550123'),
        workspace: vi.fn().mockResolvedValue({ selectableNumbers: [] }),
      };

      service = new TrunksService(mockPrisma, mockCallerIdService);
    });

    describe('RBAC - Cross-tenant access control', () => {
      it('should allow customer to access own organization', async () => {
        await expect(service.list('org-id', mockCustomer)).resolves.toBeDefined();
      });

      it('should reject customer accessing other organization', async () => {
        await expect(service.list('other-org-id', mockCustomer)).rejects.toThrow(ForbiddenException);
      });

      it('should allow SUPER_ADMIN to access any organization', async () => {
        await expect(service.list('org-id', mockSuperAdmin)).resolves.toBeDefined();
      });

      it('should allow OPERATIONS_ADMIN to access any organization', async () => {
        await expect(service.list('org-id', mockOperationsAdmin)).resolves.toBeDefined();
      });

      it('should reject customer write to other organization', async () => {
        const dto = {
          name: 'Test',
          authType: 'IP' as const,
          transport: 'TLS' as const,
          domain: 'sip.example.com',
          maxConcurrent: 10,
          cps: 1,
        };
        await expect(service.create('other-org-id', mockCustomer, dto)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Soft delete - deletedAt filtering', () => {
      it('should exclude deleted trunks from list', async () => {
        const deletedTrunk = { ...mockTrunk, deletedAt: new Date() };
        mockPrisma.sipTrunk.findMany.mockResolvedValue([mockTrunk]); // Only non-deleted
        
        const result = await service.list('org-id', mockCustomer);
        
        expect(mockPrisma.sipTrunk.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ deletedAt: null }),
          })
        );
      });

      it('should mark trunk as deleted instead of hard delete', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue(mockTrunk);
        
        await service.remove('org-id', 'trunk-id', mockCustomer, 0);
        
        expect(mockPrisma.sipTrunk.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              deletedAt: expect.any(Date),
              enabled: false,
            }),
          })
        );
      });
    });

    describe('Version conflict detection', () => {
      it('should reject update with stale version', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({ ...mockTrunk, version: 5 });
        
        const dto = {
          name: 'Updated',
          expectedVersion: 3, // Stale version
        };
        
        await expect(service.update('org-id', 'trunk-id', mockCustomer, dto)).rejects.toThrow(ConflictException);
      });

      it('should accept update with correct version', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({ ...mockTrunk, version: 3 });
        
        const dto = {
          name: 'Updated',
          expectedVersion: 3,
        };
        
        await expect(service.update('org-id', 'trunk-id', mockCustomer, dto)).resolves.toBeDefined();
      });
    });

    describe('Credential rotation', () => {
      it('should reject rotation for IP-based trunk', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({ ...mockTrunk, authType: 'IP' });
        
        await expect(service.rotate('org-id', 'trunk-id', mockCustomer, 0)).rejects.toThrow(BadRequestException);
      });

      it('should generate new credentials for CREDENTIALS trunk', async () => {
        const credentialsTrunk = {
          ...mockTrunk,
          authType: 'CREDENTIALS',
          credentials: { username: '789_old', realm: 'sip.example.com', algorithm: 'SHA-256', rotatedAt: new Date() },
        };
        mockPrisma.sipTrunk.findFirst.mockResolvedValue(credentialsTrunk);
        
        const result = await service.rotate('org-id', 'trunk-id', mockCustomer, 0);
        
        expect(result.username).toBe('789_old'); // Reused username
        expect(result.password).toBeDefined();
        expect(result.oneTime).toBe(true);
        expect(mockPrisma.sipCredential.upsert).toHaveBeenCalled();
      });

      it('should increment version on rotation', async () => {
        const credentialsTrunk = {
          ...mockTrunk,
          authType: 'CREDENTIALS',
          credentials: { username: '789_test', realm: 'sip.example.com', algorithm: 'SHA-256', rotatedAt: new Date() },
        };
        mockPrisma.sipTrunk.findFirst.mockResolvedValue(credentialsTrunk);
        
        await service.rotate('org-id', 'trunk-id', mockCustomer, 0);
        
        expect(mockPrisma.sipTrunk.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              version: { increment: 1 },
            }),
          })
        );
      });
    });

    describe('Deletion with DID blocking', () => {
      it('should reject deletion when active numbers attached', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue(mockTrunk);
        mockPrisma.phoneNumber.count.mockResolvedValue(3); // 3 active numbers
        
        await expect(service.remove('org-id', 'trunk-id', mockCustomer, 0)).rejects.toThrow(ConflictException);
      });

      it('should allow deletion when no active numbers', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue(mockTrunk);
        mockPrisma.phoneNumber.count.mockResolvedValue(0);
        
        await expect(service.remove('org-id', 'trunk-id', mockCustomer, 0)).resolves.toBeDefined();
      });
    });

    describe('CallerID validation', () => {
      it('should validate caller ID is selectable', async () => {
        mockCallerIdService.assertSelectable.mockResolvedValue('+12025550123');
        
        const dto = {
          name: 'Test',
          authType: 'IP' as const,
          transport: 'TLS' as const,
          domain: 'sip.example.com',
          maxConcurrent: 10,
          cps: 1,
          defaultCallerId: '+12025550123',
        };
        
        await service.create('org-id', mockCustomer, dto);
        
        expect(mockCallerIdService.assertSelectable).toHaveBeenCalledWith(
          mockPrisma,
          mockOrganization,
          '+12025550123'
        );
      });

      it('should reject deleted trunk caller ID', async () => {
        mockCallerIdService.assertSelectable.mockRejectedValue(new BadRequestException('Caller ID not selectable'));
        
        const dto = {
          name: 'Test',
          authType: 'IP' as const,
          transport: 'TLS' as const,
          domain: 'sip.example.com',
          maxConcurrent: 10,
          cps: 1,
          defaultCallerId: '+12025550123',
        };
        
        await expect(service.create('org-id', mockCustomer, dto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('Audit metadata', () => {
      it('should log trunk creation with metadata', async () => {
        const dto = {
          name: 'Test Trunk',
          authType: 'IP' as const,
          transport: 'TLS' as const,
          domain: 'sip.example.com',
          maxConcurrent: 10,
          cps: 1,
        };
        
        await service.create('org-id', mockCustomer, dto, '192.0.2.1');
        
        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              organizationId: 'org-id',
              actorId: 'customer-id',
              action: 'SIP_TRUNK_CREATED',
              ip: '192.0.2.1',
              metadata: expect.objectContaining({
                name: 'Test Trunk',
                authType: 'IP',
              }),
            }),
          })
        );
      });

      it('should log credential issuance separately', async () => {
        const dto = {
          name: 'Test Trunk',
          authType: 'CREDENTIALS' as const,
          transport: 'TLS' as const,
          domain: 'sip.example.com',
          maxConcurrent: 10,
          cps: 1,
        };
        
        await service.create('org-id', mockCustomer, dto);
        
        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'SIP_TRUNK_CREDENTIALS_ISSUED',
              metadata: expect.objectContaining({
                oneTimeDisclosure: true,
                algorithm: 'SHA-256',
              }),
            }),
          })
        );
      });
    });

    describe('Account limits validation', () => {
      it('should reject reducing caps below existing trunk limits', async () => {
        mockPrisma.sipTrunk.count.mockResolvedValue(1); // 1 trunk exceeds new caps
        
        const dto = {
          concurrent: 5,
          cps: 1,
          reason: 'Downgrade',
        };
        
        await expect(service.limits('org-id', mockSuperAdmin, dto)).rejects.toThrow(ConflictException);
      });

      it('should allow increasing caps', async () => {
        mockPrisma.sipTrunk.count.mockResolvedValue(0);
        
        const dto = {
          concurrent: 50,
          cps: 10,
          reason: 'Upgrade',
        };
        
        await expect(service.limits('org-id', mockSuperAdmin, dto)).resolves.toEqual({
          concurrent: 50,
          cps: 10,
        });
      });

      it('should require TRUNK_EDIT_ROLES for limits change', async () => {
        const dto = {
          concurrent: 50,
          cps: 10,
          reason: 'Upgrade',
        };
        
        await expect(service.limits('org-id', mockCustomer, dto)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('IP overlap detection', () => {
      it('should reject duplicate CIDR', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({
          ...mockTrunk,
          ips: [{ id: 'ip-1', trunkId: 'trunk-id', cidr: '8.8.8.8/32' }],
        });
        
        // Mock Prisma error that will be caught by the service
        const { Prisma } = require('@prisma/client');
        const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['trunkId', 'cidr'] },
        });
        mockPrisma.authorizedIp.create.mockRejectedValue(prismaError);
        
        const dto = {
          cidr: '8.8.8.8/32',
          expectedVersion: 0,
        };
        
        await expect(service.addIp('org-id', 'trunk-id', mockCustomer, dto)).rejects.toThrow('already exists');
      });

      it('should allow adding up to 100 IPs', async () => {
        const ips = Array.from({ length: 99 }, (_, i) => ({
          id: `ip-${i}`,
          trunkId: 'trunk-id',
          cidr: `8.8.${Math.floor(i / 256)}.${i % 256}/32`,
        }));
        
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({
          ...mockTrunk,
          ips,
        });
        
        const dto = {
          cidr: '8.8.8.100/32',
          expectedVersion: 0,
        };
        
        await expect(service.addIp('org-id', 'trunk-id', mockCustomer, dto)).resolves.toBeDefined();
      });

      it('should reject adding 101st IP', async () => {
        const ips = Array.from({ length: 100 }, (_, i) => ({
          id: `ip-${i}`,
          trunkId: 'trunk-id',
          cidr: `8.8.${Math.floor(i / 256)}.${i % 256}/32`,
        }));
        
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({
          ...mockTrunk,
          ips,
        });
        
        const dto = {
          cidr: '8.8.8.101/32',
          expectedVersion: 0,
        };
        
        await expect(service.addIp('org-id', 'trunk-id', mockCustomer, dto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('Configuration enabled vs operational', () => {
      it('should return operational: false for all trunks', async () => {
        const result = await service.list('org-id', mockCustomer);
        
        expect(result[0].operational).toBe(false);
        expect(result[0].serviceStatus).toBe('Pending Upstream Activation');
      });

      it('should reject enabling IP trunk without IPs', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({
          ...mockTrunk,
          authType: 'IP',
          ips: [],
        });
        
        await expect(service.enable('org-id', 'trunk-id', mockCustomer, true, 0)).rejects.toThrow(BadRequestException);
      });

      it('should reject enabling CREDENTIALS trunk without credentials', async () => {
        mockPrisma.sipTrunk.findFirst.mockResolvedValue({
          ...mockTrunk,
          authType: 'CREDENTIALS',
          credentials: null,
        });
        
        await expect(service.enable('org-id', 'trunk-id', mockCustomer, true, 0)).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('DTO Validation - Overposting and Invalid Inputs', () => {
    // Note: These tests verify the DTO structure. Actual validation is done by class-validator at runtime.
    
    it('should define required fields for CreateTrunkDto', () => {
      const { CreateTrunkDto } = require('../api/dist/trunks/dto');
      const dto = new CreateTrunkDto();
      
      expect(dto).toHaveProperty('name');
      expect(dto).toHaveProperty('authType');
      expect(dto).toHaveProperty('transport');
      expect(dto).toHaveProperty('domain');
      expect(dto).toHaveProperty('maxConcurrent');
      expect(dto).toHaveProperty('cps');
    });

    it('should define optional fields for CreateTrunkDto', () => {
      const { CreateTrunkDto } = require('../api/dist/trunks/dto');
      const dto = new CreateTrunkDto();
      
      expect(dto).toHaveProperty('description');
      expect(dto).toHaveProperty('defaultCallerId');
      expect(dto).toHaveProperty('failoverUri');
    });

    it('should define expectedVersion for UpdateTrunkDto', () => {
      const { UpdateTrunkDto } = require('../api/dist/trunks/dto');
      const dto = new UpdateTrunkDto();
      
      expect(dto).toHaveProperty('expectedVersion');
    });

    it('should define CIDR validation for AddIpDto', () => {
      const { AddIpDto } = require('../api/dist/trunks/dto');
      const dto = new AddIpDto();
      
      expect(dto).toHaveProperty('cidr');
      expect(dto).toHaveProperty('expectedVersion');
    });
  });

  describe('DTO Null Validation', () => {
    it('should reject null description in CreateTrunkDto (ValidateIf undefined-only)', async () => {
      const { CreateTrunkDto } = await import('../api/dist/trunks/dto');
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');
      
      const dto = plainToInstance(CreateTrunkDto, {
        name: 'Test Trunk',
        description: null,
        authType: 'IP',
        transport: 'UDP',
        domain: 'test.example.com',
        maxConcurrent: 10,
        cps: 5,
      });
      
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const descError = errors.find(e => e.property === 'description');
      expect(descError).toBeDefined();
    });

    it('should allow undefined description in CreateTrunkDto', async () => {
      const { CreateTrunkDto } = await import('../api/dist/trunks/dto');
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');
      
      const dto = plainToInstance(CreateTrunkDto, {
        name: 'Test Trunk',
        authType: 'IP',
        transport: 'UDP',
        domain: 'test.example.com',
        maxConcurrent: 10,
        cps: 5,
      });
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.description).toBeUndefined();
    });

    it('should allow null defaultCallerId in CreateTrunkDto (IsOptional)', async () => {
      const { CreateTrunkDto } = await import('../api/dist/trunks/dto');
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');
      
      const dto = plainToInstance(CreateTrunkDto, {
        name: 'Test Trunk',
        authType: 'IP',
        transport: 'UDP',
        domain: 'test.example.com',
        maxConcurrent: 10,
        cps: 5,
        defaultCallerId: null,
      });
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow null failoverUri in CreateTrunkDto (IsOptional)', async () => {
      const { CreateTrunkDto } = await import('../api/dist/trunks/dto');
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');
      
      const dto = plainToInstance(CreateTrunkDto, {
        name: 'Test Trunk',
        authType: 'IP',
        transport: 'UDP',
        domain: 'test.example.com',
        maxConcurrent: 10,
        cps: 5,
        failoverUri: null,
      });
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow null values in UpdateTrunkDto (skipNullProperties:false)', async () => {
      const { UpdateTrunkDto } = await import('../api/dist/trunks/dto');
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');
      
      const dto = plainToInstance(UpdateTrunkDto, {
        defaultCallerId: null,
        failoverUri: null,
        expectedVersion: 0,
      });
      
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.defaultCallerId).toBeNull();
      expect(dto.failoverUri).toBeNull();
    });

    it('should reject null description in UpdateTrunkDto (ValidateIf undefined-only)', async () => {
      const { UpdateTrunkDto } = await import('../api/dist/trunks/dto');
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');
      
      const dto = plainToInstance(UpdateTrunkDto, {
        description: null,
        expectedVersion: 0,
      });
      
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const descError = errors.find(e => e.property === 'description');
      expect(descError).toBeDefined();
    });
  });
});
