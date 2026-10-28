export type Capability = 'balance'|'rates'|'numberSearch'|'numberProvision'|'numberRelease'|'originate'|'terminate'|'callStatus'|'cdr'|'externalCallerId';
export class CapabilityError extends Error {
  readonly code = 'CAPABILITY_UNAVAILABLE';
  constructor(public capability: string, public adapter: string) { super(`${capability} is not verified or implemented by ${adapter}.`); }
}
export interface UpstreamCarrierAdapter {
  readonly name: string;
  readonly mode: 'DEMO'|'STAGING'|'PRODUCTION';
  readonly capabilities: ReadonlySet<Capability>;
  testConnection(): Promise<{connected:boolean;simulated:boolean;reason:string}>;
  getBalance(): Promise<unknown>;
  getRates(): Promise<unknown>;
  getAvailableNumbers(): Promise<unknown>;
  provisionNumber(number:string): Promise<unknown>;
  releaseNumber(number:string): Promise<unknown>;
  originateCall(input:unknown): Promise<unknown>;
  terminateCall(id:string): Promise<unknown>;
  getCallStatus(id:string): Promise<unknown>;
  normalizeCDR(input:unknown): Promise<unknown>;
  verifyCallerIdSupport(number:string): Promise<{supported:boolean;reason:string}>;
}
export class GenericSIPCarrierAdapter implements UpstreamCarrierAdapter {
  readonly name: string = 'Generic SIP';
  readonly mode: 'STAGING'|'DEMO' = 'STAGING';
  readonly capabilities: ReadonlySet<Capability> = new Set();
  async testConnection() { return {connected:false,simulated:false,reason:'No verified SIP edge or upstream configured. No network probe performed.'}; }
  protected unavailable(capability:string): never { throw new CapabilityError(capability,this.name); }
  async getBalance(): Promise<unknown> { return this.unavailable('balance'); }
  async getRates(): Promise<unknown> { return this.unavailable('rates'); }
  async getAvailableNumbers(): Promise<unknown> { return this.unavailable('numberSearch'); }
  async provisionNumber(_number:string) { return this.unavailable('numberProvision'); }
  async releaseNumber(_number:string) { return this.unavailable('numberRelease'); }
  async originateCall(_input:unknown) { return this.unavailable('originate'); }
  async terminateCall(_id:string) { return this.unavailable('terminate'); }
  async getCallStatus(_id:string) { return this.unavailable('callStatus'); }
  async normalizeCDR(_input:unknown) { return this.unavailable('cdr'); }
  async verifyCallerIdSupport(_number:string) { return {supported:false,reason:'Ownership, contract, and carrier policy must be verified.'}; }
}
export class GenericRESTCarrierAdapter extends GenericSIPCarrierAdapter { readonly name = 'Generic REST'; }
export class MockCarrierAdapter extends GenericSIPCarrierAdapter {
  readonly name = 'Mock carrier';
  readonly mode = 'DEMO' as const;
  readonly capabilities: ReadonlySet<Capability> = new Set(['balance','rates','numberSearch']);
  async testConnection() { return {connected:false,simulated:true,reason:'Mock adapter available. No telecommunications network is connected.'}; }
  async getBalance(): Promise<any> { return {amount:'0.000000',currency:'USD',simulated:true}; }
  async getRates(): Promise<any> { return [{prefix:'+1',perMinute:'0.008000',currency:'USD',simulated:true}]; }
  async getAvailableNumbers(): Promise<any> { return [{number:'+12025550101',status:'DEMO_ONLY',simulated:true}]; }
}
export function assertProductionReady(_context: unknown): never {
  throw new CapabilityError('productionCalling','Phase 1 — production gate permanently closed');
}
