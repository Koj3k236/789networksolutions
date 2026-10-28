# SIP acceptance checklist — future phases only

There is **no operational SIP endpoint** in Phase 1. `sip.example.com`, ports 5060/5061, and schema fields are placeholders. Do not send calls to arbitrary public destinations or assert that a successful web request proves SIP connectivity.

When your authorized infrastructure team deploys a staging edge:

1. Establish an isolated private test environment and authorized upstream sandbox. Use only destinations and caller IDs whose owners consented to testing.
2. Verify UDP/TCP/TLS listeners, certificate identity, ACLs, tenant identity derivation, and refusal of unauthorized source IPs/CIDRs.
3. Test SIP OPTIONS liveness separately from upstream reachability and production authorization. Store actual observed responses, not generated success.
4. With a SIP test client such as SIPp on an isolated test network, validate INVITE/ACK/BYE/CANCEL and REGISTER if supported, retransmission/timeout behavior and negative auth cases.
5. Confirm caller ID ownership and carrier policy enforcement. Never infer passthrough is universally supported.
6. Verify approved G.711 codecs, RTP flow, SRTP where supported, DTMF RFC 4733 and optional SIP INFO; validate one-way-audio and NAT handling.
7. Correlate signaling call IDs with session/CDR events, duplicate/out-of-order delivery, billable increments and reconciliation. Assert no double charging.
8. Test destination restrictions, CPS/concurrent limits, insufficient balance, disabled tenants, primary/failover carrier quality and authorization.
9. Exercise kill switches. Disconnection, missing authorization, failed compliance, or missing funds must prevent production routing.
10. Only after independently reviewed evidence should production gates be implemented and enabled. The current application refuses STAGING/PRODUCTION startup.

IVR/AMD/TTS/media tests are out of scope until the actual FreeSWITCH/upstream capability exists. Do not label AMD supported based on schema or interface methods.
