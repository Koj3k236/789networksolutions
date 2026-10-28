import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const SKIP_INTEGRATION = !TEST_DB_URL;

describe.skipIf(SKIP_INTEGRATION)('PostgreSQL Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let request: any;
  let AuthService: any;
  const testOrgs: string[] = [];
  const testUsers: string[] = [];

  // Test fixtures - created once in setup
  let customerUser: any;
  let customerOrg: any;
  let adminUser: any;
  let adminOrg: any;

  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      console.log('⏭️  Skipping PostgreSQL integration tests: TEST_DATABASE_URL not set');
      return;
    }

    // Verify separate test database
    if (!new URL(TEST_DB_URL).pathname.toLowerCase().includes('test')) {
      throw new Error('TEST_DATABASE_URL must contain "test" or "_test" for safety');
    }

    // Set required environment variables BEFORE importing
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
    process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.WEB_ORIGIN = 'https://test.example.com';
    process.env.APP_MODE = 'DEMO';
    process.env.COOKIE_SECURE = 'false';

    prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });
    
    try {
      await prisma.$connect();
      console.log('✅ Connected to test database');
      
      // Dynamic imports AFTER env setup
      const { createApplication } = await import('../api/dist/main');
      const { AuthService: AuthSvc } = await import('../api/dist/auth/auth.service');
      request = (await import('supertest')).default;
      AuthService = AuthSvc;
      
      app = await createApplication();
      await app.init();
      console.log('✅ Application initialized');

      // Create test fixtures using AuthService (bypasses HTTP throttle)
      const authService = app.get(AuthService);

      // Customer fixture
      const customerEmail = `customer-fixture-${Date.now()}@example.com`;
      const customerResult = await authService.register({
        email: customerEmail,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!',
        fullName: 'Customer Fixture',
        businessName: 'Customer Business',
        country: 'US',
        phone: '+12025550101',
        address: '123 Test St',
        acceptTerms: true,
      }, '127.0.0.1');

      customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });
      customerOrg = await prisma.organization.findUnique({ where: { id: customerUser!.organizationId } });
      testUsers.push(customerUser!.id);
      testOrgs.push(customerOrg!.id);

      // Admin fixture
      adminOrg = await prisma.organization.create({
        data: {
          businessName: 'Admin Organization',
          country: 'US',
          phone: '+12025550100',
          address: '100 Admin St',
          status: 'APPROVED',
          mode: 'DEMO',
          productionEnabled: false,
        },
      });
      testOrgs.push(adminOrg.id);

      adminUser = await prisma.user.create({
        data: {
          email: `admin-fixture-${Date.now()}@example.com`,
          passwordHash: await (await import('../api/dist/common/crypto')).hashPassword('TestPassword123!'),
          fullName: 'Admin Fixture',
          role: 'SUPER_ADMIN',
          emailVerified: true,
          organizationId: adminOrg.id,
        },
      });
      testUsers.push(adminUser.id);

      console.log('✅ Test fixtures created');
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (SKIP_INTEGRATION) return;
    
    // Cleanup in FK order
    if (testOrgs.length > 0) {
      try {
        await prisma.auditLog.deleteMany({ where: { organizationId: { in: testOrgs } } });
        await prisma.loginHistory.deleteMany({ where: { userId: { in: testUsers } } });
        await prisma.actionToken.deleteMany({ where: { userId: { in: testUsers } } });
        await prisma.refreshToken.deleteMany({ where: { userId: { in: testUsers } } });
        const ownedEmails = await prisma.user.findMany({ where: { id: { in: testUsers } }, select: { email: true } });
        await prisma.developmentMessage.deleteMany({ where: { recipient: { in: ownedEmails.map(user => user.email) } } });
        await prisma.kycRequest.deleteMany({ where: { organizationId: { in: testOrgs } } });
        await prisma.callDetailRecord.deleteMany({ where: { organizationId: { in: testOrgs } } });
        await prisma.ledgerEntry.deleteMany({ where: { wallet: { organizationId: { in: testOrgs } } } });
        await prisma.wallet.deleteMany({ where: { organizationId: { in: testOrgs } } });
        await prisma.phoneNumber.deleteMany({ where: { organizationId: { in: testOrgs } } });
        await prisma.sipTrunk.deleteMany({ where: { organizationId: { in: testOrgs } } });
        await prisma.user.deleteMany({ where: { id: { in: testUsers } } });
        await prisma.organization.deleteMany({ where: { id: { in: testOrgs } } });
        console.log(`✅ Cleaned up ${testOrgs.length} test organizations`);
      } catch (error) {
        console.error('❌ Cleanup error:', error);
      }
    }
    
    await prisma.$disconnect();
    await app?.close();
    console.log('✅ Test cleanup completed');
  });

  describe('Authentication & Registration', () => {
    it('should register a new account with Origin header', async () => {
      const email = `register-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
      
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Origin', 'https://test.example.com')
        .send({
          email,
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+12025550199',
          address: '123 Test St',
          acceptTerms: true,
        })
        .expect(201);

      expect(response.body.message).toContain('Account created');
      expect(response.body.mode).toBe('DEMO');

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeTruthy();
      expect(user!.role).toBe('CUSTOMER');
      
      testUsers.push(user!.id);
      testOrgs.push(user!.organizationId);

      const org = await prisma.organization.findUnique({ where: { id: user!.organizationId } });
      expect(org!.status).toBe('PENDING_VERIFICATION');
      expect(org!.productionEnabled).toBe(false);
    });

    it('should login with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://test.example.com')
        .send({
          email: customerUser.email,
          password: 'TestPassword123!',
        })
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe(customerUser.email);
      
      const cookies = response.headers['set-cookie'];
      expect(cookies.some((c: string) => c.startsWith('refresh='))).toBe(true);
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://test.example.com')
        .send({
          email: customerUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('incorrect');
    });

    it('should verify email with valid token', async () => {
      const email = `verify-${Date.now()}@example.com`;
      
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Origin', 'https://test.example.com')
        .send({
          email,
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+12025550199',
          address: '123 Test St',
          acceptTerms: true,
        });

      const user = await prisma.user.findUnique({ where: { email } });
      testUsers.push(user!.id);
      testOrgs.push(user!.organizationId);

      const message = await prisma.developmentMessage.findFirst({
        where: { recipient: email },
        orderBy: { createdAt: 'desc' },
      });
      expect(message).toBeTruthy();

      const { decrypt } = await import('../api/dist/common/crypto');
      const url = decrypt(message!.bodyEncrypted);
      const token = url.split('token=')[1];

      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'https://test.example.com')
        .send({ token })
        .expect(201);

      const updatedUser = await prisma.user.findUnique({ where: { email } });
      expect(updatedUser!.emailVerified).toBe(true);
    });

    it('should refresh access token with Origin header', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://test.example.com')
        .send({ email: customerUser.email, password: 'TestPassword123!' });

      const cookies = loginResponse.headers['set-cookie'];
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh='));

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie!)
        .set('Origin', 'https://test.example.com')
        .expect(201);

      expect(refreshResponse.body.accessToken).toBeDefined();
      expect(refreshResponse.body.accessToken).not.toBe(loginResponse.body.accessToken);
    });

    it('should reject refresh without Origin header', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://test.example.com')
        .send({ email: customerUser.email, password: 'TestPassword123!' });

      const cookies = loginResponse.headers['set-cookie'];
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh='));

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie!)
        .expect(403);
    });

    it('should enforce rate limiting in an isolated application instance', async () => {
      const { createApplication } = await import('../api/dist/main');
      const isolated = await createApplication();
      await isolated.init();
      try {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
          const response = await request(isolated.getHttpServer())
            .post('/api/v1/auth/register')
            .set('Origin', 'https://test.example.com')
            .send({}); // Invalid body: no account can be created by this abuse test.
          statuses.push(response.status);
        }
        expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
        expect(statuses[5]).toBe(429);
      } finally {
        await isolated.close();
      }
    });
  });

  describe('RBAC & Authorization', () => {
    it('should allow customer to access dashboard', async () => {
      const login = { body: await app.get(AuthService).login(
        { email: customerUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      ) };

      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(response.body.organization.id).toBe(customerOrg.id);
    });

    it('should deny customer access to admin endpoints', async () => {
      const login = { body: await app.get(AuthService).login(
        { email: customerUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      ) };

      await request(app.getHttpServer())
        .get('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(403);
    });

    it('should allow admin to access admin endpoints', async () => {
      const { accessToken: token } = await app.get(AuthService).login(
        { email: adminUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate CDR data between tenants', async () => {
      const email2 = `tenant2-${Date.now()}@example.com`;
      
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Origin', 'https://test.example.com')
        .send({
          email: email2,
          password: 'Password123!',
          confirmPassword: 'Password123!',
          fullName: 'User 2',
          businessName: 'Business 2',
          country: 'US',
          phone: '+12025550102',
          address: '456 Test St',
          acceptTerms: true,
        });

      const user2 = await prisma.user.findUnique({ where: { email: email2 } });
      testUsers.push(user2!.id);
      testOrgs.push(user2!.organizationId);
      const { loadDemoDataset } = await import('../api/dist/demo/dataset');
      await loadDemoDataset(prisma, user2!.organizationId, user2!.id);

      const login1 = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://test.example.com')
        .send({ email: customerUser.email, password: 'TestPassword123!' });

      const login2 = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://test.example.com')
        .send({ email: email2, password: 'Password123!' });

      const cdr1 = await request(app.getHttpServer())
        .get('/api/v1/cdr')
        .set('Authorization', `Bearer ${login1.body.accessToken}`)
        .expect(200);

      const cdr2 = await request(app.getHttpServer())
        .get('/api/v1/cdr')
        .set('Authorization', `Bearer ${login2.body.accessToken}`)
        .expect(200);

      // Assert nonempty data exists in tenant 2, while tenant 1 remains empty.
      expect(cdr1.body.total).toBe(0);
      expect(cdr2.body.total).toBe(96);
      expect(cdr2.body.items.length).toBe(25);
      // Verify all CDR items belong to correct tenant
      for (const item of cdr1.body.items) {
        expect(item.organizationId).toBe(customerOrg.id);
      }
      for (const item of cdr2.body.items) {
        expect(item.organizationId).toBe(user2!.organizationId);
      }
    });
  });

  describe('Demo Dataset Idempotency', () => {
    it('should prevent duplicate demo dataset creation', async () => {
      const login = { body: await app.get(AuthService).login(
        { email: customerUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      ) };

      const response1 = await request(app.getHttpServer())
        .post('/api/v1/demo/dataset')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .set('Origin', 'https://test.example.com')
        .expect(201);

      expect(response1.body.created).toBe(true);

      const response2 = await request(app.getHttpServer())
        .post('/api/v1/demo/dataset')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .set('Origin', 'https://test.example.com')
        .expect(201);

      expect(response2.body.created).toBe(false);
      expect(response2.body.message).toContain('already has the demo dataset');
    });
  });

  describe('Admin Operations', () => {
    it('should block admin self-modification', async () => {
      const { accessToken: token } = await app.get(AuthService).login(
        { email: adminUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      );

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/customers/${adminOrg.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'https://test.example.com')
        .send({ status: 'SUSPENDED', reason: 'Test reason' })
        .expect(400);

      expect(response.body.message).toContain('cannot change their own organization');
    });

    it('should block approval of non-verified users', async () => {
      const { accessToken: token } = await app.get(AuthService).login(
        { email: adminUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      );

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/customers/${customerOrg.id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'https://test.example.com')
        .send({ status: 'APPROVED', reason: 'Test approval' })
        .expect(400);

      expect(response.body.message).toContain('verify their email first');
    });

    it('should revoke sessions on suspension', async () => {
      const email = `suspend-${Date.now()}@example.com`;
      
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Origin', 'https://test.example.com')
        .send({
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+12025550199',
          address: '123 Test St',
          acceptTerms: true,
        });

      const user = await prisma.user.findUnique({ where: { email } });
      testUsers.push(user!.id);
      testOrgs.push(user!.organizationId);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://test.example.com')
        .send({ email, password: 'Password123!' });

      const sessionBefore = await prisma.refreshToken.findFirst({
        where: { userId: user!.id, revokedAt: null },
      });
      expect(sessionBefore).toBeTruthy();

      const { accessToken: token } = await app.get(AuthService).login(
        { email: adminUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/customers/${user!.organizationId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('Origin', 'https://test.example.com')
        .send({ status: 'SUSPENDED', reason: 'Test suspension' })
        .expect(200);

      const sessionAfter = await prisma.refreshToken.findFirst({
        where: { userId: user!.id, revokedAt: null },
      });
      expect(sessionAfter).toBeNull();
    });
  });

  describe('Production Safety', () => {
    it('should enforce DEMO mode only', async () => {
      expect(customerOrg.mode).toBe('DEMO');
      expect(customerOrg.productionEnabled).toBe(false);
    });

    it('should reject production calling', async () => {
      const login = { body: await app.get(AuthService).login(
        { email: customerUser.email, password: 'TestPassword123!' }, '127.0.0.1', 'integration-test'
      ) };

      const response = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .set('Origin', 'https://test.example.com')
        .send({ destination: '+12025550199' })
        .expect(501);

      expect(response.body.code).toBe('CAPABILITY_UNAVAILABLE');
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Origin', 'https://test.example.com')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          fullName: 'Test User',
          businessName: 'Test Business',
          country: 'US',
          phone: '+12025550199',
          address: '123 Test St',
          acceptTerms: true,
        })
        .expect(400);
    });

    it('should reject missing required fields in an isolated validator request', async () => {
      const { createApplication } = await import('../api/dist/main');
      const isolated = await createApplication();
      await isolated.init();
      try {
        await request(isolated.getHttpServer())
          .post('/api/v1/auth/register')
          .set('Origin', 'https://test.example.com')
          .send({ email: 'test@example.com', password: 'Password123!' })
          .expect(400);
      } finally {
        await isolated.close();
      }
    });
  });
});

if (SKIP_INTEGRATION) {
  console.log('\n⏭️  PostgreSQL integration tests skipped: TEST_DATABASE_URL not set');
  console.log('   To run: TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/test_db yarn vitest run\n');
}
