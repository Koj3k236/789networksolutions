import {Body,Controller,Delete,Get,Param,ParseUUIDPipe,Patch,Post,Query,Req,UseGuards,UseInterceptors} from '@nestjs/common';
import {ApiBearerAuth,ApiSecurity,ApiTags} from '@nestjs/swagger';
import {AuthRequest,Public} from '../common/security';
import {ApiKeysService} from './api-keys.service';
import {CreateApiKeyDto} from './dto';
import {ApiKeyGuard,ApiUsageInterceptor,KeyScope} from './api-key.guard';
import {TrunksService} from '../trunks/trunks.service';
import {CreateTrunkDto,UpdateTrunkDto} from '../trunks/dto';
import {PortalService} from '../portal/portal.service';
import {CallerIdService} from '../caller-id/caller-id.service';
@ApiTags('Customer API keys') @ApiBearerAuth() @Controller('api-keys')
export class ApiKeysController {
 constructor(private service:ApiKeysService){}
 @Get() list(@Req() r:AuthRequest){return this.service.list(r.user);}
 @Get('usage') usage(@Req() r:AuthRequest){return this.service.usage(r.user);}
 @Post() create(@Req() r:AuthRequest,@Body() b:CreateApiKeyDto){return this.service.create(r.user,b,r.ip);}
 @Post(':id/rotate') rotate(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.rotate(r.user,id,r.ip);}
 @Delete(':id') revoke(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.revoke(r.user,id,r.ip);}
}
@ApiTags('Scoped customer automation') @ApiSecurity('ApiKey') @Public() @UseGuards(ApiKeyGuard) @UseInterceptors(ApiUsageInterceptor) @Controller('automation')
export class AutomationController {
 constructor(private trunks:TrunksService,private portal:PortalService,private callerIds:CallerIdService){}
 @Get('sip-trunks') @KeyScope('trunks:read') trunksList(@Req() r:AuthRequest){return this.trunks.list(r.user.organizationId,r.user);}
 @Post('sip-trunks') @KeyScope('trunks:write') create(@Req() r:AuthRequest,@Body() b:CreateTrunkDto){return this.trunks.create(r.user.organizationId,r.user,b,r.ip);}
 @Patch('sip-trunks/:id') @KeyScope('trunks:write') update(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:UpdateTrunkDto){return this.trunks.update(r.user.organizationId,id,r.user,b,r.ip);}
 @Get('cdr') @KeyScope('cdr:read') cdr(@Req() r:AuthRequest,@Query() q:{search?:string;page?:string;status?:string}){return this.portal.cdr(r.user,q);}
 @Get('balance') @KeyScope('balance:read') async balance(@Req() r:AuthRequest){const d=await this.portal.dashboard(r.user);return {balance:d.summary.balance,currency:'USD',mode:'DEMO',realFunds:false};}
 @Get('caller-id') @KeyScope('caller-id:read') caller(@Req() r:AuthRequest){return this.callerIds.workspace(r.user.organizationId,r.user);}
}
