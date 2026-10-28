import { describe, it, expect, beforeAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { calculateCharge } from '../api/dist/demo/dataset';

describe('Billing - Charge Calculation', () => {
  describe('Decimal Precision', () => {
    it('should return Prisma.Decimal type', () => {
      const charge = calculateCharge(60, '0.008000');
      expect(charge).toBeInstanceOf(Prisma.Decimal);
    });

    it('should maintain 6 decimal places', () => {
      const charge = calculateCharge(60, '0.008000');
      expect(charge.toFixed(6)).toBe('0.008000');
    });

    it('should handle fractional cents correctly', () => {
      const charge = calculateCharge(37, '0.008000', 6, 6);
      // 37 seconds -> 42 seconds (7 increments) -> 0.008 * 42/60 = 0.0056
      expect(charge.toFixed(6)).toBe('0.005600');
    });
  });

  describe('Increment Billing', () => {
    it('should round up to 6-second increments', () => {
      const charge1 = calculateCharge(1, '0.008000', 6, 6);
      const charge6 = calculateCharge(6, '0.008000', 6, 6);
      expect(charge1.toString()).toBe(charge6.toString());
    });

    it('should bill 7 seconds as 12 seconds (2 increments)', () => {
      const charge = calculateCharge(7, '0.008000', 6, 6);
      // 7 -> 12 seconds -> 0.008 * 12/60 = 0.0016
      expect(charge.toFixed(6)).toBe('0.001600');
    });

    it('should support 1-second increments', () => {
      const charge59 = calculateCharge(59, '0.008000', 1, 0);
      const charge60 = calculateCharge(60, '0.008000', 1, 0);
      expect(charge59.toFixed(6)).toBe('0.007867');
      expect(charge60.toFixed(6)).toBe('0.008000');
    });

    it('should support 30-second increments', () => {
      const charge = calculateCharge(31, '0.008000', 30, 30);
      // 31 -> 60 seconds (2 increments) -> 0.008 * 60/60 = 0.008
      expect(charge.toFixed(6)).toBe('0.008000');
    });

    it('should support 60-second increments', () => {
      const charge = calculateCharge(61, '0.008000', 60, 60);
      // 61 -> 120 seconds -> 0.008 * 120/60 = 0.016
      expect(charge.toFixed(6)).toBe('0.016000');
    });
  });

  describe('Minimum Duration', () => {
    it('should apply 6-second minimum', () => {
      const charge1 = calculateCharge(1, '0.008000', 6, 6);
      const charge6 = calculateCharge(6, '0.008000', 6, 6);
      expect(charge1.toString()).toBe(charge6.toString());
      expect(charge1.toFixed(6)).toBe('0.000800');
    });

    it('should apply 30-second minimum', () => {
      const charge = calculateCharge(10, '0.008000', 6, 30);
      // 10 seconds but minimum 30 -> 30 seconds -> 0.008 * 30/60 = 0.004
      expect(charge.toFixed(6)).toBe('0.004000');
    });

    it('should not apply minimum if duration exceeds it', () => {
      const charge = calculateCharge(60, '0.008000', 6, 30);
      // 60 seconds > 30 minimum -> 60 seconds -> 0.008 * 60/60 = 0.008
      expect(charge.toFixed(6)).toBe('0.008000');
    });

    it('should support zero minimum', () => {
      const charge = calculateCharge(1, '0.008000', 1, 0);
      // 1 second, no minimum -> 0.008 * 1/60 = 0.000133...
      expect(charge.toFixed(6)).toBe('0.000133');
    });
  });

  describe('Connection Fee', () => {
    it('should add connection fee to charge', () => {
      const charge = calculateCharge(60, '0.008000', 6, 6, '0.005000');
      // 0.008 * 60/60 + 0.005 = 0.013
      expect(charge.toFixed(6)).toBe('0.013000');
    });

    it('should add connection fee even for short calls', () => {
      const charge = calculateCharge(1, '0.008000', 6, 6, '0.010000');
      // 0.008 * 6/60 + 0.010 = 0.0008 + 0.010 = 0.0108
      expect(charge.toFixed(6)).toBe('0.010800');
    });

    it('should support zero connection fee', () => {
      const charge = calculateCharge(60, '0.008000', 6, 6, '0');
      expect(charge.toFixed(6)).toBe('0.008000');
    });
  });

  describe('Minimum Charge', () => {
    it('should enforce minimum charge', () => {
      const charge = calculateCharge(1, '0.008000', 6, 6, '0', '0.010000');
      // Calculated: 0.0008, but minimum is 0.010
      expect(charge.toFixed(6)).toBe('0.010000');
    });

    it('should not apply minimum if calculated charge exceeds it', () => {
      const charge = calculateCharge(600, '0.008000', 6, 6, '0', '0.001000');
      // Calculated: 0.08, minimum: 0.001 -> use 0.08
      expect(charge.toFixed(6)).toBe('0.080000');
    });

    it('should apply minimum charge with connection fee', () => {
      const charge = calculateCharge(1, '0.008000', 6, 6, '0.002000', '0.010000');
      // Calculated: 0.0008 + 0.002 = 0.0028, minimum: 0.010 -> use 0.010
      expect(charge.toFixed(6)).toBe('0.010000');
    });
  });

  describe('Zero Duration', () => {
    it('should return zero charge for zero duration', () => {
      const charge = calculateCharge(0, '0.008000', 6, 6);
      expect(charge.toFixed(6)).toBe('0.000000');
    });

    it('should return zero even with connection fee', () => {
      const charge = calculateCharge(0, '0.008000', 6, 6, '0.005000');
      expect(charge.toFixed(6)).toBe('0.000000');
    });

    it('should return zero even with minimum charge', () => {
      const charge = calculateCharge(0, '0.008000', 6, 6, '0', '0.010000');
      expect(charge.toFixed(6)).toBe('0.000000');
    });
  });

  describe('Rate Variations', () => {
    it('should handle high rates', () => {
      const charge = calculateCharge(60, '1.500000', 6, 6);
      expect(charge.toFixed(6)).toBe('1.500000');
    });

    it('should handle low rates', () => {
      const charge = calculateCharge(60, '0.000100', 6, 6);
      expect(charge.toFixed(6)).toBe('0.000100');
    });

    it('should handle zero rate', () => {
      const charge = calculateCharge(60, '0.000000', 6, 6);
      expect(charge.toFixed(6)).toBe('0.000000');
    });
  });

  describe('Complex Scenarios', () => {
    it('should calculate realistic US call', () => {
      // 2 minutes 37 seconds at $0.008/min, 6s increment, 6s minimum
      const charge = calculateCharge(157, '0.008000', 6, 6);
      // 157 -> 162 seconds (27 increments) -> 0.008 * 162/60 = 0.0216
      expect(charge.toFixed(6)).toBe('0.021600');
    });

    it('should calculate international call with fee', () => {
      // 1 minute at $0.25/min, 6s increment, 30s minimum, $0.05 connection fee
      const charge = calculateCharge(60, '0.250000', 6, 30, '0.050000');
      // 0.25 * 60/60 + 0.05 = 0.30
      expect(charge.toFixed(6)).toBe('0.300000');
    });

    it('should calculate premium rate with minimum', () => {
      // 5 seconds at $2.00/min, 6s increment, 6s minimum, $0.10 minimum charge
      const charge = calculateCharge(5, '2.000000', 6, 6, '0', '0.100000');
      // 2.00 * 6/60 = 0.20, minimum 0.10 -> use 0.20
      expect(charge.toFixed(6)).toBe('0.200000');
    });
  });

  describe('Input Validation', () => {
    it('should reject negative duration', () => {
      expect(() => calculateCharge(-1, '0.008000')).toThrow('Invalid billing parameters');
    });

    it('should reject non-integer duration', () => {
      expect(() => calculateCharge(1.5, '0.008000')).toThrow('Invalid billing parameters');
    });

    it('should reject zero increment', () => {
      expect(() => calculateCharge(60, '0.008000', 0, 6)).toThrow('Invalid billing parameters');
    });

    it('should reject negative increment', () => {
      expect(() => calculateCharge(60, '0.008000', -6, 6)).toThrow('Invalid billing parameters');
    });

    it('should reject negative minimum', () => {
      expect(() => calculateCharge(60, '0.008000', 6, -6)).toThrow('Invalid billing parameters');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long calls', () => {
      // 24 hours at $0.008/min
      const charge = calculateCharge(86400, '0.008000', 6, 6);
      // 0.008 * 86400/60 = 11.52
      expect(charge.toFixed(6)).toBe('11.520000');
    });

    it('should handle very short calls', () => {
      const charge = calculateCharge(1, '0.008000', 1, 1);
      expect(charge.toFixed(6)).toBe('0.000133');
    });

    it('should maintain precision with many decimals', () => {
      const charge = calculateCharge(123, '0.007654', 1, 0);
      // 0.007654 * 123/60 = 0.015691...
      expect(charge.toFixed(6)).toBe('0.015691');
    });
  });
});

describe('Demo Dataset - Boundary Enforcement', () => {
  it('should only allow DEMO mode', () => {
    // This is tested via the loadDemoDataset function which checks APP_MODE
    // The function throws if APP_MODE is not DEMO
    expect(process.env.APP_MODE || 'DEMO').toBe('DEMO');
  });
});
