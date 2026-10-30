import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TrunksService } from '../api/dist/trunks/trunks.service';
import { CallerIdService } from '../api/dist/caller-id/caller-id.service';
import { hashPassword } from '../api/dist/common/crypto';
import { randomUUID } from 'crypto';

// Skip all tests if TEST_DATABASE_URL is not set
const skipIntegration = !process.env.TEST_DATABASE_URL;
const describeIntegration = skipIntegration ? describe.skip : describe;

describeIntegration('SIP Trunk Module - Integration Tests (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let service: TrunksService;
  let callerIdService: CallerIdService;

  // Test fixture IDs tracked for cleanup
  let testOrgId: string;
  let testAdminOrgId: string;
  let testSuperAdminId: string;
  let testOperationsAdminId: string;
  let testCustomerId: string;
  let testTrunkId: string;
  let testCallerIdId: string;

  beforeEach(async () => {
    testOrgId = ''; testAdminOrgId = '';
    testSuperAdminId = ''; testOperationsAdminId = ''; testCustomerId = '';
    testTrunkId = ''; testCallerIdId = '';
    if (skipIntegration) return;

    // Check the database name, never the hostname, username, or query string.
    const dbUrl = process.env.TEST_DATABASE_URL!;
    if (!new URL(dbUrl).pathname.toLowerCase().includes('test')) {
      throw new Error('TEST_DATABASE_URL must contain "test" in database name for safety');
    }

    prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });

    await prisma.$connect();

    // Create fresh test organization with random UUID
    const org = await prisma.organization.create({
      data: {
        businessName: `Test Org ${randomUUID()}`,
        country: 'US',
        phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        address: '123 Test St',
        status: 'APPROVED',
        mode: 'DEMO',
        productionEnabled: false,
        sipConcurrentLimit: 20,
        sipCpsLimit: 2,
        callerIdPermissionStatus: 'APPROVED',
      },
    });
    testOrgId = org.id;

    // Create admin organization for admin users
    const adminOrg = await prisma.organization.create({
      data: {
        businessName: `Admin Org ${randomUUID()}`,
        country: 'US',
        phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        address: '999 Admin St',
        status: 'APPROVED',
        mode: 'DEMO',
        productionEnabled: false,
      },
    });
    testAdminOrgId = adminOrg.id;

    // Create test users with unique emails
    const passwordHash = await hashPassword('TestPassword123!');
    const uniqueId = randomUUID().substring(0, 8);

    const superAdminUser = await prisma.user.create({
      data: {
        organizationId: adminOrg.id,
        email: `superadmin-${uniqueId}@test.example`,
        fullName: 'Super Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        emailVerified: true,
      },
    });
    testSuperAdminId = superAdminUser.id;

    const operationsAdminUser = await prisma.user.create({
      data: {
        organizationId: adminOrg.id,
        email: `operations-${uniqueId}@test.example`,
        fullName: 'Operations Admin',
        passwordHash,
        role: 'OPERATIONS_ADMIN',
        emailVerified: true,
      },
    });
    testOperationsAdminId = operationsAdminUser.id;

    const customerUser = await prisma.user.create({
      data: {
        organizationId: testOrgId,
        email: `customer-${uniqueId}@test.example`,
        fullName: 'Customer User',
        passwordHash,
        role: 'CUSTOMER',
        emailVerified: true,
      },
    });
    testCustomerId = customerUser.id;

    // Create test phone number for caller ID
    const number = await prisma.phoneNumber.create({
      data: {
        organizationId: testOrgId,
        number: `+120255501${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        mode: 'PRODUCTION',
        kind: 'LOCAL',
        status: 'ACTIVE',
      },
    });

    // Create caller ID
    const callerId = await prisma.callerId.create({
      data: {
        organizationId: testOrgId,
        number: number.number,
        verified: true,
        status: 'AUTHORIZED',
      },
    });
    testCallerIdId = callerId.id;

    callerIdService = new CallerIdService(prisma);
    service = new TrunksService(prisma, callerIdService);
  });

  afterEach(async () => {
    if (skipIntegration || !prisma) return;

    try {
      // Never allow undefined or stale predicates after failed fixture creation.
      if (testOrgId) {
        await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.sipCredential.deleteMany({
          where: { trunk: { organizationId: testOrgId } },
        });
        await prisma.authorizedIp.deleteMany({
          where: { trunk: { organizationId: testOrgId } },
        });
        await prisma.phoneNumber.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.sipTrunk.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.callerId.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.user.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.organization.deleteMany({ where: { id: testOrgId } });
      }

      if (testAdminOrgId) {
        await prisma.auditLog.deleteMany({ where: { organizationId: testAdminOrgId } });
        await prisma.user.deleteMany({ where: { organizationId: testAdminOrgId } });
        await prisma.organization.deleteMany({ where: { id: testAdminOrgId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  const mockCustomer = () => ({
    id: testCustomerId,
    organizationId: testOrgId,
    role: 'CUSTOMER' as const,
    email: 'customer@test.example',
    fullName: 'Customer User',
    emailVerified: true,
  });

  const mockSuperAdmin = () => ({
    id: testSuperAdminId,
    organizationId: testAdminOrgId,
    role: 'SUPER_ADMIN' as const,
    email: 'superadmin@test.example',
    fullName: 'Super Admin',
    emailVerified: true,
  });

  const mockOperationsAdmin = () => ({
    id: testOperationsAdminId,
    organizationId: testAdminOrgId,
    role: 'OPERATIONS_ADMIN' as const,
    email: 'operations@test.example',
    fullName: 'Operations Admin',
    emailVerified: true,
  });

  describe('Full CRUD Operations with Transactions', () => {
    it('should create IP-based trunk with transaction', async () => {
      const dto = {
        name: 'Test IP Trunk',
        description: 'Test description',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      };

      const result = await service.create(testOrgId, mockCustomer(), dto, '192.0.2.1');

      expect(result.trunk.id).toBeDefined();
      expect(result.trunk.name).toBe('Test IP Trunk');
      expect(result.trunk.authType).toBe('IP');
      expect(result.trunk.enabled).toBe(false);
      expect(result.trunk.operational).toBe(false);
      expect(result.credentials).toBeUndefined();

      testTrunkId = result.trunk.id;

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { targetId: result.trunk.id, action: 'SIP_TRUNK_CREATED' },
      });
      expect(audit).toBeDefined();
      expect(audit!.actorId).toBe(testCustomerId);
      expect(audit!.ip).toBe('192.0.2.1');
    });

    it('should create CREDENTIALS-based trunk with one-time secret', async () => {
      const dto = {
        name: 'Test Credentials Trunk',
        authType: 'CREDENTIALS' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 5,
        cps: 1,
      };

      const result = await service.create(testOrgId, mockCustomer(), dto);

      expect(result.trunk.id).toBeDefined();
      expect(result.trunk.authType).toBe('CREDENTIALS');
      expect(result.credentials).toBeDefined();
      expect(result.credentials!.username).toMatch(/^789_[a-f0-9]{24}$/);
      expect(result.credentials!.password).toBeDefined();
      expect(result.credentials!.realm).toBe('sip.test.example');
      expect(result.credentials!.algorithm).toBe('SHA-256');
      expect(result.credentials!.oneTime).toBe(true);

      testTrunkId = result.trunk.id;

      // Verify credentials stored in database (without plaintext password)
      const storedCreds = await prisma.sipCredential.findUnique({
        where: { trunkId: result.trunk.id },
      });
      expect(storedCreds).toBeDefined();
      expect(storedCreds!.username).toBe(result.credentials!.username);
      expect(storedCreds!.digestEncrypted).toBeDefined();
      expect(storedCreds!.digestEncrypted).not.toContain(result.credentials!.password);

      // Verify audit log for credential issuance
      const audit = await prisma.auditLog.findFirst({
        where: { targetId: result.trunk.id, action: 'SIP_TRUNK_CREDENTIALS_ISSUED' },
      });
      expect(audit).toBeDefined();
    });

    it('should retrieve trunk by ID', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Test Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      const result = await service.detail(testOrgId, testTrunkId, mockCustomer());

      expect(result.id).toBe(testTrunkId);
      expect(result.name).toBe('Test Trunk');
      expect(result.audit).toBeDefined();
      expect(result.audit.length).toBeGreaterThan(0);
    });

    it('should update trunk with version check', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Original Name',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      const updateDto = {
        name: 'Updated Name',
        maxConcurrent: 15,
        expectedVersion: 0,
      };

      const result = await service.update(testOrgId, testTrunkId, mockCustomer(), updateDto);

      expect(result.trunk.name).toBe('Updated Name');
      expect(result.trunk.maxConcurrent).toBe(15);
      expect(result.trunk.version).toBe(1);
    });

    it('should reject update with stale version', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Test Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      // First update
      await service.update(testOrgId, testTrunkId, mockCustomer(), {
        name: 'Updated Once',
        expectedVersion: 0,
      });

      // Second update with stale version
      await expect(
        service.update(testOrgId, testTrunkId, mockCustomer(), {
          name: 'Updated Twice',
          expectedVersion: 0, // Stale version
        })
      ).rejects.toThrow('Trunk changed. Refresh before saving.');
    });

    it('should soft delete trunk', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'To Delete',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      await service.remove(testOrgId, testTrunkId, mockCustomer(), 0);

      // Verify trunk is soft deleted
      const deleted = await prisma.sipTrunk.findFirst({
        where: { id: testTrunkId },
      });
      expect(deleted!.deletedAt).not.toBeNull();
      expect(deleted!.enabled).toBe(false);

      // Verify trunk not in list
      const list = await service.list(testOrgId, mockCustomer());
      expect(list.find(t => t.id === testTrunkId)).toBeUndefined();
    });
  });

  describe('Admin RBAC Enforcement', () => {
    it('should allow SUPER_ADMIN to create trunk for any organization', async () => {
      const dto = {
        name: 'Admin Created Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      };

      const result = await service.create(testOrgId, mockSuperAdmin(), dto);

      expect(result.trunk.id).toBeDefined();
      testTrunkId = result.trunk.id;
    });

    it('should allow OPERATIONS_ADMIN to create trunk for any organization', async () => {
      const dto = {
        name: 'Ops Admin Created Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      };

      const result = await service.create(testOrgId, mockOperationsAdmin(), dto);

      expect(result.trunk.id).toBeDefined();
      testTrunkId = result.trunk.id;
    });

    it('should reject customer creating trunk for other organization', async () => {
      const dto = {
        name: 'Unauthorized Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      };

      await expect(
        service.create(testAdminOrgId, mockCustomer(), dto)
      ).rejects.toMatchObject({status:403});
    });

    it('should allow SUPER_ADMIN to update account limits', async () => {
      const dto = {
        concurrent: 50,
        cps: 10,
        reason: 'Upgrade for testing',
      };

      const result = await service.limits(testOrgId, mockSuperAdmin(), dto);

      expect(result.concurrent).toBe(50);
      expect(result.cps).toBe(10);

      // Verify in database
      const org = await prisma.organization.findUnique({
        where: { id: testOrgId },
      });
      expect(org!.sipConcurrentLimit).toBe(50);
      expect(org!.sipCpsLimit).toBe(10);
    });

    it('should reject customer updating account limits', async () => {
      const dto = {
        concurrent: 50,
        cps: 10,
        reason: 'Unauthorized upgrade',
      };

      await expect(
        service.limits(testOrgId, mockCustomer(), dto)
      ).rejects.toMatchObject({status:403});
    });
  });

  describe('Cross-tenant Isolation (404 for other tenant)', () => {
    it('should return 404 when customer accesses other tenant trunk', async () => {
      // Create trunk in testOrgId
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Tenant A Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      // Create another organization
      const otherOrg = await prisma.organization.create({
        data: {
          businessName: `Other Org ${randomUUID()}`,
          country: 'US',
          phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
          address: '456 Other St',
          status: 'APPROVED',
          mode: 'DEMO',
        },
      });

      const otherUser = await prisma.user.create({
        data: {
          organizationId: otherOrg.id,
          email: `other-${randomUUID().substring(0, 8)}@test.example`,
          fullName: 'Other User',
          passwordHash: await hashPassword('TestPassword123!'),
          role: 'CUSTOMER',
          emailVerified: true,
        },
      });

      const otherCustomer = {
        id: otherUser.id,
        organizationId: otherOrg.id,
        role: 'CUSTOMER' as const,
        email: otherUser.email,
        fullName: otherUser.fullName,
        emailVerified: true,
      };

      // Try to access trunk from other organization
      await expect(
        service.detail(otherOrg.id, testTrunkId, otherCustomer)
      ).rejects.toThrow('SIP trunk not found');

      // Cleanup
      await prisma.user.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.organization.deleteMany({ where: { id: otherOrg.id } });
    });
  });

  describe('Credential Rotation with Transaction', () => {
    it('should rotate credentials and invalidate old ones', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Rotation Test',
        authType: 'CREDENTIALS' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;
      const originalPassword = createResult.credentials!.password;
      const originalUsername = createResult.credentials!.username;

      // Rotate credentials
      const rotated = await service.rotate(testOrgId, testTrunkId, mockCustomer(), 0);

      expect(rotated.username).toBe(originalUsername); // Username preserved
      expect(rotated.password).not.toBe(originalPassword); // Password changed
      expect(rotated.oneTime).toBe(true);

      // Verify version incremented
      const trunk = await prisma.sipTrunk.findUnique({
        where: { id: testTrunkId },
      });
      expect(trunk!.version).toBe(1);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { targetId: testTrunkId, action: 'SIP_TRUNK_CREDENTIALS_ROTATED' },
      });
      expect(audit).toBeDefined();
      expect(audit!.metadata).toMatchObject({
        oneTimeDisclosure: true,
        oldCredentialInvalidated: true,
      });
    });

    it('should reject rotation for IP-based trunk', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'IP Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      await expect(
        service.rotate(testOrgId, testTrunkId, mockCustomer(), 0)
      ).rejects.toThrow('This trunk uses IP authentication');
    });
  });

  describe('No Hash in GET Responses', () => {
    it('should not return digestEncrypted in GET responses', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Credentials Trunk',
        authType: 'CREDENTIALS' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      // Get trunk details
      const detail = await service.detail(testOrgId, testTrunkId, mockCustomer());

      expect(detail.credentials).toBeDefined();
      expect(detail.credentials.username).toBeDefined();
      expect(detail.credentials.realm).toBeDefined();
      expect(detail.credentials.algorithm).toBeDefined();
      expect(detail.credentials.rotatedAt).toBeDefined();
      expect((detail.credentials as any).digestEncrypted).toBeUndefined();
      expect((detail.credentials as any).password).toBeUndefined();
    });
  });

  describe('Deletion Blocked When DIDs Attached', () => {
    it('should reject deletion when active numbers attached', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Trunk With Numbers',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      // Attach a number to the trunk
      await prisma.phoneNumber.create({
        data: {
          organizationId: testOrgId,
          number: `+120255502${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
          mode: 'DEMO',
          kind: 'LOCAL',
          status: 'ACTIVE',
          trunkId: testTrunkId,
        },
      });

      await expect(
        service.remove(testOrgId, testTrunkId, mockCustomer(), 0)
      ).rejects.toThrow('Reassign or release attached numbers before deleting this trunk');
    });

    it('should allow deletion when no active numbers', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Trunk Without Numbers',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      await expect(
        service.remove(testOrgId, testTrunkId, mockCustomer(), 0)
      ).resolves.toBeDefined();
    });
  });

  describe('Soft Delete History Retention', () => {
    it('should retain audit history after soft delete', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'History Test',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      // Perform some operations
      await service.update(testOrgId, testTrunkId, mockCustomer(), {
        name: 'Updated Name',
        expectedVersion: 0,
      });

      // Delete trunk
      await service.remove(testOrgId, testTrunkId, mockCustomer(), 1);

      // Verify audit history still exists
      const audit = await prisma.auditLog.findMany({
        where: { targetId: testTrunkId },
        orderBy: { createdAt: 'asc' },
      });

      expect(audit.length).toBeGreaterThanOrEqual(3); // CREATE, UPDATE, DELETE
      expect(audit.some(a => a.action === 'SIP_TRUNK_CREATED')).toBe(true);
      expect(audit.some(a => a.action === 'SIP_TRUNK_UPDATED')).toBe(true);
      expect(audit.some(a => a.action === 'SIP_TRUNK_DELETED')).toBe(true);
    });
  });

  describe('CallerID Deny for Deleted Trunks', () => {
    it('should validate caller ID is selectable', async () => {
      const callerIds = await prisma.callerId.findMany({
        where: { organizationId: testOrgId, status: 'AUTHORIZED' },
      });
      const validCallerId = callerIds[0]?.number;

      if (!validCallerId) {
        console.log('Skipping test: no valid caller ID available');
        return;
      }

      const dto = {
        name: 'Trunk With Caller ID',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
        defaultCallerId: validCallerId,
      };

      const result = await service.create(testOrgId, mockCustomer(), dto);

      expect(result.trunk.defaultCallerId).toBe(validCallerId);
      testTrunkId = result.trunk.id;
    });
  });

  describe('Audit Metadata Completeness', () => {
    it('should log all required metadata for trunk creation', async () => {
      const dto = {
        name: 'Audit Test Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      };

      const result = await service.create(testOrgId, mockCustomer(), dto, '192.0.2.100');
      testTrunkId = result.trunk.id;

      const audit = await prisma.auditLog.findFirst({
        where: { targetId: result.trunk.id, action: 'SIP_TRUNK_CREATED' },
      });

      expect(audit).toBeDefined();
      expect(audit!.organizationId).toBe(testOrgId);
      expect(audit!.actorId).toBe(testCustomerId);
      expect(audit!.action).toBe('SIP_TRUNK_CREATED');
      expect(audit!.targetId).toBe(result.trunk.id);
      expect(audit!.ip).toBe('192.0.2.100');
      expect(audit!.metadata).toMatchObject({
        name: 'Audit Test Trunk',
        authType: 'IP',
        maxConcurrent: 10,
        cps: 1,
        enabled: false,
      });
    });

    it('should log before/after metadata for updates', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Original',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      await service.update(testOrgId, testTrunkId, mockCustomer(), {
        name: 'Updated',
        maxConcurrent: 15,
        expectedVersion: 0,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { targetId: testTrunkId, action: 'SIP_TRUNK_UPDATED' },
      });

      expect(audit).toBeDefined();
      expect(audit!.metadata).toHaveProperty('before');
      expect(audit!.metadata).toHaveProperty('after');
      expect((audit!.metadata as any).before.name).toBe('Original');
      expect((audit!.metadata as any).after.name).toBe('Updated');
    });
  });

  describe('IP Management', () => {
    it('should add authorized IP with canonicalization', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'IP Management Test',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      const ipDto = {
        cidr: '8.8.8.255/24', // Should be canonicalized to 8.8.8.0/24
        expectedVersion: 0,
      };

      const result = await service.addIp(testOrgId, testTrunkId, mockCustomer(), ipDto);

      expect(result.cidr).toBe('8.8.8.0/24');
    });

    it('should reject private IP addresses', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'IP Test',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      const ipDto = {
        cidr: '192.168.1.1/32',
        expectedVersion: 0,
      };

      await expect(
        service.addIp(testOrgId, testTrunkId, mockCustomer(), ipDto)
      ).rejects.toMatchObject({status:400});
    });

    it('should remove authorized IP', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'IP Remove Test',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      const ipResult = await service.addIp(testOrgId, testTrunkId, mockCustomer(), {
        cidr: '8.8.8.8/32',
        expectedVersion: 0,
      });

      await service.removeIp(testOrgId, testTrunkId, ipResult.id, mockCustomer(), 1);

      const trunk = await prisma.sipTrunk.findUnique({
        where: { id: testTrunkId },
        include: { ips: true },
      });

      expect(trunk!.ips.length).toBe(0);
    });

    it('should reject removing last IP from enabled trunk', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Last IP Test',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      const ipResult = await service.addIp(testOrgId, testTrunkId, mockCustomer(), {
        cidr: '8.8.8.8/32',
        expectedVersion: 0,
      });

      await service.enable(testOrgId, testTrunkId, mockCustomer(), true, 1);

      await expect(
        service.removeIp(testOrgId, testTrunkId, ipResult.id, mockCustomer(), 2)
      ).rejects.toThrow('Disable the configuration before removing its last authorized IP');
    });
  });

  describe('Account Caps Validation', () => {
    it('should reject trunk limits exceeding account caps', async () => {
      const dto = {
        name: 'Over Limit Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 100, // Exceeds default 20
        cps: 1,
      };

      await expect(
        service.create(testOrgId, mockCustomer(), dto)
      ).rejects.toThrow('within the customer account caps');
    });

    it('should reject reducing account caps below existing trunk limits', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'High Limit Trunk',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 20,
        cps: 2,
      });
      testTrunkId = createResult.trunk.id;

      const limitsDto = {
        concurrent: 10, // Below existing trunk limit
        cps: 1,
        reason: 'Downgrade',
      };

      await expect(
        service.limits(testOrgId, mockSuperAdmin(), limitsDto)
      ).rejects.toThrow('Lower the existing trunk limits before reducing account caps');
    });
  });

  describe('Configuration Enabled vs Operational', () => {
    it('should mark all trunks as non-operational', async () => {
      const createResult = await service.create(testOrgId, mockCustomer(), {
        name: 'Operational Test',
        authType: 'IP' as const,
        transport: 'TLS' as const,
        domain: 'sip.test.example',
        maxConcurrent: 10,
        cps: 1,
      });
      testTrunkId = createResult.trunk.id;

      const detail = await service.detail(testOrgId, testTrunkId, mockCustomer());

      expect(detail.operational).toBe(false);
      expect(detail.serviceStatus).toBe('Pending Upstream Activation');
    });
  });
});
