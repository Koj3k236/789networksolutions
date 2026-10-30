import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,UnauthorizedException} from '@nestjs/common';
import {randomBytes} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../common/prisma.service';
import {Principal} from '../common/security';
import {hashToken} from '../common/crypto';
import {API_SCOPES,ApiScope,CreateApiKeyDto} from './dto';
export function issueApiSecret(){const key=`789k_${randomBytes(32).toString('base64url')}`;return {key,hash:hashToken(key),prefix:key.slice(0,13)};}
const metadata={id:true,name:true,prefix:true,scopes:true,createdAt:true,lastUsedAt:true,revokedAt:true,expiresAt:true,rotatedFromId:true};
@Injectable()
export class ApiKeysService {
 constructor(private db:PrismaService){}
 async list(actor:Principal){return {items:await this.db.apiKey.findMany({where:{organizationId:actor.organizationId,createdByUserId:actor.id},select:metadata,orderBy:{createdAt:'desc'}}),availableScopes:API_SCOPES};}
 private async transaction<T>(actor:Principal,fn:(tx:Prisma.TransactionClient)=>Promise<T>){return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${actor.organizationId}::uuid FOR UPDATE`;const org=await tx.organization.findUnique({where:{id:actor.organizationId}});if(!org||['SUSPENDED','REJECTED'].includes(org.status))throw new ForbiddenException('Account access is restricted.');return fn(tx);});}
 async create(actor:Principal,body:CreateApiKeyDto,ip?:string){return this.transaction(actor,async tx=>{
  if(!body.scopes.length||body.scopes.some(s=>!API_SCOPES.includes(s)))throw new BadRequestException('Unsupported API scope.');
  if(await tx.apiKey.count({where:{organizationId:actor.organizationId,createdByUserId:actor.id,revokedAt:null,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}})>=25)throw new ConflictException('Maximum 25 active API keys per user. Revoke an unused key first.');
  const generated=issueApiSecret();const row=await tx.apiKey.create({data:{organizationId:actor.organizationId,createdByUserId:actor.id,name:body.name,scopes:[...new Set(body.scopes)],hash:generated.hash,prefix:generated.prefix,expiresAt:new Date(Date.now()+(body.expiresInDays??90)*86400000)},select:metadata});
  await tx.auditLog.create({data:{organizationId:actor.organizationId,actorId:actor.id,action:'API_KEY_CREATED',targetId:row.id,ip,metadata:{name:row.name,prefix:row.prefix,scopes:row.scopes}}});return {item:row,key:generated.key,oneTime:true};
 });}
 async revoke(actor:Principal,id:string,ip?:string){return this.transaction(actor,async tx=>{const row=await tx.apiKey.findFirst({where:{id,organizationId:actor.organizationId,createdByUserId:actor.id}});if(!row)throw new NotFoundException('API key not found.');if(row.revokedAt)return {revoked:true};await tx.apiKey.update({where:{id},data:{revokedAt:new Date()}});await tx.auditLog.create({data:{organizationId:actor.organizationId,actorId:actor.id,action:'API_KEY_REVOKED',targetId:id,ip,metadata:{prefix:row.prefix}}});return {revoked:true};});}
 async rotate(actor:Principal,id:string,ip?:string){return this.transaction(actor,async tx=>{const old=await tx.apiKey.findFirst({where:{id,organizationId:actor.organizationId,createdByUserId:actor.id}});if(!old)throw new NotFoundException('API key not found.');if(old.revokedAt||old.expiresAt&&old.expiresAt<=new Date())throw new ConflictException('Only an active, unexpired key can be rotated.');const generated=issueApiSecret();await tx.apiKey.update({where:{id},data:{revokedAt:new Date()}});const row=await tx.apiKey.create({data:{organizationId:actor.organizationId,createdByUserId:actor.id,name:old.name,scopes:old.scopes,hash:generated.hash,prefix:generated.prefix,expiresAt:old.expiresAt,rotatedFromId:id},select:metadata});await tx.auditLog.create({data:{organizationId:actor.organizationId,actorId:actor.id,action:'API_KEY_ROTATED',targetId:row.id,ip,metadata:{previousKeyId:id,prefix:row.prefix,previousKeyRevoked:true}}});return {item:row,key:generated.key,oneTime:true};});}
 async usage(actor:Principal){return this.db.apiUsageLog.findMany({where:{organizationId:actor.organizationId,apiKey:{createdByUserId:actor.id}},select:{id:true,keyPrefix:true,method:true,route:true,statusCode:true,requestId:true,createdAt:true},orderBy:{createdAt:'desc'},take:100});}
 async recordUsage(key:{id:string;organizationId:string;prefix:string},method:string,route:string,statusCode:number){await this.db.apiUsageLog.create({data:{organizationId:key.organizationId,apiKeyId:key.id,keyPrefix:key.prefix,method:method.slice(0,12),route:route.split('?')[0].slice(0,250),statusCode}});}
 async authenticate(raw:unknown,scope:ApiScope,method:string,route:string){
  if(typeof raw!=='string'||!/^789k_[a-zA-Z0-9_-]{43}$/.test(raw))throw new UnauthorizedException('Invalid API key.');
  const key=await this.db.apiKey.findUnique({where:{hash:hashToken(raw)},include:{createdBy:true,organization:true}});
  if(!key)throw new UnauthorizedException('Invalid API key.');
  if(key.revokedAt||key.expiresAt&&key.expiresAt<=new Date()||!key.createdBy||key.createdBy.organizationId!==key.organizationId||['SUSPENDED','REJECTED'].includes(key.organization.status)){await this.recordUsage(key,method,route,401);throw new UnauthorizedException('API key is inactive.');}
  if(!API_SCOPES.includes(scope)||!key.scopes.includes(scope)){await this.recordUsage(key,method,route,403);throw new ForbiddenException('API key does not grant the required scope.');}
  const owner=key.createdBy;const principal:Principal={id:owner.id,organizationId:key.organizationId,fullName:owner.fullName,email:owner.email,emailVerified:owner.emailVerified,role:owner.role};
  await this.db.apiKey.update({where:{id:key.id},data:{lastUsedAt:new Date()}});
  return {principal,key:{id:key.id,organizationId:key.organizationId,prefix:key.prefix}};
 }
}
