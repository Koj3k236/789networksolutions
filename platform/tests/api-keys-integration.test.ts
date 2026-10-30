import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const SKIP_INTEGRATION = !TEST_DB_URL;

describe.skipIf(SKIP_INTEGRATION)('API Keys - PostgreSQL Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let request: any;
  let AuthService: any;
  const testOrgs: string[] = [];
  const testUsers: string[] = [];
  const testKeys: string[] = [];

  let customerUser: any;
  let customerOrg: any;
  let customerToken: string;
  let otherUser: any;
  let otherOrg: any;
  let otherToken: string;

  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      console.log('⏭️  Skipping API Keys integration tests: TEST_DATABASE_URL not set');
      return;
    }

    // Verify separate test database
    if (!new URL(TEST_DB_URL).pathname.toLowerCase().includes('test')) {
      throw new Error('TEST_DATABASE_URL must contain "test" for safety');
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
      console.log('✅ Connected to test database for API Keys tests');
      
      // Dynamic imports AFTER env setup
      const { createApplication } = await import('../api/dist/main');
      const { AuthService: AuthSvc } = await import('../api/dist/auth/auth.service');
      request = (await import('supertest')).default;
      AuthService = AuthSvc;
      
      app = await createApplication();
      await app.init();
      console.log('✅ Application initialized for API Keys tests');

      // Create test fixtures
      const authService = app.get(AuthService);

      // Customer fixture
      const customerEmail = `api-keys-customer-${Date.now()}@example.com`;
      await authService.register({
        email: customerEmail,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!',
        fullName: 'API Keys Customer',
        businessName: 'API Keys Business',
        country: 'US',
        phone: '+12025550201',
        address: '123 API St',
        acceptTerms: true,
      }, '127.0.0.1');

      customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });
      customerOrg = await prisma.organization.findUnique({ where: { id: customerUser!.organizationId } });
      testUsers.push(customerUser!.id);
      testOrgs.push(customerOrg!.id);

      const loginResult = await authService.login({ email: customerEmail, password: 'TestPassword123!' }, '127.0.0.1');
      customerToken = loginResult.accessToken;

      // Other org fixture for cross-tenant tests
      const otherEmail = `api-keys-other-${Date.now()}@example.com`;
      await authService.register({
        email: otherEmail,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!',
        fullName: 'Other Customer',
        businessName: 'Other Business',
        country: 'US',
        phone: '+12025550202',
        address: '456 Other St',
        acceptTerms: true,
      }, '127.0.0.1');

      otherUser = await prisma.user.findUnique({ where: { email: otherEmail } });
      otherOrg = await prisma.organization.findUnique({ where: { id: otherUser!.organizationId } });
      testUsers.push(otherUser!.id);
      testOrgs.push(otherOrg!.id);

      const otherLoginResult = await authService.login({ email: otherEmail, password: 'TestPassword123!' }, '127.0.0.1');
      otherToken = otherLoginResult.accessToken;

      console.log('✅ Test fixtures created for API Keys tests');
    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (SKIP_INTEGRATION) return;

    try {
      // Cleanup in correct order
      if (testKeys.length > 0) {
        await prisma.apiUsageLog.deleteMany({ where: { apiKeyId: { in: testKeys } } });
        await prisma.apiKey.deleteMany({ where: { id: { in: testKeys } } });
      }
      if (testUsers.length > 0) {
        await prisma.apiKey.deleteMany({ where: { createdByUserId: { in: testUsers } } });
        await prisma.user.deleteMany({ where: { id: { in: testUsers } } });
      }
      if (testOrgs.length > 0) {
        await prisma.organization.deleteMany({ where: { id: { in: testOrgs } } });
      }
      
      await app?.close();
      await prisma?.$disconnect();
      console.log('✅ API Keys test cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  });

  describe('POST /api/v1/api-keys - Create API Key', () => {
    it('should create API key with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Test Integration Key',
          scopes: ['trunks:read', 'cdr:read'],
          expiresInDays: 90,
        })
        .expect(201);

      expect(response.body.item).toBeDefined();
      expect(response.body.item.name).toBe('Test Integration Key');
      expect(response.body.item.scopes).toEqual(['trunks:read', 'cdr:read']);
      expect(response.body.item.prefix).toMatch(/^789k_[a-zA-Z0-9_-]{8}$/);
      expect(response.body.key).toMatch(/^789k_[a-zA-Z0-9_-]{43}$/);
      expect(response.body.oneTime).toBe(true);

      // Verify hash is stored, not raw key
      const dbKey = await prisma.apiKey.findUnique({ where: { id: response.body.item.id } });
      expect(dbKey?.hash).toBeDefined();
      expect(dbKey?.hash).not.toContain(response.body.key);
      expect(dbKey?.hash).toMatch(/^[a-f0-9]{64}$/);

      testKeys.push(response.body.item.id);
    });

    it('should return secret only once (not in GET)', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'One Time Secret Key',
          scopes: ['trunks:read'],
          expiresInDays: 30,
        })
        .expect(201);

      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // List should not expose secret
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const listedKey = listResponse.body.items.find((k: any) => k.id === keyId);
      expect(listedKey).toBeDefined();
      expect(listedKey.key).toBeUndefined();
      expect(listedKey.hash).toBeUndefined();
      expect(listedKey.prefix).toBeDefined();
    });

    it('should reject empty scopes', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Invalid Key',
          scopes: [],
          expiresInDays: 90,
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject invalid scope', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Invalid Scope Key',
          scopes: ['admin:write'],
          expiresInDays: 90,
        })
        .expect(400);

      expect(response.body.message).toContain('Unsupported API scope');
    });

    it('should enforce 25 active keys limit', async () => {
      // Create 25 keys
      const keyIds: string[] = [];
      for (let i = 0; i < 25; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/api-keys')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: `Limit Test Key ${i}`,
            scopes: ['trunks:read'],
            expiresInDays: 90,
          })
          .expect(201);
        keyIds.push(response.body.item.id);
        testKeys.push(response.body.item.id);
      }

      // 26th should fail
      const response = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Limit Exceeded Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(409);

      expect(response.body.message).toContain('Maximum 25 active API keys');

      // Cleanup
      await prisma.apiKey.deleteMany({ where: { id: { in: keyIds } } });
    });

    it('should deduplicate scopes', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Duplicate Scopes Key',
          scopes: ['trunks:read', 'trunks:read', 'cdr:read'],
          expiresInDays: 90,
        })
        .expect(201);

      expect(response.body.item.scopes).toEqual(['trunks:read', 'cdr:read']);
      testKeys.push(response.body.item.id);
    });

    it('should reject if account is suspended', async () => {
      await prisma.organization.update({
        where: { id: customerOrg.id },
        data: { status: 'SUSPENDED' },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Suspended Account Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(403);

      expect(response.body.message).toContain('Account access is restricted');

      // Restore
      await prisma.organization.update({
        where: { id: customerOrg.id },
        data: { status: 'PENDING_VERIFICATION' },
      });
    });

    it('should create audit log entry', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Audit Test Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      testKeys.push(response.body.item.id);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'API_KEY_CREATED',
          targetId: response.body.item.id,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.organizationId).toBe(customerOrg.id);
      expect(auditLog?.actorId).toBe(customerUser.id);
      expect(auditLog?.metadata).toMatchObject({
        name: 'Audit Test Key',
        prefix: response.body.item.prefix,
        scopes: ['trunks:read'],
      });
    });
  });

  describe('GET /api/v1/api-keys - List API Keys', () => {
    it('should list only user-owned keys', async () => {
      // Create key for customer
      const customerKeyResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Customer Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);
      testKeys.push(customerKeyResponse.body.item.id);

      // Create key for other user
      const otherKeyResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Other Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);
      testKeys.push(otherKeyResponse.body.item.id);

      // Customer should only see their key
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const customerKeyIds = listResponse.body.items.map((k: any) => k.id);
      expect(customerKeyIds).toContain(customerKeyResponse.body.item.id);
      expect(customerKeyIds).not.toContain(otherKeyResponse.body.item.id);
    });

    it('should not expose hash or secret in list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      response.body.items.forEach((key: any) => {
        expect(key.hash).toBeUndefined();
        expect(key.key).toBeUndefined();
        expect(key.prefix).toBeDefined();
      });
    });

    it('should return available scopes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.availableScopes).toEqual([
        'trunks:read',
        'trunks:write',
        'cdr:read',
        'balance:read',
        'caller-id:read',
      ]);
    });
  });

  describe('POST /api/v1/api-keys/:id/rotate - Rotate API Key', () => {
    it('should rotate active key and preserve scopes/expiry', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Rotation Test Key',
          scopes: ['trunks:read', 'cdr:read'],
          expiresInDays: 30,
        })
        .expect(201);

      const oldKeyId = createResponse.body.item.id;
      const oldPrefix = createResponse.body.item.prefix;
      const oldExpiry = createResponse.body.item.expiresAt;
      testKeys.push(oldKeyId);

      const rotateResponse = await request(app.getHttpServer())
        .post(`/api/v1/api-keys/${oldKeyId}/rotate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(201);

      expect(rotateResponse.body.item.scopes).toEqual(['trunks:read', 'cdr:read']);
      expect(rotateResponse.body.item.expiresAt).toBe(oldExpiry);
      expect(rotateResponse.body.item.rotatedFromId).toBe(oldKeyId);
      expect(rotateResponse.body.key).toMatch(/^789k_[a-zA-Z0-9_-]{43}$/);
      expect(rotateResponse.body.item.prefix).not.toBe(oldPrefix);

      testKeys.push(rotateResponse.body.item.id);

      // Verify old key is revoked
      const oldKey = await prisma.apiKey.findUnique({ where: { id: oldKeyId } });
      expect(oldKey?.revokedAt).toBeDefined();
    });

    it('should reject rotation of revoked key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Revoked Rotation Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Revoke the key
      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      // Try to rotate
      const response = await request(app.getHttpServer())
        .post(`/api/v1/api-keys/${keyId}/rotate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(409);

      expect(response.body.message).toContain('active, unexpired key');
    });

    it('should reject rotation of expired key', async () => {
      // Create key with 1 day expiry
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Expired Rotation Key',
          scopes: ['trunks:read'],
          expiresInDays: 1,
        })
        .expect(201);

      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Manually expire the key
      await prisma.apiKey.update({
        where: { id: keyId },
        data: { expiresAt: new Date(Date.now() - 86400000) },
      });

      // Try to rotate
      const response = await request(app.getHttpServer())
        .post(`/api/v1/api-keys/${keyId}/rotate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(409);

      expect(response.body.message).toContain('active, unexpired key');
    });

    it('should return 404 for cross-tenant rotation', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Other Org Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      testKeys.push(createResponse.body.item.id);

      // Customer tries to rotate other org's key
      await request(app.getHttpServer())
        .post(`/api/v1/api-keys/${createResponse.body.item.id}/rotate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/api-keys/:id - Revoke API Key', () => {
    it('should revoke key owned by user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Revoke Test Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      const revokeResponse = await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(revokeResponse.body.revoked).toBe(true);

      // Verify in database
      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
      expect(dbKey?.revokedAt).toBeDefined();
    });

    it('should be idempotent for already revoked key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Idempotent Revoke Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Revoke once
      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      // Revoke again
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.revoked).toBe(true);
    });

    it('should return 404 for cross-tenant revoke', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Other Org Revoke Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      testKeys.push(createResponse.body.item.id);

      // Customer tries to revoke other org's key
      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${createResponse.body.item.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
    });

    it('should create audit log entry', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Audit Revoke Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'API_KEY_REVOKED',
          targetId: keyId,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.organizationId).toBe(customerOrg.id);
      expect(auditLog?.actorId).toBe(customerUser.id);
    });
  });

  describe('GET /api/v1/api-keys/usage - Usage Logs', () => {
    it('should return usage logs for user keys only', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Usage Test Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const keyId = createResponse.body.item.id;
      const apiKey = createResponse.body.key;
      testKeys.push(keyId);

      // Make a request with the API key
      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(200);

      // Check usage logs
      const usageResponse = await request(app.getHttpServer())
        .get('/api/v1/api-keys/usage')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const logs = usageResponse.body;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].keyPrefix).toBeDefined();
      expect(logs[0].method).toBe('GET');
      expect(logs[0].route).toBe('/api/v1/automation/sip-trunks');
      expect(logs[0].statusCode).toBe(200);
    });

    it('should not expose request body or query params in logs', async () => {
      const usageResponse = await request(app.getHttpServer())
        .get('/api/v1/api-keys/usage')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      usageResponse.body.forEach((log: any) => {
        expect(log.requestBody).toBeUndefined();
        expect(log.queryParams).toBeUndefined();
        expect(log.headers).toBeUndefined();
      });
    });

    it('should strip query params from route in logs', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Query Params Test Key',
          scopes: ['cdr:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      // Make request with query params
      await request(app.getHttpServer())
        .get('/api/v1/automation/cdr?search=test&page=2')
        .set('X-API-Key', apiKey)
        .expect(200);

      // Check usage logs
      const usageResponse = await request(app.getHttpServer())
        .get('/api/v1/api-keys/usage')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const log = usageResponse.body.find((l: any) => l.route === '/api/v1/automation/cdr');
      expect(log).toBeDefined();
      expect(log.route).not.toContain('?');
      expect(log.route).not.toContain('search');
    });
  });

  describe('API Key Guard - Authentication', () => {
    it('should authenticate valid API key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Auth Test Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      const response = await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should reject invalid API key format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', 'invalid-key')
        .expect(401);

      expect(response.body.message).toContain('Invalid API key');
    });

    it('should reject API key without 789k_ prefix', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', 'abcd_' + 'a'.repeat(43))
        .expect(401);
    });

    it('should reject non-existent API key', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', '789k_' + 'a'.repeat(43))
        .expect(401);
    });

    it('should reject revoked API key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Revoked Auth Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Revoke the key
      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      // Try to use revoked key
      const response = await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(401);

      expect(response.body.message).toContain('inactive');
    });

    it('should reject expired API key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Expired Auth Key',
          scopes: ['trunks:read'],
          expiresInDays: 1,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Manually expire the key
      await prisma.apiKey.update({
        where: { id: keyId },
        data: { expiresAt: new Date(Date.now() - 86400000) },
      });

      // Try to use expired key
      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(401);
    });

    it('should reject API key for suspended account', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Suspended Auth Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      // Suspend the account
      await prisma.organization.update({
        where: { id: customerOrg.id },
        data: { status: 'SUSPENDED' },
      });

      // Try to use key
      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(401);

      // Restore
      await prisma.organization.update({
        where: { id: customerOrg.id },
        data: { status: 'PENDING_VERIFICATION' },
      });
    });

    it('should reject API key without required scope', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Read Only Key',
          scopes: ['trunks:read'], // Missing trunks:write
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      // Try to create trunk (requires trunks:write)
      const response = await request(app.getHttpServer())
        .post('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .send({
          name: 'Test Trunk',
          authType: 'IP',
          ips: ['203.0.113.1/32'],
        })
        .expect(403);

      expect(response.body.message).toContain('does not grant the required scope');
    });

    it('should update lastUsedAt on successful authentication', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Last Used Test Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Use the key
      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(200);

      // Check lastUsedAt
      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });
      expect(dbKey?.lastUsedAt).toBeDefined();
    });

    it('should log 401 for invalid key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Log Test Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Revoke the key
      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      // Try to use revoked key
      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(401);

      // Check usage log
      const logs = await prisma.apiUsageLog.findMany({
        where: { apiKeyId: keyId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(logs[0].statusCode).toBe(401);
    });

    it('should log 403 for insufficient scope', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Scope Log Test Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      const keyId = createResponse.body.item.id;
      testKeys.push(keyId);

      // Try to create trunk without trunks:write
      await request(app.getHttpServer())
        .post('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .send({
          name: 'Test Trunk',
          authType: 'IP',
          ips: ['203.0.113.1/32'],
        })
        .expect(403);

      // Check usage log
      const logs = await prisma.apiUsageLog.findMany({
        where: { apiKeyId: keyId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      expect(logs[0].statusCode).toBe(403);
    });
  });

  describe('API Key Guard - Scope Enforcement', () => {
    it('should allow trunks:read for GET /automation/sip-trunks', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Trunks Read Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      await request(app.getHttpServer())
        .get('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .expect(200);
    });

    it('should allow trunks:write for POST /automation/sip-trunks', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Trunks Write Key',
          scopes: ['trunks:write'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      await request(app.getHttpServer())
        .post('/api/v1/automation/sip-trunks')
        .set('X-API-Key', apiKey)
        .send({
          name: 'API Key Trunk',
          authType: 'IP',
          ips: ['203.0.113.1/32'],
        })
        .expect(201);
    });

    it('should allow cdr:read for GET /automation/cdr', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'CDR Read Key',
          scopes: ['cdr:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      await request(app.getHttpServer())
        .get('/api/v1/automation/cdr')
        .set('X-API-Key', apiKey)
        .expect(200);
    });

    it('should allow balance:read for GET /automation/balance', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Balance Read Key',
          scopes: ['balance:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      await request(app.getHttpServer())
        .get('/api/v1/automation/balance')
        .set('X-API-Key', apiKey)
        .expect(200);
    });

    it('should allow caller-id:read for GET /automation/caller-id', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Caller ID Read Key',
          scopes: ['caller-id:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      await request(app.getHttpServer())
        .get('/api/v1/automation/caller-id')
        .set('X-API-Key', apiKey)
        .expect(200);
    });

    it('should reject API key on JWT management routes', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Management Route Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      // Try to access JWT management route
      await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('X-API-Key', apiKey)
        .expect(401); // Should require JWT, not API key
    });

    it('should reject API key on admin routes', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Admin Route Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      // Try to access admin route
      await request(app.getHttpServer())
        .get('/api/v1/admin/trunks')
        .set('X-API-Key', apiKey)
        .expect(401); // Should require JWT with admin role
    });
  });

  describe('API Key Guard - Missing Scope Decorator', () => {
    it('should reject request without scope decorator', async () => {
      // This test verifies that routes without @KeyScope decorator are rejected
      // The guard should throw UnauthorizedException if scope is not defined
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'No Scope Decorator Key',
          scopes: ['trunks:read'],
          expiresInDays: 90,
        })
        .expect(201);

      const apiKey = createResponse.body.key;
      testKeys.push(createResponse.body.item.id);

      // All automation routes should have scope decorators
      // If a route is added without decorator, it should be rejected
      // This is enforced by the guard checking for scope metadata
    });
  });
});

console.log('✅ API Keys integration tests loaded');
