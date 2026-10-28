export interface CallerIdSettings {
  externalCallerIdPassthroughEnabled: boolean;
  allowPerCallCallerIdSelection: boolean;
  requireAdditionalCallerIdReview: boolean;
  callerIdPermissionStatus: string;
}
export const DEFAULT_CALLER_ID_SETTINGS: Readonly<CallerIdSettings> = Object.freeze({
  externalCallerIdPassthroughEnabled: false,
  allowPerCallCallerIdSelection: false,
  requireAdditionalCallerIdReview: true,
  callerIdPermissionStatus: 'DISABLED',
});
export interface AuthorizedIdentity {
  number: string;
  kind: 'ASSIGNED' | 'EXTERNAL';
  authorized: boolean;
  evidencePresent: boolean;
  additionalReviewComplete: boolean;
  expiresAt?: Date | null;
}
export interface CarrierCallerIdPolicy {
  enabled: boolean;
  verified: boolean;
  healthVerified: boolean;
  externalCapabilityVerified: boolean;
  policies: readonly string[];
}
export function normalizeCallerId(input: string): string {
  if (typeof input !== 'string' || input.length > 32 || /[\r\n]/.test(input)) throw new Error('Invalid Caller ID');
  const number = input.replace(/[ ()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(number)) throw new Error('Use a valid E.164 number with country code.');
  return number;
}
export function evaluateCallerIdPolicy(input: {
  settings: CallerIdSettings;
  identity?: AuthorizedIdentity;
  perCall: boolean;
  accountEligible: boolean;
  carrier?: CarrierCallerIdPolicy;
  now?: Date;
}) {
  const { settings, identity, perCall, accountEligible, carrier } = input;
  const reasons: string[] = [];
  if (!accountEligible) reasons.push('ACCOUNT_NOT_ELIGIBLE');
  if (!identity?.authorized) reasons.push('NUMBER_NOT_AUTHORIZED');
  if (identity?.expiresAt && identity.expiresAt <= (input.now || new Date())) reasons.push('AUTHORIZATION_EXPIRED');
  if (perCall && !settings.allowPerCallCallerIdSelection) reasons.push('PER_CALL_SELECTION_DISABLED');
  if (identity?.kind === 'EXTERNAL') {
    if (!settings.externalCallerIdPassthroughEnabled || settings.callerIdPermissionStatus !== 'APPROVED') reasons.push('EXTERNAL_PASSTHROUGH_DISABLED');
    if (!identity.evidencePresent) reasons.push('OWNERSHIP_EVIDENCE_REQUIRED');
    if (settings.requireAdditionalCallerIdReview && !identity.additionalReviewComplete) reasons.push('ADDITIONAL_REVIEW_REQUIRED');
  }
  const customerPermissionAllowed = reasons.length === 0;
  const carrierReasons: string[] = [];
  if (!carrier?.enabled || !carrier.verified || !carrier.healthVerified) carrierReasons.push('CARRIER_NOT_VALIDATED');
  if (identity?.kind === 'EXTERNAL' && (!carrier?.externalCapabilityVerified || !carrier.policies.includes('VERIFIED_EXTERNAL'))) carrierReasons.push('CARRIER_EXTERNAL_CALLER_ID_UNSUPPORTED');
  return {
    customerPermissionAllowed,
    carrierPolicyAllowed: carrierReasons.length === 0,
    routingAllowed: false as const,
    reasons: [...reasons, ...carrierReasons, 'OUTBOUND_CALLING_UNAVAILABLE'],
    serviceStatus: 'Pending Upstream Activation',
  };
}
// Future trusted SIP-edge integration supplies parsed E.164 identities, not raw SIP text.
// Reject conflicting From / asserted identities instead of silently trusting PAI.
export function resolveSignaledIdentity(fromNumber: string, assertedNumber?: string): string {
  const from = normalizeCallerId(fromNumber);
  if (assertedNumber && normalizeCallerId(assertedNumber) !== from) throw new Error('Conflicting SIP Caller ID identities');
  return from;
}
