import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ADMIN_ROLES, AuthRequest, Roles } from '../common/security';
import { CallerIdService, CALLER_ID_EDIT_ROLES } from './caller-id.service';
import { DefaultCallerIdDto, EnableRequestDto, NumberReviewDto, PermissionSettingsDto, RequestDecisionDto, SubmitNumberDto, ValidateCallerIdDto } from './dto';
@ApiTags('Caller ID permissions') @ApiBearerAuth() @Controller('caller-id')
export class CallerIdController {
  constructor(private readonly service: CallerIdService) {}
  @Get('workspace') workspace(@Req() req: AuthRequest) { return this.service.workspace(req.user.organizationId,req.user); }
  @Post('requests') @Throttle({default:{limit:5,ttl:60000}})
  request(@Req() req: AuthRequest,@Body() body: EnableRequestDto) { return this.service.requestEnable(req.user,body,req.ip); }
  @Delete('requests/:id') cancel(@Req() req: AuthRequest,@Param('id',ParseUUIDPipe) id: string) { return this.service.cancelRequest(req.user,id,req.ip); }
  @Post('inventory') submit(@Req() req: AuthRequest,@Body() body: SubmitNumberDto) { return this.service.submitNumber(req.user,body,req.ip); }
  @Delete('inventory/:id') withdraw(@Req() req: AuthRequest,@Param('id',ParseUUIDPipe) id: string) { return this.service.withdrawNumber(req.user,id,req.ip); }
  @Patch('trunks/:id/default') setDefault(@Req() req: AuthRequest,@Param('id',ParseUUIDPipe) id: string,@Body() body: DefaultCallerIdDto) { return this.service.setDefault(req.user,id,body.callerId,req.ip); }
  @Post('validate') @Throttle({default:{limit:20,ttl:60000}})
  validate(@Req() req: AuthRequest,@Body() body: ValidateCallerIdDto) { return this.service.validate(req.user,body,req.ip); }
}
@ApiTags('Caller ID administration') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Controller('admin/caller-id')
export class CallerIdAdminController {
  constructor(private readonly service: CallerIdService) {}
  @Get('requests') queue(@Req() req: AuthRequest) { return this.service.queue(req.user); }
  @Get('customers/:orgId') workspace(@Req() req: AuthRequest,@Param('orgId',ParseUUIDPipe) orgId: string) { return this.service.workspace(orgId,req.user); }
  @Patch('customers/:orgId/permissions') @Roles(...CALLER_ID_EDIT_ROLES)
  settings(@Req() req: AuthRequest,@Param('orgId',ParseUUIDPipe) orgId: string,@Body() body: PermissionSettingsDto) { return this.service.updateSettings(orgId,req.user,body,req.ip); }
  @Post('customers/:orgId/requests/:id/decision') @Roles(...CALLER_ID_EDIT_ROLES)
  decide(@Req() req: AuthRequest,@Param('orgId',ParseUUIDPipe) orgId: string,@Param('id',ParseUUIDPipe) id: string,@Body() body: RequestDecisionDto) { return this.service.decideRequest(orgId,id,req.user,body,req.ip); }
  @Post('customers/:orgId/inventory/:id/review') @Roles(...CALLER_ID_EDIT_ROLES)
  review(@Req() req: AuthRequest,@Param('orgId',ParseUUIDPipe) orgId: string,@Param('id',ParseUUIDPipe) id: string,@Body() body: NumberReviewDto) { return this.service.reviewNumber(orgId,id,req.user,body,req.ip); }
}
