import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CallerIdService } from '../api/dist/caller-id/caller-id.service';
import { hashPassword } from '../api/dist/common/crypto';
import { randomUUID } from 'crypto';

// Skip all tests if TEST_DATABASE_URL is not set
const skipIntegration = !process.env.TEST_DATABASE_URL;
const describeIntegration = skipIntegration ? describe.skip : describe;

describeIntegration('CallerIdService - Integration Tests (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let service: CallerIdService;

  // Test fixture IDs tracked for cleanup
  let testOrgId: string;
  let testAdminOrgId: string;
  let testSuperAdminId: string;
  let testComplianceAdminId: string;
  let testCustomerId: string;
  let testTrunkId: string;
  let testNumberId: string;

  beforeEach(async () => {
    testOrgId = ''; testAdminOrgId = '';
    testSuperAdminId = ''; testComplianceAdminId = ''; testCustomerId = '';
    testTrunkId = ''; testNumberId = '';
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

    const complianceAdminUser = await prisma.user.create({
      data: {
        organizationId: adminOrg.id,
        email: `compliance-${uniqueId}@test.example`,
        fullName: 'Compliance Admin',
        passwordHash,
        role: 'COMPLIANCE_ADMIN',
        emailVerified: true,
      },
    });
    testComplianceAdminId = complianceAdminUser.id;

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

    // Create test SIP trunk
    const trunk = await prisma.sipTrunk.create({
      data: {
        organizationId: testOrgId,
        name: 'Test Trunk',
        enabled: true,
        mode: 'DEMO',
      },
    });
    testTrunkId = trunk.id;

    // Create test phone number (assigned) - use fictional reserved number
    const number = await prisma.phoneNumber.create({
      data: {
        organizationId: testOrgId,
        number: `+120255501${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        // Isolated TEST database fixture for the real-inventory selector only.
        // Organization calling remains disabled; no number is provisioned.
        mode: 'PRODUCTION',
        kind: 'LOCAL',
        status: 'ACTIVE',
      },
    });
    testNumberId = number.id;

    service = new CallerIdService(prisma);
  });

  afterEach(async () => {
    if (skipIntegration || !prisma) return;

    try {
      // Never allow undefined or stale predicates after failed fixture creation.
      if (testOrgId) {
      await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.callerIdVerification.deleteMany({
        where: { callerId: { organizationId: testOrgId } },
      });
      await prisma.callerId.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.callerIdPermissionRequest.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.phoneNumber.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.sipTrunk.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.user.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.organization.deleteMany({ where: { id: testOrgId } });
      }

      if (testAdminOrgId) {
      await prisma.user.deleteMany({ where: { organizationId: testAdminOrgId } });
      await prisma.organization.deleteMany({ where: { id: testAdminOrgId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('Request Enable Workflow', () => {
    it('should allow customer to request external caller ID permission', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const request = await service.requestEnable(customer, {
        justification: 'We need external caller ID for our business operations',
      }, '127.0.0.1');

      expect(request.id).toBeDefined();
      expect(request.status).toBe('PENDING');
      expect(request.organizationId).toBe(testOrgId);

      // Verify organization status updated
      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      expect(org?.callerIdPermissionStatus).toBe('REQUESTED');
      expect(org?.callerIdPermissionVersion).toBe(1);
    });

    it('should prevent duplicate pending requests', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      // First request should succeed
      await service.requestEnable(customer, {
        justification: 'First request',
      });

      // Second request should fail
      await expect(service.requestEnable(customer, {
        justification: 'Second request',
      })).rejects.toThrow('A request is already awaiting review.');
    });

    it('should allow customer to withdraw pending request', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const request = await service.requestEnable(customer, {
        justification: 'Test withdrawal',
      });

      const result = await service.cancelRequest(customer, request.id);
      expect(result.message).toContain('withdrawn');

      const updatedRequest = await prisma.callerIdPermissionRequest.findUnique({
        where: { id: request.id },
      });
      expect(updatedRequest?.status).toBe('CANCELLED');

      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      expect(org?.callerIdPermissionStatus).toBe('DISABLED');
    });
  });

  describe('Request Decision Workflow', () => {
    it('should allow SUPER_ADMIN to approve request', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      // Customer submits request
      const request = await service.requestEnable(customer, {
        justification: 'We need external caller ID',
      });

      // Admin approves request
      const decision = await service.decideRequest(testOrgId, request.id, superAdmin, {
        decision: 'APPROVED',
        notes: 'Approved after review',
        expectedVersion: 1,
      });

      expect(decision.status).toBe('APPROVED');

      // Verify organization settings updated
      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      expect(org?.externalCallerIdPassthroughEnabled).toBe(true);
      expect(org?.callerIdPermissionStatus).toBe('APPROVED');
      expect(org?.callerIdApprovalNotes).toBe('Approved after review');
      expect(org?.callerIdPermissionVersion).toBe(2);

      // Verify audit logs created
      const auditLogs = await prisma.auditLog.findMany({
        where: { organizationId: testOrgId },
        orderBy: { createdAt: 'asc' },
      });
      expect(auditLogs.length).toBeGreaterThanOrEqual(2);
      expect(auditLogs.some(log => log.action === 'CALLER_ID_PERMISSION_REQUESTED')).toBe(true);
      expect(auditLogs.some(log => log.action === 'CALLER_ID_PERMISSION_APPROVED')).toBe(true);
    });

    it('should allow COMPLIANCE_ADMIN to reject request', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const complianceAdmin = {
        id: testComplianceAdminId,
        organizationId: testAdminOrgId,
        role: 'COMPLIANCE_ADMIN' as const,
        email: 'compliance@test.example',
        fullName: 'Compliance Admin',
        emailVerified: true,
      };

      // Customer submits request
      const request = await service.requestEnable(customer, {
        justification: 'We need external caller ID',
      });

      // Admin rejects request
      const decision = await service.decideRequest(testOrgId, request.id, complianceAdmin, {
        decision: 'REJECTED',
        notes: 'Rejected due to compliance concerns',
        expectedVersion: 1,
      });

      expect(decision.status).toBe('REJECTED');

      // Verify organization settings
      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      expect(org?.externalCallerIdPassthroughEnabled).toBe(false);
      expect(org?.callerIdPermissionStatus).toBe('REJECTED');
    });

    it('should reject deciding already-decided request', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      const request = await service.requestEnable(customer, {
        justification: 'Test',
      });

      // First decision
      await service.decideRequest(testOrgId, request.id, superAdmin, {
        decision: 'APPROVED',
        notes: 'Approved',
        expectedVersion: 1,
      });

      // Second decision should fail
      await expect(service.decideRequest(testOrgId, request.id, superAdmin, {
        decision: 'REJECTED',
        notes: 'Trying to change',
        expectedVersion: 2,
      })).rejects.toThrow('This request has already been decided.');
    });
  });

  describe('Number Authorization Workflow', () => {
    it('should allow customer to submit external number', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const submission = await service.submitNumber(customer, {
        number: `+1555502${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        authorizationDescription: 'This is our company phone number',
      });

      expect(submission.id).toBeDefined();
      expect(submission.status).toBe('PENDING');
      expect(submission.verified).toBe(false);
    });

    it('should allow admin to authorize number with evidence', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      // Customer submits number
      const submission = await service.submitNumber(customer, {
        number: `+1555503${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        authorizationDescription: 'Our company number',
      });

      // Admin authorizes number
      const authorization = await service.reviewNumber(testOrgId, submission.id, superAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Verified ownership',
        evidenceReference: 'Bill-2024-01-001',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      });

      expect(authorization.status).toBe('AUTHORIZED');
      expect(authorization.verified).toBe(true);
      expect(authorization.authorizationRef).toBe('Bill-2024-01-001');

      // Verify verification record created
      const verifications = await prisma.callerIdVerification.findMany({
        where: { callerIdId: submission.id },
      });
      expect(verifications.length).toBe(1);
      expect(verifications[0].result).toBe('AUTHORIZED');
      expect(verifications[0].reviewedById).toBe(testSuperAdminId);
    });

    it('should enforce optimistic locking on number review', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      const submission = await service.submitNumber(customer, {
        number: `+1555504${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        authorizationDescription: 'Test number',
      });

      // First review should succeed
      await service.reviewNumber(testOrgId, submission.id, superAdmin, {
        decision: 'REJECTED',
        notes: 'Initial rejection',
        ownershipConfirmed: false,
        additionalReviewCompleted: false,
        expectedVersion: 0,
      });

      // Second review with old version should fail
      await expect(service.reviewNumber(testOrgId, submission.id, superAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Trying to authorize',
        evidenceReference: 'Evidence',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow('Caller ID changed. Refresh before reviewing.');
    });

    it('should require evidence and confirmation for authorization', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      const submission = await service.submitNumber(customer, {
        number: `+1555505${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        authorizationDescription: 'Test number',
      });

      // Without ownership confirmation
      await expect(service.reviewNumber(testOrgId, submission.id, superAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Test',
        evidenceReference: 'Evidence',
        ownershipConfirmed: false,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow('Documented ownership or authorization evidence and confirmation are required.');

      // Without evidence reference
      await expect(service.reviewNumber(testOrgId, submission.id, superAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Test',
        evidenceReference: '',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow('Documented ownership or authorization evidence and confirmation are required.');
    });

    it('should prevent duplicate number submission', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const number = `+1555506${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

      // First submission
      await service.submitNumber(customer, {
        number,
        authorizationDescription: 'First submission',
      });

      // Second submission should fail
      await expect(service.submitNumber(customer, {
        number,
        authorizationDescription: 'Second submission',
      })).rejects.toThrow('This number already has an authorization record.');
    });
  });

  describe('Trunk Default Management', () => {
    it('should set and clear trunk default caller ID', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      // Get assigned number
      const assignedNumber = await prisma.phoneNumber.findFirst({
        where: { organizationId: testOrgId },
      });

      // Set default to assigned number
      const result1 = await service.setDefault(customer, testTrunkId, assignedNumber!.number);
      expect(result1.defaultCallerId).toBe(assignedNumber!.number);

      const trunk1 = await prisma.sipTrunk.findUnique({ where: { id: testTrunkId } });
      expect(trunk1?.defaultCallerId).toBe(assignedNumber!.number);

      // Clear default
      const result2 = await service.setDefault(customer, testTrunkId, null);
      expect(result2.defaultCallerId).toBeNull();

      const trunk2 = await prisma.sipTrunk.findUnique({ where: { id: testTrunkId } });
      expect(trunk2?.defaultCallerId).toBeNull();
    });

    it('should reject unauthorized caller ID as default', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      await expect(service.setDefault(customer, testTrunkId, '+19999999999')).rejects.toThrow(
        'Caller ID is not authorized for this customer.'
      );
    });

    it('should clear invalid defaults when revoking number', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      // Submit and authorize a number
      const submission = await service.submitNumber(customer, {
        number: `+1555507${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
        authorizationDescription: 'Test number',
      });

      await service.reviewNumber(testOrgId, submission.id, superAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      });

      // Enable passthrough first
      await service.updateSettings(testOrgId, superAdmin, {
        externalCallerIdPassthroughEnabled: true,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'APPROVED',
        notes: 'Enabling passthrough',
        expectedVersion: 0,
      });

      // Set as trunk default
      await service.setDefault(customer, testTrunkId, submission.number);

      const trunk1 = await prisma.sipTrunk.findUnique({ where: { id: testTrunkId } });
      expect(trunk1?.defaultCallerId).toBe(submission.number);

      // Withdraw the number
      await service.withdrawNumber(customer, submission.id);

      // Verify trunk default was cleared
      const trunk2 = await prisma.sipTrunk.findUnique({ where: { id: testTrunkId } });
      expect(trunk2?.defaultCallerId).toBeNull();

      // Verify audit log for trunk default cleared
      const auditLogs = await prisma.auditLog.findMany({
        where: { 
          organizationId: testOrgId,
          action: 'CALLER_ID_TRUNK_DEFAULT_CLEARED',
        },
      });
      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Settings Management', () => {
    it('should enforce optimistic locking on settings update', async () => {
      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      const currentVersion = org!.callerIdPermissionVersion;

      // First update should succeed
      await service.updateSettings(testOrgId, superAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: true,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'First update',
        expectedVersion: currentVersion,
      });

      // Second update with old version should fail
      await expect(service.updateSettings(testOrgId, superAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Second update',
        expectedVersion: currentVersion,
      })).rejects.toThrow('Permissions changed. Refresh before saving.');
    });

    it('should validate passthrough and status consistency', async () => {
      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      const currentVersion = org!.callerIdPermissionVersion;

      // Passthrough enabled without APPROVED status
      await expect(service.updateSettings(testOrgId, superAdmin, {
        externalCallerIdPassthroughEnabled: true,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Invalid',
        expectedVersion: currentVersion,
      })).rejects.toThrow('Passthrough requires APPROVED permission status.');

      // APPROVED status without passthrough enabled
      await expect(service.updateSettings(testOrgId, superAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'APPROVED',
        notes: 'Invalid',
        expectedVersion: currentVersion,
      })).rejects.toThrow('Use DISABLED or REJECTED when passthrough is off.');
    });

    it('should block settings update when pending request exists', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      const request = await service.requestEnable(customer, {
        justification: 'Test blocking',
      });

      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      const currentVersion = org!.callerIdPermissionVersion;

      await expect(service.updateSettings(testOrgId, superAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Should fail',
        expectedVersion: currentVersion,
      })).rejects.toThrow('Review the pending request before editing permissions.');
    });
  });

  describe('RBAC Enforcement', () => {
    it('should allow SUPER_ADMIN to edit settings', async () => {
      const superAdmin = {
        id: testSuperAdminId,
        organizationId: testAdminOrgId,
        role: 'SUPER_ADMIN' as const,
        email: 'superadmin@test.example',
        fullName: 'Super Admin',
        emailVerified: true,
      };

      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      const currentVersion = org!.callerIdPermissionVersion;

      await expect(service.updateSettings(testOrgId, superAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Super admin update',
        expectedVersion: currentVersion,
      })).resolves.toBeDefined();
    });

    it('should allow COMPLIANCE_ADMIN to edit settings', async () => {
      const complianceAdmin = {
        id: testComplianceAdminId,
        organizationId: testAdminOrgId,
        role: 'COMPLIANCE_ADMIN' as const,
        email: 'compliance@test.example',
        fullName: 'Compliance Admin',
        emailVerified: true,
      };

      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      const currentVersion = org!.callerIdPermissionVersion;

      await expect(service.updateSettings(testOrgId, complianceAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Compliance admin update',
        expectedVersion: currentVersion,
      })).resolves.toBeDefined();
    });

    it('should reject CUSTOMER editing settings', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
      const currentVersion = org!.callerIdPermissionVersion;

      await expect(service.updateSettings(testOrgId, customer, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Customer update',
        expectedVersion: currentVersion,
      })).rejects.toThrow('This action requires an authorized administrator.');
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate data between organizations', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      // Create second organization
      const org2 = await prisma.organization.create({
        data: {
          businessName: `Second Org ${randomUUID()}`,
          country: 'US',
          phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
          address: '456 Test St',
          status: 'APPROVED',
          mode: 'DEMO',
          productionEnabled: false,
        },
      });

      const passwordHash = await hashPassword('TestPassword123!');
      const uniqueId = randomUUID().substring(0, 8);
      const user2 = await prisma.user.create({
        data: {
          organizationId: org2.id,
          email: `user2-${uniqueId}@test.example`,
          fullName: 'User 2',
          passwordHash,
          role: 'CUSTOMER',
          emailVerified: true,
        },
      });

      const customer2 = {
        id: user2.id,
        organizationId: org2.id,
        role: 'CUSTOMER' as const,
        email: `user2-${uniqueId}@test.example`,
        fullName: 'User 2',
        emailVerified: true,
      };

      // Customer 2 should not see Customer 1's data
      await expect(service.workspace(testOrgId, customer2)).rejects.toThrow(
        'This action requires an authorized administrator.'
      );

      // Clean up
      await prisma.user.delete({ where: { id: user2.id } });
      await prisma.organization.delete({ where: { id: org2.id } });
    });
  });

  describe('Workspace Data Integrity', () => {
    it('should return complete workspace data', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const workspace = await service.workspace(testOrgId, customer);

      expect(workspace.organization).toBeDefined();
      expect(workspace.organization.id).toBe(testOrgId);
      expect(workspace.settings).toBeDefined();
      expect(workspace.requests).toBeDefined();
      expect(workspace.external).toBeDefined();
      expect(workspace.assigned).toBeDefined();
      expect(workspace.trunks).toBeDefined();
      expect(workspace.selectableNumbers).toBeDefined();
      expect(workspace.audit).toBeDefined();
      expect(workspace.calling).toBeDefined();
      expect(workspace.calling.routingAllowed).toBe(false);
      expect(workspace.calling.status).toBe('Pending Upstream Activation');
    });
  });

  describe('Database Constraints', () => {
    it('should enforce one pending request per organization', async () => {
      const customer = {
        id: testCustomerId,
        organizationId: testOrgId,
        role: 'CUSTOMER' as const,
        email: 'customer@test.example',
        fullName: 'Customer User',
        emailVerified: true,
      };

      const request1 = await service.requestEnable(customer, {
        justification: 'First request',
      });

      // Try to create second pending request directly in DB (bypassing service)
      await expect(prisma.callerIdPermissionRequest.create({
        data: {
          organizationId: testOrgId,
          requestedById: testCustomerId,
          justification: 'Second request',
          status: 'PENDING',
        },
      })).rejects.toThrow();
    });

    it('should enforce passthrough requires approval constraint', async () => {
      // Try to enable passthrough without APPROVED status directly in DB
      await expect(prisma.organization.update({
        where: { id: testOrgId },
        data: {
          externalCallerIdPassthroughEnabled: true,
          callerIdPermissionStatus: 'DISABLED',
        },
      })).rejects.toThrow();
    });
  });
});
