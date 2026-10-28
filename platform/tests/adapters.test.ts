import { describe, it, expect } from 'vitest';
import { 
  MockCarrierAdapter, 
  GenericSIPCarrierAdapter, 
  GenericRESTCarrierAdapter,
  CapabilityError,
  assertProductionReady 
} from '../api/dist/carriers/adapters';

describe('Carrier Adapters - Capability Rejection', () => {
  describe('MockCarrierAdapter', () => {
    const adapter = new MockCarrierAdapter();

    it('should be DEMO mode only', () => {
      expect(adapter.mode).toBe('DEMO');
      expect(adapter.name).toBe('Mock carrier');
    });

    it('should support only balance, rates, and numberSearch', () => {
      expect(adapter.capabilities.has('balance')).toBe(true);
      expect(adapter.capabilities.has('rates')).toBe(true);
      expect(adapter.capabilities.has('numberSearch')).toBe(true);
      
      expect(adapter.capabilities.has('numberProvision')).toBe(false);
      expect(adapter.capabilities.has('originate')).toBe(false);
      expect(adapter.capabilities.has('terminate')).toBe(false);
    });

    it('should return simulated balance', async () => {
      const balance = await adapter.getBalance();
      expect(balance).toEqual({
        amount: '0.000000',
        currency: 'USD',
        simulated: true,
      });
    });

    it('should return simulated rates', async () => {
      const rates = await adapter.getRates();
      expect(rates).toEqual([{
        prefix: '+1',
        perMinute: '0.008000',
        currency: 'USD',
        simulated: true,
      }]);
    });

    it('should return simulated available numbers', async () => {
      const numbers = await adapter.getAvailableNumbers();
      expect(numbers).toEqual([{
        number: '+12025550101',
        status: 'DEMO_ONLY',
        simulated: true,
      }]);
    });

    it('should reject number provisioning', async () => {
      await expect(adapter.provisionNumber('+12025550101'))
        .rejects.toThrow(CapabilityError);
      
      try {
        await adapter.provisionNumber('+12025550101');
      } catch (e: any) {
        expect(e.code).toBe('CAPABILITY_UNAVAILABLE');
        expect(e.capability).toBe('numberProvision');
        expect(e.adapter).toBe('Mock carrier');
      }
    });

    it('should reject number release', async () => {
      await expect(adapter.releaseNumber('+12025550101'))
        .rejects.toThrow(CapabilityError);
    });

    it('should reject call origination', async () => {
      await expect(adapter.originateCall({}))
        .rejects.toThrow(CapabilityError);
      
      try {
        await adapter.originateCall({});
      } catch (e: any) {
        expect(e.capability).toBe('originate');
      }
    });

    it('should reject call termination', async () => {
      await expect(adapter.terminateCall('call-id'))
        .rejects.toThrow(CapabilityError);
    });

    it('should reject call status', async () => {
      await expect(adapter.getCallStatus('call-id'))
        .rejects.toThrow(CapabilityError);
    });

    it('should reject CDR normalization', async () => {
      await expect(adapter.normalizeCDR({}))
        .rejects.toThrow(CapabilityError);
    });

    it('should return not connected for test connection', async () => {
      const result = await adapter.testConnection();
      expect(result).toEqual({
        connected: false,
        simulated: true,
        reason: 'Mock adapter available. No telecommunications network is connected.',
      });
    });

    it('should reject caller ID verification', async () => {
      const result = await adapter.verifyCallerIdSupport('+12025550101');
      expect(result.supported).toBe(false);
      expect(result.reason).toContain('Ownership, contract, and carrier policy must be verified.');
    });
  });

  describe('GenericSIPCarrierAdapter', () => {
    const adapter = new GenericSIPCarrierAdapter();

    it('should be STAGING mode', () => {
      expect(adapter.mode).toBe('STAGING');
      expect(adapter.name).toBe('Generic SIP');
    });

    it('should have no capabilities', () => {
      expect(adapter.capabilities.size).toBe(0);
    });

    it('should reject all operations', async () => {
      await expect(adapter.getBalance()).rejects.toThrow(CapabilityError);
      await expect(adapter.getRates()).rejects.toThrow(CapabilityError);
      await expect(adapter.getAvailableNumbers()).rejects.toThrow(CapabilityError);
      await expect(adapter.provisionNumber('+1')).rejects.toThrow(CapabilityError);
      await expect(adapter.releaseNumber('+1')).rejects.toThrow(CapabilityError);
      await expect(adapter.originateCall({})).rejects.toThrow(CapabilityError);
      await expect(adapter.terminateCall('id')).rejects.toThrow(CapabilityError);
      await expect(adapter.getCallStatus('id')).rejects.toThrow(CapabilityError);
      await expect(adapter.normalizeCDR({})).rejects.toThrow(CapabilityError);
    });

    it('should return not connected for test connection', async () => {
      const result = await adapter.testConnection();
      expect(result.connected).toBe(false);
      expect(result.simulated).toBe(false);
      expect(result.reason).toContain('No verified SIP edge or upstream configured');
    });

    it('should reject caller ID verification', async () => {
      const result = await adapter.verifyCallerIdSupport('+1');
      expect(result.supported).toBe(false);
    });
  });

  describe('GenericRESTCarrierAdapter', () => {
    const adapter = new GenericRESTCarrierAdapter();

    it('should extend GenericSIPCarrierAdapter', () => {
      expect(adapter.name).toBe('Generic REST');
      expect(adapter.mode).toBe('STAGING');
      expect(adapter.capabilities.size).toBe(0);
    });

    it('should reject all operations', async () => {
      await expect(adapter.getBalance()).rejects.toThrow(CapabilityError);
      await expect(adapter.originateCall({})).rejects.toThrow(CapabilityError);
    });
  });

  describe('Production Readiness Gate', () => {
    it('should always fail production readiness check', () => {
      expect(() => assertProductionReady({})).toThrow(CapabilityError);
      expect(() => assertProductionReady(null)).toThrow(CapabilityError);
      expect(() => assertProductionReady({ mode: 'PRODUCTION' })).toThrow(CapabilityError);
    });

    it('should have correct error details', () => {
      try {
        assertProductionReady({});
      } catch (e: any) {
        expect(e.code).toBe('CAPABILITY_UNAVAILABLE');
        expect(e.capability).toBe('productionCalling');
        expect(e.adapter).toBe('Phase 1 — production gate permanently closed');
      }
    });
  });
});
