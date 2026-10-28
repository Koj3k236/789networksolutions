import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CallerIdService } from '../api/dist/caller-id/caller-id.service';
import { evaluateCallerIdPolicy, normalizeCallerId } from '../api/dist/caller-id/policy';

describe('CallerIdService - Unit Tests (Mocked Prisma)', () => {
  let service: CallerIdService;
  let mockPrisma: any;

  const mockSuperAdmin = {
    id: 'admin-id',
    organizationId: 'admin-org-id',
    role: 'SUPER_ADMIN' as const,
    email: 'admin@example.com',
    fullName: 'Super Admin',
    emailVerified: true,
  };

  const mockComplianceAdmin = {
    id: 'compliance-id',
    organizationId: 'compliance-org-id',
    role: 'COMPLIANCE_ADMIN' as const,
    email: 'compliance@example.com',
    fullName: 'Compliance Admin',
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
    externalCallerIdPassthroughEnabled: false,
    allowPerCallCallerIdSelection: false,
    requireAdditionalCallerIdReview: true,
    callerIdPermissionStatus: 'DISABLED',
    callerIdApprovalNotes: null,
    callerIdPermissionsUpdatedAt: null,
    callerIdPermissionsUpdatedById: null,
    callerIdPermissionVersion: 0,
  };

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn((callback) => callback(mockPrisma)),
      $queryRaw: vi.fn(),
      organization: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      callerIdPermissionRequest: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      callerId: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      callerIdVerification: {
        create: vi.fn(),
      },
      phoneNumber: {
        findMany: vi.fn(),
      },
      sipTrunk: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      upstreamCarrier: {
        findUnique: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new CallerIdService(mockPrisma);
  });

  describe('Policy - E.164 Normalization and Injection Prevention', () => {
    it('should normalize valid E.164 number', () => {
      expect(normalizeCallerId('+14155551234')).toBe('+14155551234');
      expect(normalizeCallerId('+1 (415) 555-1234')).toBe('+14155551234');
      expect(normalizeCallerId('+44 20 7946 0958')).toBe('+442079460958');
    });

    it('should reject numbers without country code', () => {
      expect(() => normalizeCallerId('4155551234')).toThrow('Use a valid E.164 number with country code.');
    });

    it('should reject numbers with invalid characters', () => {
      expect(() => normalizeCallerId('+1415555123\n4')).toThrow('Invalid Caller ID');
      expect(() => normalizeCallerId('+1415555123\r4')).toThrow('Invalid Caller ID');
    });

    it('should reject excessively long input (injection attempt)', () => {
      const longInput = '+1' + '4'.repeat(50);
      expect(() => normalizeCallerId(longInput)).toThrow('Invalid Caller ID');
    });

    it('should reject numbers starting with +0', () => {
      expect(() => normalizeCallerId('+0123456789')).toThrow('Use a valid E.164 number with country code.');
    });

    it('should reject too short numbers', () => {
      expect(() => normalizeCallerId('+1234567')).toThrow('Use a valid E.164 number with country code.');
    });

    it('should reject too long numbers', () => {
      expect(() => normalizeCallerId('+1' + '4'.repeat(20))).toThrow('Use a valid E.164 number with country code.');
    });
  });

  describe('Policy - Default Deny and Authorization Requirements', () => {
    it('should deny by default when account not eligible', () => {
      const result = evaluateCallerIdPolicy({
        settings: mockOrganization,
        identity: undefined,
        perCall: false,
        accountEligible: false,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.routingAllowed).toBe(false);
      expect(result.reasons).toContain('ACCOUNT_NOT_ELIGIBLE');
    });

    it('should deny when number not authorized', () => {
      const result = evaluateCallerIdPolicy({
        settings: mockOrganization,
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: false, evidencePresent: false, additionalReviewComplete: false },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.reasons).toContain('NUMBER_NOT_AUTHORIZED');
    });

    it('should deny when authorization expired', () => {
      const expiredDate = new Date(Date.now() - 86400000);
      const result = evaluateCallerIdPolicy({
        settings: mockOrganization,
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: true, additionalReviewComplete: true, expiresAt: expiredDate },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.reasons).toContain('AUTHORIZATION_EXPIRED');
    });

    it('should deny per-call selection when disabled', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, allowPerCallCallerIdSelection: false },
        identity: { number: '+14155551234', kind: 'ASSIGNED', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: true,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.reasons).toContain('PER_CALL_SELECTION_DISABLED');
    });

    it('should always deny routing (outbound unavailable)', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED' },
        identity: { number: '+14155551234', kind: 'ASSIGNED', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
      });
      expect(result.routingAllowed).toBe(false);
      expect(result.reasons).toContain('OUTBOUND_CALLING_UNAVAILABLE');
    });
  });

  describe('Policy - External Caller ID Restrictions', () => {
    it('should deny external caller ID when passthrough disabled', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: false },
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.reasons).toContain('EXTERNAL_PASSTHROUGH_DISABLED');
    });

    it('should deny external caller ID when status not APPROVED', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'DISABLED' },
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.reasons).toContain('EXTERNAL_PASSTHROUGH_DISABLED');
    });

    it('should deny external caller ID without ownership evidence', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED' },
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: false, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.reasons).toContain('OWNERSHIP_EVIDENCE_REQUIRED');
    });

    it('should deny external caller ID without additional review when required', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED', requireAdditionalCallerIdReview: true },
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: true, additionalReviewComplete: false },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(false);
      expect(result.reasons).toContain('ADDITIONAL_REVIEW_REQUIRED');
    });

    it('should allow external caller ID when all requirements met', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED', requireAdditionalCallerIdReview: true },
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(true);
      expect(result.routingAllowed).toBe(false); // Still false due to outbound unavailable
    });
  });

  describe('Policy - Assigned vs External Numbers', () => {
    it('should allow assigned numbers without external passthrough', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: false },
        identity: { number: '+14155551234', kind: 'ASSIGNED', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(true);
    });

    it('should not require additional review for assigned numbers', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, requireAdditionalCallerIdReview: true },
        identity: { number: '+14155551234', kind: 'ASSIGNED', authorized: true, evidencePresent: true, additionalReviewComplete: false },
        perCall: false,
        accountEligible: true,
      });
      expect(result.customerPermissionAllowed).toBe(true);
    });
  });

  describe('Policy - Carrier Restrictions', () => {
    it('should deny when carrier not validated', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED' },
        identity: { number: '+14155551234', kind: 'ASSIGNED', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
        carrier: { enabled: false, verified: false, healthVerified: false, externalCapabilityVerified: false, policies: [] },
      });
      expect(result.carrierPolicyAllowed).toBe(false);
      expect(result.reasons).toContain('CARRIER_NOT_VALIDATED');
    });

    it('should deny external caller ID when carrier does not support it', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED' },
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
        carrier: { enabled: true, verified: true, healthVerified: true, externalCapabilityVerified: false, policies: [] },
      });
      expect(result.carrierPolicyAllowed).toBe(false);
      expect(result.reasons).toContain('CARRIER_EXTERNAL_CALLER_ID_UNSUPPORTED');
    });

    it('should deny even when customer enabled if carrier denies', () => {
      const result = evaluateCallerIdPolicy({
        settings: { ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED' },
        identity: { number: '+14155551234', kind: 'EXTERNAL', authorized: true, evidencePresent: true, additionalReviewComplete: true },
        perCall: false,
        accountEligible: true,
        carrier: { enabled: false, verified: false, healthVerified: false, externalCapabilityVerified: false, policies: [] },
      });
      expect(result.customerPermissionAllowed).toBe(true);
      expect(result.carrierPolicyAllowed).toBe(false);
    });
  });

  describe('RBAC - Editor Permissions', () => {
    it('should allow SUPER_ADMIN to edit settings', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.organization.update.mockResolvedValue({ ...mockOrganization, callerIdPermissionVersion: 1 });
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test update',
        expectedVersion: 0,
      })).resolves.toBeDefined();
    });

    it('should allow COMPLIANCE_ADMIN to edit settings', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.organization.update.mockResolvedValue({ ...mockOrganization, callerIdPermissionVersion: 1 });
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.updateSettings('org-id', mockComplianceAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test update',
        expectedVersion: 0,
      })).resolves.toBeDefined();
    });

    it('should reject CUSTOMER editing settings', async () => {
      await expect(service.updateSettings('org-id', mockCustomer, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test update',
        expectedVersion: 0,
      })).rejects.toThrow(ForbiddenException);
    });

    it('should reject OPERATIONS_ADMIN editing settings', async () => {
      const opsAdmin = { ...mockSuperAdmin, role: 'OPERATIONS_ADMIN' as const };
      await expect(service.updateSettings('org-id', opsAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test update',
        expectedVersion: 0,
      })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('RBAC - Admin Read Access', () => {
    it('should allow admin to read other organization workspace', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrganization, callerIdPermissionsUpdatedBy: null });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.callerIdPermissionRequest.findMany.mockResolvedValue([]);
      mockPrisma.sipTrunk.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(service.workspace('different-org-id', mockSuperAdmin)).resolves.toBeDefined();
    });

    it('should allow customer to read own organization workspace', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrganization, callerIdPermissionsUpdatedBy: null });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.callerIdPermissionRequest.findMany.mockResolvedValue([]);
      mockPrisma.sipTrunk.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(service.workspace('org-id', mockCustomer)).resolves.toBeDefined();
    });

    it('should reject customer reading other organization workspace', async () => {
      await expect(service.workspace('different-org-id', mockCustomer)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Tenant Isolation', () => {
    it('should return 404 for wrong tenant ID', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.updateSettings('wrong-org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow(NotFoundException);
    });

    it('should return 404 for trunk in different organization', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.sipTrunk.findFirst.mockResolvedValue(null);

      await expect(service.setDefault(mockCustomer, 'wrong-trunk-id', '+14155551234')).rejects.toThrow(NotFoundException);
    });

    it('should return 404 for caller ID in different organization', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerId.findFirst.mockResolvedValue(null);

      await expect(service.withdrawNumber(mockCustomer, 'wrong-caller-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Optimistic Locking - Version Conflicts', () => {
    it('should reject settings update with wrong version', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrganization, callerIdPermissionVersion: 5 });

      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow(ConflictException);
      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow('Permissions changed. Refresh before saving.');
    });

    it('should reject request decision with wrong version', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrganization, callerIdPermissionVersion: 3 });

      await expect(service.decideRequest('org-id', 'request-id', mockSuperAdmin, {
        decision: 'APPROVED',
        notes: 'Approved',
        expectedVersion: 0,
      })).rejects.toThrow(ConflictException);
    });

    it('should reject number review with wrong version', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerId.findFirst.mockResolvedValue({
        id: 'caller-id',
        organizationId: 'org-id',
        number: '+14155551234',
        version: 5,
        status: 'PENDING',
      });

      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow(ConflictException);
      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow('Caller ID changed. Refresh before reviewing.');
    });
  });

  describe('Request Workflow - Duplicate Prevention', () => {
    it('should reject duplicate pending request', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue({
        id: 'existing-request',
        organizationId: 'org-id',
        status: 'PENDING',
      });

      await expect(service.requestEnable(mockCustomer, {
        justification: 'Need external caller ID',
      })).rejects.toThrow(ConflictException);
      await expect(service.requestEnable(mockCustomer, {
        justification: 'Need external caller ID',
      })).rejects.toThrow('A request is already awaiting review.');
    });

    it('should allow new request after previous was decided', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.callerIdPermissionRequest.create.mockResolvedValue({
        id: 'new-request',
        organizationId: 'org-id',
        status: 'PENDING',
      });
      mockPrisma.organization.update.mockResolvedValue(mockOrganization);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.requestEnable(mockCustomer, {
        justification: 'Need external caller ID',
      })).resolves.toBeDefined();
    });
  });

  describe('Request Workflow - Decision Once', () => {
    it('should reject deciding already-decided request', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue({
        id: 'request-id',
        organizationId: 'org-id',
        status: 'APPROVED',
      });

      await expect(service.decideRequest('org-id', 'request-id', mockSuperAdmin, {
        decision: 'REJECTED',
        notes: 'Rejected',
        expectedVersion: 0,
      })).rejects.toThrow(ConflictException);
      await expect(service.decideRequest('org-id', 'request-id', mockSuperAdmin, {
        decision: 'REJECTED',
        notes: 'Rejected',
        expectedVersion: 0,
      })).rejects.toThrow('This request has already been decided.');
    });

    it('should reject withdrawing already-decided request', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue({
        id: 'request-id',
        organizationId: 'org-id',
        status: 'APPROVED',
      });

      await expect(service.cancelRequest(mockCustomer, 'request-id')).rejects.toThrow(ConflictException);
      await expect(service.cancelRequest(mockCustomer, 'request-id')).rejects.toThrow('Only pending requests can be withdrawn.');
    });
  });

  describe('Number Authorization - Evidence Requirements', () => {
    it('should reject authorization without ownership confirmation', async () => {
      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: false,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow(BadRequestException);
      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: false,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow('Documented ownership or authorization evidence and confirmation are required.');
    });

    it('should reject authorization without evidence reference', async () => {
      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: '',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expectedVersion: 0,
      })).rejects.toThrow(BadRequestException);
    });

    it('should reject authorization without additional review when required', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrganization, requireAdditionalCallerIdReview: true });
      mockPrisma.callerId.findFirst.mockResolvedValue({
        id: 'caller-id',
        organizationId: 'org-id',
        number: '+14155551234',
        version: 0,
        status: 'PENDING',
      });

      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: true,
        additionalReviewCompleted: false,
        expectedVersion: 0,
      })).rejects.toThrow(BadRequestException);
      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: true,
        additionalReviewCompleted: false,
        expectedVersion: 0,
      })).rejects.toThrow('Complete the additional Caller ID review required by this customer policy.');
    });

    it('should allow rejection without evidence', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerId.findFirst.mockResolvedValue({
        id: 'caller-id',
        organizationId: 'org-id',
        number: '+14155551234',
        version: 0,
        status: 'PENDING',
      });
      mockPrisma.callerId.update.mockResolvedValue({});
      mockPrisma.callerIdVerification.create.mockResolvedValue({});
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'REJECTED',
        notes: 'Rejected',
        ownershipConfirmed: false,
        additionalReviewCompleted: false,
        expectedVersion: 0,
      })).resolves.toBeDefined();
    });
  });

  describe('Number Authorization - No Automatic Ownership on Approval', () => {
    it('should not automatically grant ownership when approving request', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue({
        id: 'request-id',
        organizationId: 'org-id',
        status: 'PENDING',
      });
      mockPrisma.callerIdPermissionRequest.update.mockResolvedValue({});
      mockPrisma.organization.update.mockResolvedValue({ ...mockOrganization, externalCallerIdPassthroughEnabled: true, callerIdPermissionStatus: 'APPROVED' });
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.decideRequest('org-id', 'request-id', mockSuperAdmin, {
        decision: 'APPROVED',
        notes: 'Approved',
        expectedVersion: 0,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            numberOwnershipGranted: false,
            carrierPermissionGranted: false,
          }),
        }),
      });
    });
  });

  describe('Trunk Defaults - Invalid Removal', () => {
    it('should clear invalid trunk defaults when revoking number', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerId.findFirst.mockResolvedValue({
        id: 'caller-id',
        organizationId: 'org-id',
        number: '+14155551234',
        status: 'AUTHORIZED',
      });
      mockPrisma.callerId.update.mockResolvedValue({});
      mockPrisma.sipTrunk.findMany.mockResolvedValue([{id:'trunk-1',defaultCallerId:'+14155551234'}]);
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.withdrawNumber(mockCustomer, 'caller-id');

      expect(mockPrisma.sipTrunk.findMany).toHaveBeenCalled();
      expect(mockPrisma.sipTrunk.updateMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CALLER_ID_TRUNK_DEFAULT_CLEARED',
          targetId: 'trunk-1',
          metadata: expect.objectContaining({
            before: '+14155551234',
            after: null,
          }),
        }),
      });
    });

    it('should clear invalid trunk defaults when rejecting number', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerId.findFirst.mockResolvedValue({
        id: 'caller-id',
        organizationId: 'org-id',
        number: '+14155551234',
        version: 0,
        status: 'PENDING',
      });
      mockPrisma.callerId.update.mockResolvedValue({});
      mockPrisma.callerIdVerification.create.mockResolvedValue({});
      mockPrisma.sipTrunk.findMany.mockResolvedValue([{id:'trunk-2',defaultCallerId:'+14155551234'}]);
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'REJECTED',
        notes: 'Rejected',
        ownershipConfirmed: false,
        additionalReviewCompleted: false,
        expectedVersion: 0,
      });

      expect(mockPrisma.sipTrunk.findMany).toHaveBeenCalled();
      expect(mockPrisma.sipTrunk.updateMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CALLER_ID_TRUNK_DEFAULT_CLEARED',
          targetId: 'trunk-2',
        }),
      });
    });

    it('should clear invalid trunk defaults when disabling passthrough', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue({ ...mockOrganization, externalCallerIdPassthroughEnabled: true });
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.organization.update.mockResolvedValue({ ...mockOrganization, externalCallerIdPassthroughEnabled: false });
      mockPrisma.sipTrunk.findMany.mockResolvedValue([{id:'trunk-3',defaultCallerId:'+14155551234'},{id:'trunk-4',defaultCallerId:'+14155555555'}]);
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Disabling',
        expectedVersion: 0,
      });

      expect(mockPrisma.sipTrunk.findMany).toHaveBeenCalled();
      expect(mockPrisma.sipTrunk.updateMany).toHaveBeenCalled();
      // Should create audit log for each cleared trunk
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(3); // 1 for settings update + 2 for trunk clears
    });
  });

  describe('Audit Logging - Transaction Consistency', () => {
    it('should create audit log in same transaction as settings update', async () => {
      let transactionCallback: any;
      mockPrisma.$transaction.mockImplementation((callback) => {
        transactionCallback = callback;
        return callback(mockPrisma);
      });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.organization.update.mockResolvedValue({ ...mockOrganization, callerIdPermissionVersion: 1 });
      mockPrisma.sipTrunk.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('Default Setting - Inventory Validation', () => {
    it('should validate caller ID is in authorized inventory before setting default', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.sipTrunk.findFirst.mockResolvedValue({
        id: 'trunk-id',
        organizationId: 'org-id',
        defaultCallerId: null,
      });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);

      await expect(service.setDefault(mockCustomer, 'trunk-id', '+14155551234')).rejects.toThrow(ForbiddenException);
      await expect(service.setDefault(mockCustomer, 'trunk-id', '+14155551234')).rejects.toThrow('Caller ID is not authorized for this customer.');
    });

    it('should allow setting default to authorized number', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.sipTrunk.findFirst.mockResolvedValue({
        id: 'trunk-id',
        organizationId: 'org-id',
        defaultCallerId: null,
      });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([{
        id: 'number-id',
        number: '+14155551234',
        status: 'ACTIVE',
        kind: 'LOCAL',
      }]);
      mockPrisma.sipTrunk.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.setDefault(mockCustomer, 'trunk-id', '+14155551234')).resolves.toBeDefined();
    });

    it('should allow clearing default caller ID', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.sipTrunk.findFirst.mockResolvedValue({
        id: 'trunk-id',
        organizationId: 'org-id',
        defaultCallerId: '+14155551234',
      });
      mockPrisma.sipTrunk.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await expect(service.setDefault(mockCustomer, 'trunk-id', null)).resolves.toBeDefined();
    });
  });

  describe('Carrier Validation - Forged Flags Rejected', () => {
    it('should load carrier flags server-side, not from client', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.sipTrunk.findFirst.mockResolvedValue({
        id: 'trunk-id',
        organizationId: 'org-id',
      });
      mockPrisma.callerId.findMany.mockResolvedValue([]);
      mockPrisma.phoneNumber.findMany.mockResolvedValue([]);
      mockPrisma.upstreamCarrier.findUnique.mockResolvedValue({
        id: 'carrier-id',
        enabled: true,
        verified: true,
        lastHealthAt: new Date(),
        callerIdPolicies: ['VERIFIED_EXTERNAL'],
        capabilities: [{ name: 'externalCallerId', verified: true }],
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.validate(mockCustomer, {
        trunkId: 'trunk-id',
        callerId: '+14155551234',
        perCall: false,
        carrierId: 'carrier-id',
      });

      // Verify carrier was loaded from database, not accepted from client
      expect(mockPrisma.upstreamCarrier.findUnique).toHaveBeenCalledWith({
        where: { id: 'carrier-id' },
        include: { capabilities: true },
      });
    });
  });

  describe('DTO Validation - Settings Consistency', () => {
    it('should reject passthrough enabled without APPROVED status', async () => {
      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: true,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow(BadRequestException);
      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: true,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow('Passthrough requires APPROVED permission status.');
    });

    it('should reject APPROVED status without passthrough enabled', async () => {
      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'APPROVED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow(BadRequestException);
      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'APPROVED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow('Use DISABLED or REJECTED when passthrough is off.');
    });
  });

  describe('Request Workflow - Pending Request Blocks Settings', () => {
    it('should reject settings update when pending request exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerIdPermissionRequest.findFirst.mockResolvedValue({
        id: 'pending-request',
        organizationId: 'org-id',
        status: 'PENDING',
      });

      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow(ConflictException);
      await expect(service.updateSettings('org-id', mockSuperAdmin, {
        externalCallerIdPassthroughEnabled: false,
        allowPerCallCallerIdSelection: false,
        requireAdditionalCallerIdReview: true,
        status: 'DISABLED',
        notes: 'Test',
        expectedVersion: 0,
      })).rejects.toThrow('Review the pending request before editing permissions.');
    });
  });

  describe('Number Submission - Duplicate Prevention', () => {
    it('should reject duplicate number submission', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrisma.callerId.findUnique.mockResolvedValue({
        id: 'existing-id',
        organizationId: 'org-id',
        number: '+14155551234',
      });

      await expect(service.submitNumber(mockCustomer, {
        number: '+14155551234',
        authorizationDescription: 'I own this number',
      })).rejects.toThrow(ConflictException);
      await expect(service.submitNumber(mockCustomer, {
        number: '+14155551234',
        authorizationDescription: 'I own this number',
      })).rejects.toThrow('This number already has an authorization record.');
    });
  });

  describe('Authorization Expiry Validation', () => {
    it('should reject past expiry date', async () => {
      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
        expectedVersion: 0,
      })).rejects.toThrow(BadRequestException);
      await expect(service.reviewNumber('org-id', 'caller-id', mockSuperAdmin, {
        decision: 'AUTHORIZED',
        notes: 'Approved',
        evidenceReference: 'Evidence123',
        ownershipConfirmed: true,
        additionalReviewCompleted: true,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
        expectedVersion: 0,
      })).rejects.toThrow('Authorization expiry must be in the future.');
    });
  });
});

