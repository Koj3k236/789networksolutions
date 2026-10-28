import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, verifyPassword, hashToken, encrypt, decrypt } from '../api/dist/common/crypto';

describe('Crypto - Password Hashing (scrypt)', () => {
  it('should hash password with scrypt format', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    
    expect(hash).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    const [method, salt, encoded] = hash.split(':');
    expect(method).toBe('scrypt');
    expect(salt).toHaveLength(32);
    expect(encoded).toHaveLength(128);
  });

  it('should generate unique salts for same password', async () => {
    const password = 'SamePassword';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    expect(hash1).not.toBe(hash2);
    const salt1 = hash1.split(':')[1];
    const salt2 = hash2.split(':')[1];
    expect(salt1).not.toBe(salt2);
  });

  it('should verify correct password', async () => {
    const password = 'CorrectPassword123';
    const hash = await hashPassword(password);
    const valid = await verifyPassword(password, hash);
    
    expect(valid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'CorrectPassword';
    const hash = await hashPassword(password);
    const valid = await verifyPassword('WrongPassword', hash);
    
    expect(valid).toBe(false);
  });

  it('should reject malformed hash', async () => {
    const valid = await verifyPassword('password', 'invalid:format');
    expect(valid).toBe(false);
  });

  it('should reject wrong method', async () => {
    const valid = await verifyPassword('password', 'bcrypt:salt:hash');
    expect(valid).toBe(false);
  });

  it('should use timing-safe comparison', async () => {
    const password = 'TimingSafe';
    const hash = await hashPassword(password);
    
    // Verify that different lengths don't cause early return
    const start1 = Date.now();
    await verifyPassword('Wrong', hash);
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await verifyPassword('WrongPasswordLonger', hash);
    const time2 = Date.now() - start2;
    
    // Both should take similar time (within reasonable variance)
    // This is a basic check; timing attacks are hard to test precisely
    expect(Math.abs(time1 - time2)).toBeLessThan(50);
  });
});

describe('Crypto - Token Hashing (SHA-256)', () => {
  it('should hash token to hex string', () => {
    const token = 'test-token-value';
    const hash = hashToken(token);
    
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toHaveLength(64);
  });

  it('should produce consistent hashes', () => {
    const token = 'consistent-token';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different tokens', () => {
    const hash1 = hashToken('token1');
    const hash2 = hashToken('token2');
    
    expect(hash1).not.toBe(hash2);
  });
});

describe('Crypto - AES-256-GCM Encryption', () => {
  beforeAll(() => {
    // Set encryption key for tests
    process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex
  });

  it('should encrypt and decrypt data correctly', () => {
    const plaintext = 'Sensitive data 123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', () => {
    const plaintext = 'Same data';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should have correct format (iv.data.tag)', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split('.');
    
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[a-f0-9]{24}$/); // 12-byte IV
    expect(parts[1]).toMatch(/^[a-f0-9]+$/);    // Encrypted data
    expect(parts[2]).toMatch(/^[a-f0-9]{32}$/); // 16-byte auth tag
  });

  it('should reject tampered ciphertext', () => {
    const plaintext = 'Protected data';
    const encrypted = encrypt(plaintext);
    const parts = encrypted.split('.');
    
    // Tamper with the data
    const tampered = parts[0] + '.' + parts[1].slice(0, -2) + 'ff' + '.' + parts[2];
    
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should reject tampered auth tag', () => {
    const plaintext = 'Protected data';
    const encrypted = encrypt(plaintext);
    const parts = encrypted.split('.');
    
    // Tamper with the auth tag
    const tampered = parts[0] + '.' + parts[1] + '.' + 'ff'.repeat(16);
    
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should reject tampered IV', () => {
    const plaintext = 'Protected data';
    const encrypted = encrypt(plaintext);
    const parts = encrypted.split('.');
    
    // Tamper with the IV
    const tampered = 'ff'.repeat(12) + '.' + parts[1] + '.' + parts[2];
    
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should throw error if encryption key is missing', () => {
    const originalKey = process.env.DATA_ENCRYPTION_KEY;
    delete process.env.DATA_ENCRYPTION_KEY;
    
    expect(() => encrypt('test')).toThrow('DATA_ENCRYPTION_KEY must be a 32-byte hex key');
    
    process.env.DATA_ENCRYPTION_KEY = originalKey;
  });

  it('should throw error if encryption key is wrong length', () => {
    const originalKey = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(32); // Only 16 bytes
    
    expect(() => encrypt('test')).toThrow('DATA_ENCRYPTION_KEY must be a 32-byte hex key');
    
    process.env.DATA_ENCRYPTION_KEY = originalKey;
  });

  it('should handle unicode characters', () => {
    const plaintext = '🔐 Encrypted émojis and spëcial chars 中文';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should handle empty string', () => {
    const plaintext = '';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should handle long strings', () => {
    const plaintext = 'A'.repeat(10000);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });
});
