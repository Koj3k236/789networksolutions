import {Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query,Req} from '@nestjs/common';
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import {Throttle} from '@nestjs/throttler';
import {AuthRequest,Roles} from '../common/security';
import {SupportService,SUPPORT_ROLES} from './support.service';
import {AdminTicketUpdateDto,CreateTicketDto,CustomerTicketStateDto,ReplyDto,TicketQueryDto} from './dto';
@ApiTags('Customer support') @ApiBearerAuth() @Controller('support/tickets')
export class SupportController {
 constructor(private service:SupportService){}
 @Get() list(@Req() r:AuthRequest,@Query() q:TicketQueryDto){return this.service.list(r.user,q);}
 @Post() @Throttle({default:{limit:5,ttl:60000}}) create(@Req() r:AuthRequest,@Body() b:CreateTicketDto){return this.service.create(r.user,b,r.ip);}
 @Get(':id') detail(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.detail(r.user,id);}
 @Post(':id/replies') reply(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:ReplyDto){return this.service.reply(r.user,id,b,false,r.ip);}
 @Patch(':id/status') status(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:CustomerTicketStateDto){return this.service.customerState(r.user,id,b.status,b.expectedVersion,r.ip);}
}
@ApiTags('Support administration') @ApiBearerAuth() @Roles(...SUPPORT_ROLES) @Controller('admin/support')
export class AdminSupportController {
 constructor(private service:SupportService){}
 @Get('agents') agents(@Req() r:AuthRequest){return this.service.agents(r.user);}
 @Get('tickets') list(@Req() r:AuthRequest,@Query() q:TicketQueryDto){return this.service.list(r.user,q,true);}
 @Get('tickets/:id') detail(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.detail(r.user,id,true);}
 @Post('tickets/:id/replies') reply(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:ReplyDto){return this.service.reply(r.user,id,b,true,r.ip);}
 @Patch('tickets/:id') update(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string,@Body() b:AdminTicketUpdateDto){return this.service.update(r.user,id,b,r.ip);}
}
@ApiTags('In-app notifications') @ApiBearerAuth() @Controller('notifications')
export class NotificationsController {
 constructor(private service:SupportService){}
 @Get() list(@Req() r:AuthRequest){return this.service.notifications(r.user);}
 @Post('read-all') all(@Req() r:AuthRequest){return this.service.markAllRead(r.user);}
 @Patch(':id/read') read(@Req() r:AuthRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.markRead(r.user,id);}
}
