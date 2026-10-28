import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { ADMIN_ROLES, assertRole, Principal } from '../common/security';
import { AuthorizedIdentity, evaluateCallerIdPolicy, normalizeCallerId } from './policy';
import { EnableRequestDto, NumberReviewDto, PermissionSettingsDto, RequestDecisionDto, SubmitNumberDto, ValidateCallerIdDto } from './dto';
export const CALLER_ID_EDIT_ROLES = ['SUPER_ADMIN', 'COMPLIANCE_ADMIN'] as const;
@Injectable()
export class CallerIdService {
  constructor(private readonly db: PrismaService) {}
  private editor(actor: Principal) { assertRole(actor.role, [...CALLER_ID_EDIT_ROLES]); }
  private access(orgId: string, actor: Principal) {
    if (orgId !== actor.organizationId) assertRole(actor.role, ADMIN_ROLES);
  }
  private normalize(number: string) {
    try { return normalizeCallerId(number); } catch (e) { throw new BadRequestException((e as Error).message); }
  }
  private async locked<T>(orgId: string, fn: (tx: Prisma.TransactionClient, org: Organization) => Promise<T>) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId}::uuid FOR UPDATE`;
      const org = await tx.organization.findUnique({where:{id:orgId}});
      if (!org) throw new NotFoundException('Customer not found.');
      return fn(tx, org);
    });
  }
  private revision(org: Organization, expected: number) {
    if (org.callerIdPermissionVersion !== expected) throw new ConflictException('Permissions changed. Refresh before saving.');
  }
  private async audit(tx: Prisma.TransactionClient, orgId: string, actor: Principal, action: string, targetId: string, metadata: Prisma.InputJsonObject, ip?: string) {
    return tx.auditLog.create({data:{organizationId:orgId,actorId:actor.id,action,targetId,ip,metadata}});
  }
  private settings(org: Organization) {
    return {externalCallerIdPassthroughEnabled:org.externalCallerIdPassthroughEnabled,
      allowPerCallCallerIdSelection:org.allowPerCallCallerIdSelection,
      requireAdditionalCallerIdReview:org.requireAdditionalCallerIdReview,
      status:org.callerIdPermissionStatus,notes:org.callerIdApprovalNotes,
      version:org.callerIdPermissionVersion,lastModifiedAt:org.callerIdPermissionsUpdatedAt};
  }
  private async identities(tx: Prisma.TransactionClient, orgId: string) {
    const [external, assigned] = await Promise.all([
      tx.callerId.findMany({where:{organizationId:orgId},orderBy:{createdAt:'desc'},include:{verifications:{orderBy:{createdAt:'desc'},include:{reviewedBy:{select:{id:true,fullName:true}}}}}}),
      tx.phoneNumber.findMany({where:{organizationId:orgId,status:'ACTIVE',mode:'PRODUCTION'},select:{id:true,number:true,status:true,kind:true}}),
    ]);
    const inventory: AuthorizedIdentity[] = [
      ...assigned.map(n=>({number:n.number,kind:'ASSIGNED' as const,authorized:true,evidencePresent:true,additionalReviewComplete:true})),
      ...external.map(n=>({number:n.number,kind:'EXTERNAL' as const,authorized:n.verified && n.status==='AUTHORIZED',evidencePresent:!!n.authorizationRef && n.verifications.some(v=>v.result==='AUTHORIZED' && !!v.evidenceReference && !!v.reviewedById),additionalReviewComplete:!!n.additionalReviewAt,expiresAt:n.expiresAt})),
    ];
    return {external,assigned,inventory};
  }
  async workspace(orgId: string, actor: Principal) {
    this.access(orgId,actor);
    const org = await this.db.organization.findUnique({where:{id:orgId},include:{callerIdPermissionsUpdatedBy:{select:{id:true,fullName:true}}}});
    if (!org) throw new NotFoundException('Customer not found.');
    const [identityData, requests, trunks, audit] = await Promise.all([
      this.identities(this.db,orgId),
      this.db.callerIdPermissionRequest.findMany({where:{organizationId:orgId},orderBy:{createdAt:'desc'},take:100,include:{requestedBy:{select:{fullName:true}},reviewedBy:{select:{fullName:true}}}}),
      this.db.sipTrunk.findMany({where:{organizationId:orgId},select:{id:true,name:true,defaultCallerId:true}}),
      this.db.auditLog.findMany({where:{organizationId:orgId,action:{startsWith:'CALLER_ID_'}},orderBy:{createdAt:'desc'},take:100}),
    ]);
    const actorIds = [...new Set(audit.map(a=>a.actorId).filter((id): id is string=>!!id))];
    const actors = await this.db.user.findMany({where:{id:{in:actorIds}},select:{id:true,fullName:true}});
    const selectableNumbers = identityData.inventory.filter(identity=>evaluateCallerIdPolicy({settings:org,identity,perCall:false,accountEligible:!['SUSPENDED','REJECTED'].includes(org.status)}).customerPermissionAllowed).map(n=>n.number);
    return {organization:{id:org.id,businessName:org.businessName,status:org.status},
      settings:{...this.settings(org),lastModifiedBy:org.callerIdPermissionsUpdatedBy},
      requests,external:identityData.external,assigned:identityData.assigned,trunks,selectableNumbers,
      audit:audit.map(a=>({...a,actorName:actors.find(u=>u.id===a.actorId)?.fullName||'Unavailable user'})),
      calling:{routingAllowed:false,status:'Pending Upstream Activation',message:'Caller ID permissions never override verified ownership or carrier policy.'}};
  }
  async requestEnable(actor: Principal, body: EnableRequestDto, ip?: string) {
    return this.locked(actor.organizationId,async (tx,org)=>{
      if (org.externalCallerIdPassthroughEnabled) throw new ConflictException('External Caller ID permission is already enabled.');
      if (await tx.callerIdPermissionRequest.findFirst({where:{organizationId:org.id,status:'PENDING'}})) throw new ConflictException('A request is already awaiting review.');
      const request = await tx.callerIdPermissionRequest.create({data:{organizationId:org.id,requestedById:actor.id,justification:body.justification}});
      await tx.organization.update({where:{id:org.id},data:{callerIdPermissionStatus:'REQUESTED',callerIdPermissionVersion:{increment:1}}});
      await this.audit(tx,org.id,actor,'CALLER_ID_PERMISSION_REQUESTED',request.id,{justification:body.justification},ip);
      return request;
    });
  }
  async cancelRequest(actor: Principal, requestId: string, ip?: string) {
    return this.locked(actor.organizationId,async(tx,org)=>{
      const request = await tx.callerIdPermissionRequest.findFirst({where:{id:requestId,organizationId:org.id}});
      if (!request) throw new NotFoundException('Request not found.');
      if(request.status!=='PENDING') throw new ConflictException('Only pending requests can be withdrawn.');
      await tx.callerIdPermissionRequest.update({where:{id:request.id},data:{status:'CANCELLED',decisionNotes:'Withdrawn by customer.'}});
      await tx.organization.update({where:{id:org.id},data:{callerIdPermissionStatus:'DISABLED',callerIdPermissionVersion:{increment:1}}});
      await this.audit(tx,org.id,actor,'CALLER_ID_PERMISSION_WITHDRAWN',request.id,{},ip);
      return {message:'Request withdrawn.'};
    });
  }
  async updateSettings(orgId: string, actor: Principal, body: PermissionSettingsDto, ip?: string) {
    this.editor(actor);
    if(body.externalCallerIdPassthroughEnabled && body.status!=='APPROVED') throw new BadRequestException('Passthrough requires APPROVED permission status.');
    if(!body.externalCallerIdPassthroughEnabled && body.status==='APPROVED') throw new BadRequestException('Use DISABLED or REJECTED when passthrough is off.');
    return this.locked(orgId,async(tx,org)=>{
      this.revision(org,body.expectedVersion);
      if(await tx.callerIdPermissionRequest.findFirst({where:{organizationId:orgId,status:'PENDING'}})) throw new ConflictException('Review the pending request before editing permissions.');
      const next = await tx.organization.update({where:{id:orgId},data:{externalCallerIdPassthroughEnabled:body.externalCallerIdPassthroughEnabled,allowPerCallCallerIdSelection:body.allowPerCallCallerIdSelection,requireAdditionalCallerIdReview:body.requireAdditionalCallerIdReview,callerIdPermissionStatus:body.status,callerIdApprovalNotes:body.notes,callerIdPermissionsUpdatedAt:new Date(),callerIdPermissionsUpdatedById:actor.id,callerIdPermissionVersion:{increment:1}}});
      await this.clearInvalidDefaults(tx,next,actor,ip);
      await this.audit(tx,orgId,actor,'CALLER_ID_PERMISSIONS_UPDATED',orgId,{before:JSON.parse(JSON.stringify(this.settings(org))),after:JSON.parse(JSON.stringify(this.settings(next))),notes:body.notes},ip);
      return this.settings(next);
    });
  }
  async queue(actor: Principal) {
    assertRole(actor.role,ADMIN_ROLES);
    return this.db.callerIdPermissionRequest.findMany({orderBy:{createdAt:'desc'},take:100,include:{organization:{select:{id:true,businessName:true,callerIdPermissionVersion:true}},requestedBy:{select:{fullName:true}},reviewedBy:{select:{fullName:true}}}});
  }
  async decideRequest(orgId: string, requestId: string, actor: Principal, body: RequestDecisionDto, ip?: string) {
    this.editor(actor);
    return this.locked(orgId,async(tx,org)=>{
      this.revision(org,body.expectedVersion);
      const request = await tx.callerIdPermissionRequest.findFirst({where:{id:requestId,organizationId:orgId}});
      if(!request) throw new NotFoundException('Request not found.');
      if(request.status!=='PENDING') throw new ConflictException('This request has already been decided.');
      const approved=body.decision==='APPROVED';
      const result=await tx.callerIdPermissionRequest.update({where:{id:requestId},data:{status:body.decision,reviewedById:actor.id,reviewedAt:new Date(),decisionNotes:body.notes}});
      const next=await tx.organization.update({where:{id:orgId},data:{externalCallerIdPassthroughEnabled:approved,callerIdPermissionStatus:body.decision,callerIdApprovalNotes:body.notes,callerIdPermissionsUpdatedById:actor.id,callerIdPermissionsUpdatedAt:new Date(),callerIdPermissionVersion:{increment:1}}});
      await this.clearInvalidDefaults(tx,next,actor,ip);
      await this.audit(tx,orgId,actor,`CALLER_ID_PERMISSION_${body.decision}`,requestId,{notes:body.notes,numberOwnershipGranted:false,carrierPermissionGranted:false},ip);
      return result;
    });
  }
  async submitNumber(actor: Principal, body: SubmitNumberDto, ip?: string) {
    const number=this.normalize(body.number);
    return this.locked(actor.organizationId,async(tx,org)=>{
      if(await tx.callerId.findUnique({where:{organizationId_number:{organizationId:org.id,number}}})) throw new ConflictException('This number already has an authorization record.');
      const record=await tx.callerId.create({data:{organizationId:org.id,number,submittedAuthorization:body.authorizationDescription}});
      await this.audit(tx,org.id,actor,'CALLER_ID_AUTHORIZATION_SUBMITTED',record.id,{number,authorizationDescription:body.authorizationDescription},ip);
      return record;
    });
  }
  async reviewNumber(orgId: string, numberId: string, actor: Principal, body: NumberReviewDto, ip?: string) {
    this.editor(actor);
    if(body.decision==='AUTHORIZED' && (!body.ownershipConfirmed || !body.evidenceReference?.trim())) throw new BadRequestException('Documented ownership or authorization evidence and confirmation are required.');
    const expiresAt=body.expiresAt?new Date(body.expiresAt):null;
    if(expiresAt && expiresAt<=new Date()) throw new BadRequestException('Authorization expiry must be in the future.');
    return this.locked(orgId,async(tx,org)=>{
      const record=await tx.callerId.findFirst({where:{id:numberId,organizationId:orgId}});
      if(!record) throw new NotFoundException('Caller ID not found.');
      if(record.version!==body.expectedVersion) throw new ConflictException('Caller ID changed. Refresh before reviewing.');
      if(body.decision==='AUTHORIZED' && org.requireAdditionalCallerIdReview && !body.additionalReviewCompleted) throw new BadRequestException('Complete the additional Caller ID review required by this customer policy.');
      const authorized=body.decision==='AUTHORIZED';
      const updated=await tx.callerId.update({where:{id:record.id},data:{status:body.decision,verified:authorized,authorizationRef:authorized?body.evidenceReference:null,additionalReviewAt:authorized&&body.additionalReviewCompleted?new Date():null,expiresAt:authorized?expiresAt:null,version:{increment:1}}});
      await tx.callerIdVerification.create({data:{callerIdId:record.id,method:'DOCUMENTED_AUTHORIZATION_REVIEW',result:body.decision,evidenceReference:body.evidenceReference,notes:body.notes,reviewedById:actor.id}});
      await this.clearInvalidDefaults(tx,org,actor,ip);
      await this.audit(tx,orgId,actor,`CALLER_ID_AUTHORIZATION_${body.decision}`,record.id,{number:record.number,from:record.status,to:body.decision,notes:body.notes,evidenceReference:body.evidenceReference||null},ip);
      return updated;
    });
  }
  async withdrawNumber(actor: Principal, numberId: string, ip?: string) {
    return this.locked(actor.organizationId,async(tx,org)=>{
      const record=await tx.callerId.findFirst({where:{id:numberId,organizationId:org.id}});
      if(!record) throw new NotFoundException('Caller ID not found.');
      await tx.callerId.update({where:{id:record.id},data:{verified:false,status:'REVOKED',authorizationRef:null,additionalReviewAt:null,version:{increment:1}}});
      await this.clearInvalidDefaults(tx,org,actor,ip);
      await this.audit(tx,org.id,actor,'CALLER_ID_AUTHORIZATION_WITHDRAWN',record.id,{number:record.number},ip);
      return {message:'Caller ID withdrawn and removed from trunk defaults.'};
    });
  }
  private async clearInvalidDefaults(tx: Prisma.TransactionClient, org: Organization, actor: Principal, ip?: string) {
    const {inventory}=await this.identities(tx,org.id);
    const allowed=inventory.filter(identity=>evaluateCallerIdPolicy({settings:org,identity,perCall:false,accountEligible:!['SUSPENDED','REJECTED'].includes(org.status)}).customerPermissionAllowed).map(n=>n.number);
    const where={organizationId:org.id,defaultCallerId:{not:null,...(allowed.length?{notIn:allowed}:{})}};
    const invalid=await tx.sipTrunk.findMany({where,select:{id:true,defaultCallerId:true}});
    await tx.sipTrunk.updateMany({where,data:{defaultCallerId:null}});
    for(const trunk of invalid) await this.audit(tx,org.id,actor,'CALLER_ID_TRUNK_DEFAULT_CLEARED',trunk.id,{before:trunk.defaultCallerId,after:null,reason:'Customer policy or number authorization no longer permits this identity.'},ip);
  }
  async setDefault(actor: Principal, trunkId: string, number: string|null, ip?: string) {
    return this.locked(actor.organizationId,async(tx,org)=>{
      const trunk=await tx.sipTrunk.findFirst({where:{id:trunkId,organizationId:org.id}});
      if(!trunk) throw new NotFoundException('SIP trunk not found.');
      const normalized=number===null?null:this.normalize(number);
      if(normalized){
        const {inventory}=await this.identities(tx,org.id);
        const decision=evaluateCallerIdPolicy({settings:org,identity:inventory.find(n=>n.number===normalized),perCall:false,accountEligible:!['SUSPENDED','REJECTED'].includes(org.status)});
        if(!decision.customerPermissionAllowed) throw new ForbiddenException({message:'Caller ID is not authorized for this customer.',reasons:decision.reasons});
      }
      await tx.sipTrunk.update({where:{id:trunk.id},data:{defaultCallerId:normalized}});
      await this.audit(tx,org.id,actor,'CALLER_ID_TRUNK_DEFAULT_UPDATED',trunk.id,{before:trunk.defaultCallerId,after:normalized,serviceStatus:'Pending Upstream Activation'},ip);
      return {defaultCallerId:normalized,serviceStatus:'Pending Upstream Activation'};
    });
  }
  async validate(actor: Principal, body: ValidateCallerIdDto, ip?: string) {
    const number=this.normalize(body.callerId);
    return this.locked(actor.organizationId,async(tx,org)=>{
      const trunk=await tx.sipTrunk.findFirst({where:{id:body.trunkId,organizationId:org.id}});
      if(!trunk) throw new NotFoundException('SIP trunk not found.');
      const {inventory}=await this.identities(tx,org.id);
      // Carrier flags are loaded server-side. The customer cannot assert compatibility.
      const carrier=body.carrierId?await tx.upstreamCarrier.findUnique({where:{id:body.carrierId},include:{capabilities:true}}):null;
      const decision=evaluateCallerIdPolicy({settings:org,identity:inventory.find(n=>n.number===number),perCall:body.perCall,accountEligible:org.status==='APPROVED',carrier:carrier?{enabled:carrier.enabled,verified:carrier.verified,healthVerified:!!carrier.lastHealthAt && carrier.lastHealthAt>new Date(Date.now()-120000),externalCapabilityVerified:carrier.capabilities.some(c=>c.name==='externalCallerId'&&c.verified),policies:carrier.callerIdPolicies}:undefined});
      await this.audit(tx,org.id,actor,'CALLER_ID_ROUTING_VALIDATED',trunk.id,{number,...decision},ip);
      return decision;
    });
  }
}
