import { Body, Controller, Get, HttpException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../common/prisma.service';
import { ADMIN_ROLES, AuthRequest, Public, Roles } from '../common/security';
import { ContactDto, StatusDto } from '../auth/dto';
import { PortalService } from './portal.service';
import { GenericRESTCarrierAdapter, GenericSIPCarrierAdapter, MockCarrierAdapter } from '../carriers/adapters';
import { loadDemoDataset } from '../demo/dataset';
import { DemoQueue } from '../demo/queue.service';
@ApiTags('Customer portal') @ApiBearerAuth() @Controller()
export class PortalController {
  constructor(private portal:PortalService,private db:PrismaService,private queue:DemoQueue){}
  @Public() @Get('health') health(){return {application:'789 NETWORK SOLUTIONS',mode:'DEMO',callingEnabled:false,phase:1};}
  @Get('dashboard') dashboard(@Req() req:AuthRequest,@Query('days') days?:string){return this.portal.dashboard(req.user,days===undefined?1:Number(days));}
  @Get('cdr') cdr(@Req() req:AuthRequest,@Query() query:{search?:string;page?:string;status?:string}){return this.portal.cdr(req.user,query);}
  @Get('balance') async balance(@Req() req:AuthRequest){const d=await this.portal.dashboard(req.user);return {balance:d.summary.balance,currency:'USD',mode:'DEMO',realFunds:false};}
  @Get('numbers') numbers(@Req() req:AuthRequest){return this.db.phoneNumber.findMany({where:{organizationId:req.user.organizationId}});}
  @Get('rates') rates(){return new MockCarrierAdapter().getRates();}
  @Get('login-history') history(@Req() req:AuthRequest){return this.db.loginHistory.findMany({where:{userId:req.user.id},orderBy:{createdAt:'desc'},take:30});}
  @Post('demo/dataset') @Throttle({default:{limit:2,ttl:60000}})
  dataset(@Req() req:AuthRequest){return loadDemoDataset(this.db,req.user.organizationId,req.user.id);}
  @Post('demo/jobs') jobs(@Req() req:AuthRequest){return this.queue.enqueue(req.user.organizationId,req.user.id);}
  @Post('calls') unavailable(){throw new HttpException({code:'CAPABILITY_UNAVAILABLE',message:'Call initiation is not implemented in Phase 1. No upstream carrier is connected; no call was placed.'},501);}
  @Post('numbers/search') searchNumbers(){return new MockCarrierAdapter().getAvailableNumbers();}
  @Public() @Post('contact') @Throttle({default:{limit:3,ttl:60000}})
  async contact(@Body() body:ContactDto){await this.db.contactRequest.create({data:body});return {message:'Your inquiry was saved. Email notification is not connected.'};}
}
@ApiTags('Administration') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Controller('admin')
export class AdminController {
  constructor(private portal:PortalService,private db:PrismaService){}
  @Get('summary') summary(){return this.portal.adminSummary();}
  @Get('customers') customers(){return this.portal.customers();}
  @Patch('customers/:id/status') @Roles('SUPER_ADMIN','COMPLIANCE_ADMIN')
  status(@Param('id',ParseUUIDPipe) id:string,@Body() body:StatusDto,@Req() req:AuthRequest){return this.portal.setStatus(id,body,req.user,req.ip||'unknown');}
  @Get('audit') audit(){return this.db.auditLog.findMany({orderBy:{createdAt:'desc'},take:100,include:{organization:{select:{businessName:true}}}});}
  @Get('carriers') @Roles('SUPER_ADMIN','OPERATIONS_ADMIN','COMPLIANCE_ADMIN')
  carriers(){return [new MockCarrierAdapter(),new GenericSIPCarrierAdapter(),new GenericRESTCarrierAdapter()].map(a=>({name:a.name,mode:a.mode,capabilities:[...a.capabilities],connected:false,configured:false}));}
}
