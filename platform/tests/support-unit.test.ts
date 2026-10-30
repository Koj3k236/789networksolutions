import { describe, it, expect, beforeEach, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

// DTO validation tests
describe('Support System - DTO Validation', () => {
  describe('CreateTicketDto', () => {
    it('should validate with valid data', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: 'Test ticket subject',
        description: 'This is a test ticket description with enough characters',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject subject shorter than 5 characters', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: 'Test',
        description: 'This is a test ticket description',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('subject');
    });

    it('should reject subject longer than 140 characters', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: 'A'.repeat(141),
        description: 'This is a test ticket description',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('subject');
    });

    it('should reject description shorter than 10 characters', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: 'Test ticket',
        description: 'Short',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('description');
    });

    it('should reject description longer than 10000 characters', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: 'Test ticket',
        description: 'A'.repeat(10001),
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('description');
    });

    it('should trim whitespace from subject and description', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: '  Test ticket  ',
        description: '  This is a test description  ',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      expect(dto.subject).toBe('Test ticket');
      expect(dto.description).toBe('This is a test description');
    });

    it('should reject invalid category', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: 'Test ticket',
        description: 'This is a test description',
        category: 'INVALID_CATEGORY',
        priority: 'NORMAL',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('category');
    });

    it('should reject invalid priority', async () => {
      const { CreateTicketDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CreateTicketDto, {
        subject: 'Test ticket',
        description: 'This is a test description',
        category: 'TECHNICAL_SUPPORT',
        priority: 'INVALID_PRIORITY',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('priority');
    });

    it('should accept all valid categories', async () => {
      const { CreateTicketDto, TICKET_CATEGORIES } = await import('../api/dist/support/dto');
      for (const category of TICKET_CATEGORIES) {
        const dto = plainToInstance(CreateTicketDto, {
          subject: 'Test ticket',
          description: 'This is a test description',
          category,
          priority: 'NORMAL',
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should accept all valid priorities', async () => {
      const { CreateTicketDto, TICKET_PRIORITIES } = await import('../api/dist/support/dto');
      for (const priority of TICKET_PRIORITIES) {
        const dto = plainToInstance(CreateTicketDto, {
          subject: 'Test ticket',
          description: 'This is a test description',
          category: 'TECHNICAL_SUPPORT',
          priority,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('TicketQueryDto', () => {
    it('should validate with valid data', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, {
        search: 'test',
        status: 'OPEN',
        priority: 'HIGH',
        page: 1,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should default page to 1', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, {});
      expect(dto.page).toBe(1);
    });

    it('should reject page less than 1', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should reject page greater than 10000', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, { page: 10001 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should reject non-integer page', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, { page: 1.5 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('should reject search longer than 100 characters', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, { search: 'A'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('search');
    });

    it('should reject invalid status', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, { status: 'INVALID_STATUS' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject invalid priority', async () => {
      const { TicketQueryDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(TicketQueryDto, { priority: 'INVALID_PRIORITY' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('priority');
    });
  });

  describe('ReplyDto', () => {
    it('should validate with valid data', async () => {
      const { ReplyDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(ReplyDto, {
        body: 'This is a reply',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty body', async () => {
      const { ReplyDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(ReplyDto, {
        body: '',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('body');
    });

    it('should reject body longer than 10000 characters', async () => {
      const { ReplyDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(ReplyDto, {
        body: 'A'.repeat(10001),
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('body');
    });

    it('should trim whitespace from body', async () => {
      const { ReplyDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(ReplyDto, {
        body: '  This is a reply  ',
        expectedVersion: 0,
      });
      expect(dto.body).toBe('This is a reply');
    });

    it('should reject negative expectedVersion', async () => {
      const { ReplyDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(ReplyDto, {
        body: 'This is a reply',
        expectedVersion: -1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('expectedVersion');
    });
  });

  describe('CustomerTicketStateDto', () => {
    it('should validate with OPEN status', async () => {
      const { CustomerTicketStateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CustomerTicketStateDto, {
        status: 'OPEN',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with CLOSED status', async () => {
      const { CustomerTicketStateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CustomerTicketStateDto, {
        status: 'CLOSED',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject other statuses', async () => {
      const { CustomerTicketStateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(CustomerTicketStateDto, {
        status: 'IN_PROGRESS',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });
  });

  describe('AdminTicketUpdateDto', () => {
    it('should validate with valid data', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assignedTo: '123e4567-e89b-12d3-a456-426614174000',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept null assignedTo', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        assignedTo: null,
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid UUID for assignedTo', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        assignedTo: 'invalid-uuid',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('assignedTo');
    });

    it('should reject invalid status', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        status: 'INVALID_STATUS',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject invalid priority', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        priority: 'INVALID_PRIORITY',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('priority');
    });

    it('should reject null status (ValidateIf undefined-only)', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        status: null,
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('should reject null priority (ValidateIf undefined-only)', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        priority: null,
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('priority');
    });

    it('should allow undefined status (optional field)', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        priority: 'HIGH',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.status).toBeUndefined();
    });

    it('should allow undefined priority (optional field)', async () => {
      const { AdminTicketUpdateDto } = await import('../api/dist/support/dto');
      const dto = plainToInstance(AdminTicketUpdateDto, {
        status: 'IN_PROGRESS',
        expectedVersion: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.priority).toBeUndefined();
    });
  });
});

// Service unit tests with mocked Prisma
describe('Support System - Service Unit Tests', () => {
  let service: any;
  let mockPrisma: any;

  const mockCustomer = {
    id: 'customer-id',
    organizationId: 'org-id',
    role: 'CUSTOMER' as const,
    email: 'customer@example.com',
    fullName: 'Customer User',
    emailVerified: true,
  };

  const mockSupportAgent = {
    id: 'agent-id',
    organizationId: 'agent-org-id',
    role: 'SUPPORT_AGENT' as const,
    email: 'agent@example.com',
    fullName: 'Support Agent',
    emailVerified: true,
  };

  const mockSuperAdmin = {
    id: 'admin-id',
    organizationId: 'admin-org-id',
    role: 'SUPER_ADMIN' as const,
    email: 'admin@example.com',
    fullName: 'Super Admin',
    emailVerified: true,
  };

  const mockTicket = {
    id: 'ticket-id',
    organizationId: 'org-id',
    category: 'TECHNICAL_SUPPORT',
    subject: 'Test Ticket',
    description: 'Test description',
    priority: 'NORMAL',
    status: 'OPEN',
    assignedTo: null,
    createdByUserId: 'customer-id',
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    attachmentObjectKeys: [],
    createdBy: { id: 'customer-id', fullName: 'Customer User' },
    assignedToUser: null,
    organization: { id: 'org-id', businessName: 'Test Org' },
  };

  beforeEach(async () => {
    const { SupportService } = await import('../api/dist/support/support.service');

    mockPrisma = {
      $transaction: vi.fn((callback) => callback(mockPrisma)),
      $queryRaw: vi.fn(),
      supportTicket: {
        findFirst: vi.fn().mockResolvedValue(mockTicket),
        findUniqueOrThrow: vi.fn().mockResolvedValue(mockTicket),
        findMany: vi.fn().mockResolvedValue([mockTicket]),
        create: vi.fn().mockResolvedValue(mockTicket),
        update: vi.fn().mockResolvedValue(mockTicket),
        count: vi.fn().mockResolvedValue(1),
      },
      supportTicketReply: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'reply-id', ticketId: 'ticket-id', authorId: 'customer-id', body: 'Test reply', createdAt: new Date() }),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        createMany: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    service = new SupportService(mockPrisma);
  });

  describe('RBAC - Role-based access control', () => {
    it('should allow customer to list own tickets', async () => {
      await expect(service.list(mockCustomer, { page: 1 }, false)).resolves.toBeDefined();
      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-id' }),
        })
      );
    });

    it('should allow support agent to list all tickets', async () => {
      await expect(service.list(mockSupportAgent, { page: 1 }, true)).resolves.toBeDefined();
      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ organizationId: expect.anything() }),
        })
      );
    });

    it('should reject customer accessing admin endpoints', async () => {
      await expect(service.list(mockCustomer, { page: 1 }, true)).rejects.toThrow(ForbiddenException);
    });

    it('should allow SUPER_ADMIN to access admin endpoints', async () => {
      await expect(service.list(mockSuperAdmin, { page: 1 }, true)).resolves.toBeDefined();
    });

    it('should allow SUPPORT_AGENT to access admin endpoints', async () => {
      await expect(service.list(mockSupportAgent, { page: 1 }, true)).resolves.toBeDefined();
    });
  });

  describe('Tenant isolation', () => {
    it('should scope customer ticket access to own organization', async () => {
      mockPrisma.supportTicket.findFirst.mockResolvedValue(null);
      
      await expect(service.detail(mockCustomer, 'other-org-ticket-id', false)).rejects.toThrow(NotFoundException);
    });

    it('should allow admin to access any organization ticket', async () => {
      await expect(service.detail(mockSuperAdmin, 'ticket-id', true)).resolves.toBeDefined();
    });

    it('should prevent customer from replying to other org tickets', async () => {
      mockPrisma.supportTicket.findFirst.mockResolvedValue(null);
      
      await expect(service.reply(mockCustomer, 'other-org-ticket-id', { body: 'Reply', expectedVersion: 0 }, false)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Version conflict detection', () => {
    it('should reject reply with stale version', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, version: 5 });
      
      await expect(service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 3 }, false)).rejects.toThrow(ConflictException);
      expect(mockPrisma.supportTicketReply.create).not.toHaveBeenCalled();
    });

    it('should accept reply with correct version', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, version: 3 });
      
      await expect(service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 3 }, false)).resolves.toBeDefined();
    });

    it('should increment version on reply', async () => {
      await service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 0 }, false);
      
      expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: { increment: 1 },
          }),
        })
      );
    });

    it('should reject status change with stale version', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, version: 5, status: 'RESOLVED' });
      
      await expect(service.customerState(mockCustomer, 'ticket-id', 'CLOSED', 3)).rejects.toThrow(ConflictException);
    });
  });

  describe('Closed ticket reply blocking', () => {
    it('should reject reply to closed ticket', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'CLOSED' });
      
      await expect(service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 0 }, false)).rejects.toThrow(ConflictException);
      expect(mockPrisma.supportTicketReply.create).not.toHaveBeenCalled();
    });

    it('should allow reply to open ticket', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'OPEN' });
      
      await expect(service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 0 }, false)).resolves.toBeDefined();
    });

    it('should allow reply to in-progress ticket', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'IN_PROGRESS' });
      
      await expect(service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 0 }, false)).resolves.toBeDefined();
    });
  });

  describe('Customer transition constraints', () => {
    it('should reject reopening non-resolved/closed ticket', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'OPEN' });
      
      await expect(service.customerState(mockCustomer, 'ticket-id', 'OPEN', 0)).rejects.toThrow(BadRequestException);
    });

    it('should allow reopening resolved ticket', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'RESOLVED' });
      
      await expect(service.customerState(mockCustomer, 'ticket-id', 'OPEN', 0)).resolves.toBeDefined();
    });

    it('should allow reopening closed ticket', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'CLOSED' });
      
      await expect(service.customerState(mockCustomer, 'ticket-id', 'OPEN', 0)).resolves.toBeDefined();
    });

    it('should allow closing any ticket', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'OPEN' });
      
      await expect(service.customerState(mockCustomer, 'ticket-id', 'CLOSED', 0)).resolves.toBeDefined();
    });
  });

  describe('Assignment validation', () => {
    it('should reject assignment to non-support user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      
      await expect(service.update(mockSuperAdmin, 'ticket-id', { assignedTo: 'customer-id', expectedVersion: 0 })).rejects.toThrow(BadRequestException);
    });

    it('should accept assignment to support agent', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'agent-id', role: 'SUPPORT_AGENT', organization: { status: 'APPROVED' } });
      
      await expect(service.update(mockSuperAdmin, 'ticket-id', { assignedTo: 'agent-id', expectedVersion: 0 })).resolves.toBeDefined();
    });

    it('should accept assignment to super admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-id', role: 'SUPER_ADMIN', organization: { status: 'APPROVED' } });
      
      await expect(service.update(mockSuperAdmin, 'ticket-id', { assignedTo: 'admin-id', expectedVersion: 0 })).resolves.toBeDefined();
    });

    it('should accept assignment to operations admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'ops-admin-id', role: 'OPERATIONS_ADMIN', organization: { status: 'APPROVED' } });
      
      await expect(service.update(mockSuperAdmin, 'ticket-id', { assignedTo: 'ops-admin-id', expectedVersion: 0 })).resolves.toBeDefined();
    });

    it('should reject assignment to suspended user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null); // Filtered out by status check
      
      await expect(service.update(mockSuperAdmin, 'ticket-id', { assignedTo: 'suspended-agent-id', expectedVersion: 0 })).rejects.toThrow(BadRequestException);
    });

    it('should accept null assignment (unassign)', async () => {
      await expect(service.update(mockSuperAdmin, 'ticket-id', { assignedTo: null, expectedVersion: 0 })).resolves.toBeDefined();
    });
  });

  describe('Notification recipient scoping', () => {
    it('should notify support agents on customer ticket creation', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'agent-1', organizationId: 'agent-org-1' },
        { id: 'agent-2', organizationId: 'agent-org-2' },
      ]);
      
      await service.create(mockCustomer, {
        subject: 'Test',
        description: 'Test description',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ recipientId: 'agent-1', organizationId: 'agent-org-1' }),
          expect.objectContaining({ recipientId: 'agent-2', organizationId: 'agent-org-2' }),
        ]),
      });
    });

    it('should not notify actor', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'customer-id', organizationId: 'org-id' },
        { id: 'other-user', organizationId: 'org-id' },
      ]);
      
      await service.create(mockCustomer, {
        subject: 'Test',
        description: 'Test description',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      
      const createManyCall = mockPrisma.notification.createMany.mock.calls[0][0];
      expect(createManyCall.data.some((n: any) => n.recipientId === 'customer-id')).toBe(false);
    });

    it('should notify org members on admin reply', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'customer-id', organizationId: 'org-id' },
        { id: 'other-member', organizationId: 'org-id' },
      ]);
      
      await service.reply(mockSupportAgent, 'ticket-id', { body: 'Admin reply', expectedVersion: 0 }, true);
      
      expect(mockPrisma.notification.createMany).toHaveBeenCalled();
    });

    it('should scope notifications to recipient AND organization', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        { id: 'notif-1', recipientId: 'customer-id', organizationId: 'org-id' },
      ]);
      
      await service.notifications(mockCustomer);
      
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipientId: 'customer-id',
            organizationId: 'org-id',
          },
        })
      );
    });

    it('should prevent marking other user notification as read', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      
      await expect(service.markRead(mockCustomer, 'other-user-notif-id')).rejects.toThrow(NotFoundException);
    });

    it('should fallback to active support pool if assigned staff removed/suspended', async () => {
      // First call: assigned staff is suspended (empty result)
      // Second call: fallback to active support pool
      mockPrisma.user.findMany
        .mockResolvedValueOnce([]) // No active assigned staff
        .mockResolvedValueOnce([
          { id: 'fallback-agent-1', organizationId: 'admin-org-id' },
          { id: 'fallback-agent-2', organizationId: 'admin-org-id' },
        ]); // Active support pool
      
      mockPrisma.supportTicket.findFirst.mockResolvedValue({
        id: 'ticket-id',
        organizationId: 'org-id',
        assignedTo: 'suspended-agent-id',
        status: 'OPEN',
        version: 0,
      });
      
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({
        id: 'ticket-id',
        organizationId: 'org-id',
        assignedTo: 'suspended-agent-id',
        status: 'OPEN',
        version: 0,
      });
      
      mockPrisma.supportTicketReply.create.mockResolvedValue({
        id: 'reply-id',
        ticketId: 'ticket-id',
        authorId: 'customer-id',
        body: 'Customer reply',
      });
      
      await service.reply(mockCustomer, 'ticket-id', { body: 'Customer reply', expectedVersion: 0 }, false);
      
      // Verify fallback query was made
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.user.findMany).toHaveBeenNthCalledWith(2, 
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_AGENT'] },
            organization: { status: { notIn: ['SUSPENDED', 'REJECTED'] } },
          }),
        })
      );
      
      // Verify notifications were sent to fallback pool
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ recipientId: 'fallback-agent-1' }),
            expect.objectContaining({ recipientId: 'fallback-agent-2' }),
          ]),
        })
      );
    });
  });

  describe('Audit log creation', () => {
    it('should create audit log on ticket creation', async () => {
      await service.create(mockCustomer, {
        subject: 'Test',
        description: 'Test description',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      }, '192.0.2.1');
      
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-id',
            actorId: 'customer-id',
            action: 'SUPPORT_TICKET_CREATED',
            ip: '192.0.2.1',
            metadata: expect.objectContaining({
              category: 'TECHNICAL_SUPPORT',
              priority: 'NORMAL',
            }),
          }),
        })
      );
    });

    it('should create audit log on reply', async () => {
      await service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 0 }, false, '192.0.2.1');
      
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SUPPORT_TICKET_REPLIED',
            ip: '192.0.2.1',
            metadata: expect.objectContaining({
              bySupport: false,
            }),
          }),
        })
      );
    });

    it('should create audit log on status change', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'RESOLVED' });
      
      await service.customerState(mockCustomer, 'ticket-id', 'CLOSED', 0, '192.0.2.1');
      
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SUPPORT_TICKET_STATUS_CHANGED',
            metadata: expect.objectContaining({
              from: 'RESOLVED',
              to: 'CLOSED',
            }),
          }),
        })
      );
    });

    it('should create audit log on admin update', async () => {
      await service.update(mockSuperAdmin, 'ticket-id', { status: 'IN_PROGRESS', priority: 'HIGH', expectedVersion: 0 }, '192.0.2.1');
      
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SUPPORT_TICKET_UPDATED',
            metadata: expect.objectContaining({
              before: expect.any(Object),
              after: expect.any(Object),
            }),
          }),
        })
      );
    });

    it('should not include sensitive data in audit metadata', async () => {
      await service.create(mockCustomer, {
        subject: 'Password reset issue',
        description: 'My password is SecretPassword123',
        category: 'TECHNICAL_SUPPORT',
        priority: 'NORMAL',
      });
      
      const auditCall = mockPrisma.auditLog.create.mock.calls[0][0];
      // Audit should not include full description with sensitive data
      expect(auditCall.data.metadata).not.toHaveProperty('description');
    });
  });

  describe('Row locking', () => {
    it('should acquire row lock before reply', async () => {
      await service.reply(mockCustomer, 'ticket-id', { body: 'Reply', expectedVersion: 0 }, false);
      
      // Prisma uses tagged template literals, so check the call was made
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      const call = mockPrisma.$queryRaw.mock.calls[0];
      // First argument is array of strings, second is the ID
      expect(call[0][0]).toContain('SELECT id FROM support_tickets WHERE id =');
      expect(call[0][1]).toContain('FOR UPDATE');
    });

    it('should acquire row lock before status change', async () => {
      mockPrisma.supportTicket.findUniqueOrThrow.mockResolvedValue({ ...mockTicket, status: 'RESOLVED' });
      
      await service.customerState(mockCustomer, 'ticket-id', 'CLOSED', 0);
      
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      const call = mockPrisma.$queryRaw.mock.calls[0];
      expect(call[0][0]).toContain('SELECT id FROM support_tickets WHERE id =');
      expect(call[0][1]).toContain('FOR UPDATE');
    });

    it('should acquire row lock before admin update', async () => {
      await service.update(mockSuperAdmin, 'ticket-id', { status: 'IN_PROGRESS', expectedVersion: 0 });
      
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      const call = mockPrisma.$queryRaw.mock.calls[0];
      expect(call[0][0]).toContain('SELECT id FROM support_tickets WHERE id =');
      expect(call[0][1]).toContain('FOR UPDATE');
    });
  });

  describe('Admin update validation', () => {
    it('should reject update with no changes', async () => {
      await expect(service.update(mockSuperAdmin, 'ticket-id', { expectedVersion: 0 })).rejects.toThrow(BadRequestException);
    });

    it('should accept update with status change', async () => {
      await expect(service.update(mockSuperAdmin, 'ticket-id', { status: 'IN_PROGRESS', expectedVersion: 0 })).resolves.toBeDefined();
    });

    it('should accept update with priority change', async () => {
      await expect(service.update(mockSuperAdmin, 'ticket-id', { priority: 'HIGH', expectedVersion: 0 })).resolves.toBeDefined();
    });

    it('should accept update with assignment change', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'agent-id', role: 'SUPPORT_AGENT', organization: { status: 'APPROVED' } });
      
      await expect(service.update(mockSuperAdmin, 'ticket-id', { assignedTo: 'agent-id', expectedVersion: 0 })).resolves.toBeDefined();
    });
  });
});

console.log('✅ Support system unit tests loaded');
