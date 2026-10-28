import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';
import { Principal } from '../common/security';
import { StatusDto } from '../auth/dto';
@Injectable()
export class PortalService {
  constructor(private db:PrismaService){}
  async dashboard(user:Principal,days=1) {
    if(![1,7,30].includes(days)) throw new BadRequestException('Range must be 1, 7, or 30 days.');
    const orgId=user.organizationId;
    const since=new Date(Date.now()-days*86400000);
    const [organization,wallet,calls,trunks,numbers] = await Promise.all([
      this.db.organization.findUniqueOrThrow({where:{id:orgId},select:{id:true,businessName:true,status:true,mode:true,productionEnabled:true,createdAt:true}}),
      this.db.wallet.findUnique({where:{organizationId_mode_currency:{organizationId:orgId,mode:'DEMO',currency:'USD'}},include:{entries:{orderBy:{createdAt:'desc'}}}}),
      this.db.callDetailRecord.findMany({where:{organizationId:orgId,mode:'DEMO',startTime:{gte:since}},orderBy:{startTime:'desc'},include:{trunk:{select:{name:true}}}}),
      this.db.sipTrunk.findMany({where:{organizationId:orgId,mode:'DEMO'},select:{id:true,name:true,enabled:true,authType:true,maxConcurrent:true,mode:true}}),
      this.db.phoneNumber.findMany({where:{organizationId:orgId,mode:'DEMO'}})
    ]);
    const bucketMs=days===1?3600000:86400000;
    const count=days===1?24:days;
    const end=Math.floor(Date.now()/bucketMs)*bucketMs;
    const traffic=Array.from({length:count},(_,i)=>{const time=end-(count-1-i)*bucketMs;const rows=calls.filter(c=>c.startTime.getTime()>=time&&c.startTime.getTime()<time+bucketMs);return {time:new Date(time).toISOString(),label:days===1?new Date(time).toISOString().slice(11,16):new Date(time).toISOString().slice(5,10),outbound:rows.filter(c=>c.direction==='OUTBOUND').length,inbound:rows.filter(c=>c.direction==='INBOUND').length};});
    const success=calls.filter(c=>c.status==='COMPLETED').length;
    const balance=wallet?.entries.reduce((a,e)=>a.plus(e.amount),new Prisma.Decimal(0))||new Prisma.Decimal(0);
    const outboundCalls=calls.filter(c=>c.direction==='OUTBOUND').length;
    const inboundCalls=calls.filter(c=>c.direction==='INBOUND').length;
    return {mode:'DEMO',snapshot:false,user:{fullName:user.fullName,email:user.email,role:user.role},organization,summary:{outboundCalls,inboundCalls,balance:balance.toFixed(6),credit:wallet?.creditLimit.toString()||'0',totalCalls:calls.length,successfulCalls:success,failedCalls:calls.length-success,activeCalls:0,minutes:calls.reduce((a,c)=>a+c.duration,0)/60,cost:calls.reduce((a,c)=>a.plus(c.customerCharge),new Prisma.Decimal(0)).toNumber(),trunks:trunks.length,numbers:numbers.length,successRate:calls.length?success/calls.length*100:0},traffic,calls:calls.slice(0,8).map(c=>({...c,trunkName:c.trunk?.name||'—'})),transactions:(wallet?.entries||[]).slice(0,8),trunks,numbers,services:[{name:'Demo application',status:'Available',state:'ok'},{name:'SIP infrastructure',status:'Not connected',state:'off'},{name:'Upstream carrier',status:'Not configured',state:'off'},{name:'Production calling',status:'Disabled',state:'off'}]};
  }
  async cdr(user:Principal,query:{search?:string;page?:string;status?:string}) {
    const page=Number(query.page??1);
    if(!Number.isInteger(page)||page<1||page>10000)throw new BadRequestException('Page must be an integer between 1 and 10000.');
    if(query.search!==undefined&&typeof query.search!=='string')throw new BadRequestException('Search must be text.');
    const search=(query.search||'').slice(0,100);
    if(query.status&&!['COMPLETED','FAILED'].includes(query.status)) throw new BadRequestException('Invalid status');
    const where={organizationId:user.organizationId,mode:'DEMO' as const,...(query.status?{status:query.status}:{}),...(search?{OR:[{source:{contains:search}},{destination:{contains:search}}]}:{})};
    const [items,total]=await Promise.all([this.db.callDetailRecord.findMany({where,skip:(page-1)*25,take:25,orderBy:{startTime:'desc'}}),this.db.callDetailRecord.count({where})]);
    return {items,total,page,pageSize:25,mode:'DEMO'};
  }
  async customers() {
    return this.db.organization.findMany({orderBy:{createdAt:'desc'},take:100,select:{id:true,businessName:true,country:true,status:true,mode:true,productionEnabled:true,createdAt:true,users:{select:{id:true,fullName:true,email:true,emailVerified:true,role:true}}}});
  }
  async adminSummary() {
    const [customers,pending,auditEvents]=await Promise.all([this.db.organization.count(),this.db.organization.count({where:{status:{in:['PENDING_VERIFICATION','UNDER_REVIEW']}}}),this.db.auditLog.count({where:{createdAt:{gte:new Date(Date.now()-86400000)}}})]);
    return {customers,pending,auditEvents,connectedCarriers:0,productionEnabled:false,mode:'DEMO'};
  }
  async setStatus(id:string,body:StatusDto,user:Principal,ip:string) {
    if(id===user.organizationId) throw new BadRequestException('Administrators cannot change their own organization status.');
    return this.db.$transaction(async tx=>{
      const org=await tx.organization.findUnique({where:{id},include:{users:true}});
      if(!org) throw new NotFoundException('Organization not found');
      if(org.users.some(u=>u.role.endsWith('ADMIN')||u.role==='SUPPORT_AGENT')) throw new BadRequestException('Administrative organizations cannot be changed here.');
      if(body.status==='APPROVED'&&!org.users.some(u=>u.emailVerified)) throw new BadRequestException('An owner must verify their email first.');
      await tx.organization.update({where:{id},data:{status:body.status,productionEnabled:false}});
      await tx.kycRequest.updateMany({where:{organizationId:id},data:{status:body.status,notes:body.reason,reviewerId:user.id,reviewedAt:new Date()}});
      if(['SUSPENDED','REJECTED'].includes(body.status)) await tx.refreshToken.updateMany({where:{user:{organizationId:id},revokedAt:null},data:{revokedAt:new Date()}});
      await tx.auditLog.create({data:{organizationId:id,actorId:user.id,action:'ACCOUNT_STATUS_CHANGED',targetId:id,ip,metadata:{from:org.status,to:body.status,reason:body.reason,productionEnabled:false}}});
      return {message:'Demo account status updated. This is not production KYC approval.',status:body.status,productionEnabled:false};
    });
  }
}
