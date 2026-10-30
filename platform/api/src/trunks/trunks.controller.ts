import {Body,Controller,Delete,Get,Param,ParseUUIDPipe,Patch,Post,Req} from '@nestjs/common';
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import {ADMIN_ROLES,AuthRequest,Roles} from '../common/security';
import {TrunksService,TRUNK_EDIT_ROLES} from './trunks.service';
import {AccountLimitsDto,AddIpDto,CreateTrunkDto,EnableTrunkDto,RevisionDto,UpdateTrunkDto} from './dto';
@ApiTags('SIP trunk configuration') @ApiBearerAuth() @Controller('sip-trunks')
export class TrunksController {
 constructor(private service:TrunksService){}
 @Get('workspace') workspace(@Req() r:AuthRequest){return this.service.workspace(r.user.organizationId,r.user);}
 @Get() list(@Req() r:AuthRequest){return this.service.list(r.user.organizationId,r.user);}
 @Post() create(@Req() r:AuthRequest,@Body() b:CreateTrunkDto){return this.service.create(r.user.organizationId,r.user,b,r.ip);}
 @Get(':id') detail(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.detail(r.user.organizationId,id,r.user);}
 @Patch(':id') update(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:UpdateTrunkDto){return this.service.update(r.user.organizationId,id,r.user,b,r.ip);}
 @Patch(':id/enabled') enabled(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:EnableTrunkDto){return this.service.enable(r.user.organizationId,id,r.user,b.enabled,b.expectedVersion,r.ip);}
 @Post(':id/credentials/rotate') rotate(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:RevisionDto){return this.service.rotate(r.user.organizationId,id,r.user,b.expectedVersion,r.ip);}
 @Post(':id/ips') addIp(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:AddIpDto){return this.service.addIp(r.user.organizationId,id,r.user,b,r.ip);}
 @Delete(':id/ips/:ipId') removeIp(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Param('ipId',ParseUUIDPipe) ipId:string,@Body() b:RevisionDto){return this.service.removeIp(r.user.organizationId,id,ipId,r.user,b.expectedVersion,r.ip);}
 @Delete(':id') remove(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:RevisionDto){return this.service.remove(r.user.organizationId,id,r.user,b.expectedVersion,r.ip);}
}
@ApiTags('SIP trunk administration') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Controller('admin/customers/:orgId/sip-trunks')
export class AdminTrunksController {
 constructor(private service:TrunksService){}
 @Get('workspace') workspace(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string){return this.service.workspace(org,r.user);}
 @Get(':id') detail(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Param('id',ParseUUIDPipe) id:string){return this.service.detail(org,id,r.user);}
 @Post() @Roles(...TRUNK_EDIT_ROLES) create(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Body() b:CreateTrunkDto){return this.service.create(org,r.user,b,r.ip);}
 @Patch('account-limits') @Roles(...TRUNK_EDIT_ROLES) limits(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Body() b:AccountLimitsDto){return this.service.limits(org,r.user,b,r.ip);}
 @Patch(':id') @Roles(...TRUNK_EDIT_ROLES) update(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Param('id',ParseUUIDPipe) id:string,@Body() b:UpdateTrunkDto){return this.service.update(org,id,r.user,b,r.ip);}
 @Patch(':id/enabled') @Roles(...TRUNK_EDIT_ROLES) enabled(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Param('id',ParseUUIDPipe) id:string,@Body() b:EnableTrunkDto){return this.service.enable(org,id,r.user,b.enabled,b.expectedVersion,r.ip);}
 @Post(':id/credentials/rotate') @Roles(...TRUNK_EDIT_ROLES) rotate(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Param('id',ParseUUIDPipe) id:string,@Body() b:RevisionDto){return this.service.rotate(org,id,r.user,b.expectedVersion,r.ip);}
 @Post(':id/ips') @Roles(...TRUNK_EDIT_ROLES) addIp(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Param('id',ParseUUIDPipe) id:string,@Body() b:AddIpDto){return this.service.addIp(org,id,r.user,b,r.ip);}
 @Delete(':id/ips/:ipId') @Roles(...TRUNK_EDIT_ROLES) removeIp(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Param('id',ParseUUIDPipe) id:string,@Param('ipId',ParseUUIDPipe) ipId:string,@Body() b:RevisionDto){return this.service.removeIp(org,id,ipId,r.user,b.expectedVersion,r.ip);}
 @Delete(':id') @Roles(...TRUNK_EDIT_ROLES) remove(@Req() r:AuthRequest,@Param('orgId',ParseUUIDPipe) org:string,@Param('id',ParseUUIDPipe) id:string,@Body() b:RevisionDto){return this.service.remove(org,id,r.user,b.expectedVersion,r.ip);}
}