describe('DTO Validation with class-validator', () => {
  const { plainToInstance } = require('class-transformer');
  const { validate } = require('class-validator');
  const { EnableRequestDto, PermissionSettingsDto, RequestDecisionDto, SubmitNumberDto, NumberReviewDto, ValidateCallerIdDto } = require('../api/dist/caller-id/dto');

  it('should reject EnableRequestDto with short justification', async () => {
    const dto = plainToInstance(EnableRequestDto, { justification: 'short' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('justification');
  });

  it('should reject EnableRequestDto with excessively long justification', async () => {
    const dto = plainToInstance(EnableRequestDto, { justification: 'a'.repeat(2001) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject PermissionSettingsDto with invalid UUID in expectedVersion', async () => {
    const dto = plainToInstance(PermissionSettingsDto, {
      externalCallerIdPassthroughEnabled: true,
      allowPerCallCallerIdSelection: false,
      requireAdditionalCallerIdReview: true,
      status: 'APPROVED',
      notes: 'Valid notes here',
      expectedVersion: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject PermissionSettingsDto with invalid status', async () => {
    const dto = plainToInstance(PermissionSettingsDto, {
      externalCallerIdPassthroughEnabled: true,
      allowPerCallCallerIdSelection: false,
      requireAdditionalCallerIdReview: true,
      status: 'INVALID_STATUS',
      notes: 'Valid notes here',
      expectedVersion: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'status')).toBe(true);
  });

  it('should reject RequestDecisionDto with short notes', async () => {
    const dto = plainToInstance(RequestDecisionDto, {
      decision: 'APPROVED',
      notes: 'short',
      expectedVersion: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject SubmitNumberDto with invalid number length', async () => {
    const dto = plainToInstance(SubmitNumberDto, {
      number: '+1',
      authorizationDescription: 'Valid description here',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject NumberReviewDto with short evidenceReference', async () => {
    const dto = plainToInstance(NumberReviewDto, {
      decision: 'AUTHORIZED',
      notes: 'Valid notes here',
      evidenceReference: 'abc',
      ownershipConfirmed: true,
      additionalReviewCompleted: true,
      expectedVersion: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject NumberReviewDto with invalid ISO8601 date', async () => {
    const dto = plainToInstance(NumberReviewDto, {
      decision: 'AUTHORIZED',
      notes: 'Valid notes here',
      evidenceReference: 'Evidence123',
      ownershipConfirmed: true,
      additionalReviewCompleted: true,
      expiresAt: 'not-a-date',
      expectedVersion: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject ValidateCallerIdDto with invalid UUID', async () => {
    const dto = plainToInstance(ValidateCallerIdDto, {
      trunkId: 'not-a-uuid',
      callerId: '+14155551234',
      perCall: false,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.property === 'trunkId')).toBe(true);
  });

  it('should reject ValidateCallerIdDto with excessively long callerId', async () => {
    const dto = plainToInstance(ValidateCallerIdDto, {
      trunkId: '123e4567-e89b-12d3-a456-426614174000',
      callerId: '+1' + '4'.repeat(50),
      perCall: false,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept valid EnableRequestDto', async () => {
    const dto = plainToInstance(EnableRequestDto, {
      justification: 'We need external caller ID for our business operations',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept valid PermissionSettingsDto', async () => {
    const dto = plainToInstance(PermissionSettingsDto, {
      externalCallerIdPassthroughEnabled: true,
      allowPerCallCallerIdSelection: false,
      requireAdditionalCallerIdReview: true,
      status: 'APPROVED',
      notes: 'Approved after review',
      expectedVersion: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('resolveSignaledIdentity - SIP Identity Conflict Detection', () => {
  const { resolveSignaledIdentity } = require('../api/dist/caller-id/policy');

  it('should accept matching From and P-Asserted-Identity', () => {
    expect(resolveSignaledIdentity('+14155551234', '+14155551234')).toBe('+14155551234');
  });

  it('should accept From without P-Asserted-Identity', () => {
    expect(resolveSignaledIdentity('+14155551234')).toBe('+14155551234');
  });

  it('should normalize both identities before comparison', () => {
    expect(resolveSignaledIdentity('+1 (415) 555-1234', '+14155551234')).toBe('+14155551234');
  });

  it('should reject conflicting From and P-Asserted-Identity', () => {
    expect(() => resolveSignaledIdentity('+14155551234', '+14155559999')).toThrow('Conflicting SIP Caller ID identities');
  });

  it('should reject invalid From number', () => {
    expect(() => resolveSignaledIdentity('invalid')).toThrow('Use a valid E.164 number with country code.');
  });

  it('should reject invalid P-Asserted-Identity', () => {
    expect(() => resolveSignaledIdentity('+14155551234', 'invalid')).toThrow('Use a valid E.164 number with country code.');
  });

  it('should reject From with injection attempt', () => {
    expect(() => resolveSignaledIdentity('+1415555123\n4')).toThrow('Invalid Caller ID');
  });

  it('should reject conflicting identities even with formatting differences', () => {
    expect(() => resolveSignaledIdentity('+1 (415) 555-1234', '+1 (415) 555-9999')).toThrow('Conflicting SIP Caller ID identities');
  });
});
