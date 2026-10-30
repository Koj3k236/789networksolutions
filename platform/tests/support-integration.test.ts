import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SupportService } from '../api/dist/support/support.service';
import { hashPassword } from '../api/dist/common/crypto';
import { randomUUID } from 'crypto';

// Skip all tests if TEST_DATABASE_URL is not set
const skipIntegration = !process.env.TEST_DATABASE_URL;
const describeIntegration = skipIntegration ? describe.skip : describe;

describeIntegration('Support System - Integration Tests (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let service: SupportService;

  // Test fixture IDs tracked for cleanup
  let testOrgId: string;
  let testAdminOrgId: string;
  let testCustomerId: string;
  let testSupportAgentId: string;
  let testSuperAdminId: string;
  let testTicketId: string;
  let testReplyId: string;
  let testNotificationId: string;

  beforeEach(async () => {
    testOrgId = ''; testAdminOrgId = '';
    testCustomerId = ''; testSupportAgentId = ''; testSuperAdminId = '';
    testTicketId = ''; testReplyId = ''; testNotificationId = '';
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

    // Create admin organization for support staff
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

    const customerUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `customer-${uniqueId}@test.example`,
        fullName: 'Test Customer',
        passwordHash,
        role: 'CUSTOMER',
        emailVerified: true,
      },
    });
    testCustomerId = customerUser.id;

    const supportAgentUser = await prisma.user.create({
      data: {
        organizationId: adminOrg.id,
        email: `support-${uniqueId}@test.example`,
        fullName: 'Support Agent',
        passwordHash,
        role: 'SUPPORT_AGENT',
        emailVerified: true,
      },
    });
    testSupportAgentId = supportAgentUser.id;

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

    // Initialize service with real Prisma client
    service = new SupportService(prisma as any);
  });

  afterEach(async () => {
    if (skipIntegration || !prisma) return;

    try {
      // Guard every cleanup scope, including failures before a ticket ID is returned.
      // Delete only records attached to this test's tracked organization.
      if (testOrgId) {
        await prisma.notification.deleteMany({where:{ticket:{organizationId:testOrgId}}});
        await prisma.supportTicketReply.deleteMany({where:{ticket:{organizationId:testOrgId}}});
        await prisma.supportTicket.deleteMany({where:{organizationId:testOrgId}});
        await prisma.auditLog.deleteMany({where:{organizationId:testOrgId}});
        await prisma.user.deleteMany({where:{organizationId:testOrgId}});
        await prisma.organization.deleteMany({where:{id:testOrgId}});
      }
      if (testAdminOrgId) {
        await prisma.notification.deleteMany({where:{organizationId:testAdminOrgId}});
        await prisma.auditLog.deleteMany({where:{organizationId:testAdminOrgId}});
        await prisma.user.deleteMany({where:{organizationId:testAdminOrgId}});
        await prisma.organization.deleteMany({where:{id:testAdminOrgId}});
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('should create persistent ticket and reload from database', async () => {
    const actor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    
    const result = await service.create(actor, {
      subject: 'Test ticket subject',
      description: 'This is a test ticket description with enough characters',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });

    testTicketId = result.id;
    expect(result.id).toBeTruthy();
    expect(result.status).toBe('OPEN');
    expect(result.version).toBe(0);

    // Reload from database
    const reloaded = await prisma.supportTicket.findUnique({ where: { id: result.id } });
    expect(reloaded).toBeTruthy();
    expect(reloaded!.subject).toBe('Test ticket subject');
    expect(reloaded!.organizationId).toBe(testOrgId);
  });

  it('should persist reply and audit log', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description for reply test',
      category: 'BILLING',
      priority: 'HIGH',
    });
    testTicketId = ticket.id;

    // Add reply as support agent
    const reply = await service.reply(supportActor, ticket.id, {
      expectedVersion: 0,
      body: 'This is a support reply',
    }, true);

    testReplyId = reply.id;
    expect(reply.id).toBeTruthy();

    // Verify reply persisted
    const reloadedReply = await prisma.supportTicketReply.findUnique({ where: { id: reply.id } });
    expect(reloadedReply).toBeTruthy();
    expect(reloadedReply!.body).toBe('This is a support reply');
    expect(reloadedReply!.authorId).toBe(testSupportAgentId);

    // Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: ticket.id, action: 'SUPPORT_TICKET_REPLIED' },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });

  it('should enforce customer/admin isolation', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket as customer
    const ticket = await service.create(customerActor, {
      subject: 'Customer ticket',
      description: 'This ticket should be isolated to customer org',
      category: 'GENERAL',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Customer can see their own ticket
    const customerView = await service.detail(customerActor, ticket.id, false);
    expect(customerView.id).toBe(ticket.id);

    // Admin can see ticket with admin flag
    const adminView = await service.detail(supportActor, ticket.id, true);
    expect(adminView.id).toBe(ticket.id);

    // Even a support actor using the customer path is scoped to their own tenant.
    await expect(service.detail(supportActor,ticket.id,false)).rejects.toMatchObject({status:404});
  });

  it('should reject wrong role with 403', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Customer trying to use admin functions should fail
    await expect(
      service.update(customerActor, ticket.id, {
        expectedVersion: 0,
        status: 'IN_PROGRESS',
      })
    ).rejects.toThrow();
  });

  it('should handle priority/status/assignment updates', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Update priority and status
    const updated = await service.update(supportActor, ticket.id, {
      expectedVersion: 0,
      priority: 'URGENT',
      status: 'IN_PROGRESS',
    });

    expect(updated.priority).toBe('URGENT');
    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.version).toBe(1);

    // Assign to support agent
    const assigned = await service.update(supportActor, ticket.id, {
      expectedVersion: 1,
      assignedTo: testSupportAgentId,
    });

    expect(assigned.assignedTo).toBe(testSupportAgentId);
    expect(assigned.version).toBe(2);
  });

  it('should send notifications to correct recipients', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket (should notify support)
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Check support agent received notification
    const supportNotifications = await prisma.notification.findMany({
      where: { recipientId: testSupportAgentId, ticketId: ticket.id },
    });
    expect(supportNotifications.length).toBeGreaterThan(0);

    // Reply as support (should notify customer)
    await service.reply(supportActor, ticket.id, {
      expectedVersion: 0,
      body: 'Support reply',
    }, true);

    // Check customer received notification
    const customerNotifications = await prisma.notification.findMany({
      where: { recipientId: testCustomerId, ticketId: ticket.id },
    });
    expect(customerNotifications.length).toBeGreaterThan(0);
  });

  it('should mark notifications as read', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };

    // Create ticket to generate notification
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Get notifications
    const notifications = await service.notifications(customerActor);
    expect(notifications.items).toBeDefined();

    // Mark all as read
    const result = await service.markAllRead(customerActor);
    expect(result.updated).toBeGreaterThanOrEqual(0);

    // Verify unread count is 0
    const afterRead = await service.notifications(customerActor);
    expect(afterRead.unread).toBe(0);
  });

  it('should reject stale version with 409', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Update ticket (version becomes 1)
    await service.update(supportActor, ticket.id, {
      expectedVersion: 0,
      status: 'IN_PROGRESS',
    });

    // Try to update with stale version 0
    await expect(
      service.update(supportActor, ticket.id, {
        expectedVersion: 0,
        priority: 'HIGH',
      })
    ).rejects.toThrow('Ticket changed');
  });

  it('should block replies to closed tickets', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Close ticket
    await service.update(supportActor, ticket.id, {
      expectedVersion: 0,
      status: 'CLOSED',
    });

    // Try to reply to closed ticket
    await expect(
      service.reply(customerActor, ticket.id, {
        expectedVersion: 1,
        body: 'Reply to closed ticket',
      }, false)
    ).rejects.toThrow('Reopen the ticket');
  });

  it('should allow reopening resolved/closed tickets', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Resolve ticket
    await service.update(supportActor, ticket.id, {
      expectedVersion: 0,
      status: 'RESOLVED',
    });

    // Reopen ticket
    const reopened = await service.customerState(customerActor, ticket.id, 'OPEN', 1);
    expect(reopened.status).toBe('OPEN');
    expect(reopened.version).toBe(2);
  });

  it('should reject reopening non-resolved/closed tickets', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };

    // Create ticket (status is OPEN)
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Try to reopen already open ticket
    await expect(
      service.customerState(customerActor, ticket.id, 'OPEN', 0)
    ).rejects.toThrow('Only a resolved or closed ticket can be reopened');
  });

  it('should fallback to active support pool if assigned staff removed/suspended', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket assigned to support agent
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Assign to support agent
    await service.update(supportActor, ticket.id, {
      expectedVersion: 0,
      assignedTo: testSupportAgentId,
    });

    // Suspend the assigned support agent's organization
    await prisma.organization.update({
      where: { id: testAdminOrgId },
      data: { status: 'SUSPENDED' },
    });

    // Reply as customer (should trigger notification fallback)
    await service.reply(customerActor, ticket.id, {
      expectedVersion: 1,
      body: 'Customer reply after agent suspended',
    }, false);

    // Verify notification was sent to active support pool (super admin)
    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id, recipientId: testSuperAdminId },
    });
    expect(notifications.length).toBeGreaterThan(0);

    // Restore organization status for cleanup
    await prisma.organization.update({
      where: { id: testAdminOrgId },
      data: { status: 'APPROVED' },
    });
  });

  it('should validate assignment to active support staff only', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Try to assign to non-existent user
    await expect(
      service.update(supportActor, ticket.id, {
        expectedVersion: 0,
        assignedTo: randomUUID(),
      })
    ).rejects.toThrow('Assignee must be an active authorized support administrator');

    // Try to assign to customer (wrong role)
    await expect(
      service.update(supportActor, ticket.id, {
        expectedVersion: 0,
        assignedTo: testCustomerId,
      })
    ).rejects.toThrow('Assignee must be an active authorized support administrator');
  });

  it('should allow clearing assignment with null', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Assign to support agent
    await service.update(supportActor, ticket.id, {
      expectedVersion: 0,
      assignedTo: testSupportAgentId,
    });

    // Clear assignment with null
    const cleared = await service.update(supportActor, ticket.id, {
      expectedVersion: 1,
      assignedTo: null,
    });

    expect(cleared.assignedTo).toBeNull();
    expect(cleared.version).toBe(2);
  });

  it('should reject admin update with no changes', async () => {
    const customerActor = { id: testCustomerId, organizationId: testOrgId, role: 'CUSTOMER' as const };
    const supportActor = { id: testSupportAgentId, organizationId: testAdminOrgId, role: 'SUPPORT_AGENT' as const };

    // Create ticket
    const ticket = await service.create(customerActor, {
      subject: 'Test ticket',
      description: 'Test description',
      category: 'TECHNICAL_SUPPORT',
      priority: 'NORMAL',
    });
    testTicketId = ticket.id;

    // Try to update with no changes
    await expect(
      service.update(supportActor, ticket.id, {
        expectedVersion: 0,
      })
    ).rejects.toThrow('Provide a status, priority, or assignment change');
  });
});
