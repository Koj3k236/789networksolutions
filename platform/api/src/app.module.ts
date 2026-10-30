import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {SupportService} from './support/support.service';
import {SupportController,AdminSupportController,NotificationsController} from './support/support.controller';
import {ApiKeysService} from './api-keys/api-keys.service';
import {ApiKeyGuard,ApiUsageInterceptor} from './api-keys/api-key.guard';
import {ApiKeysController,AutomationController} from './api-keys/api-keys.controller';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './common/prisma.service';
import { AccessGuard } from './common/security';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { PortalService } from './portal/portal.service';
import { AdminController, PortalController } from './portal/portal.controller';
import { DemoQueue } from './demo/queue.service';
import { CallerIdService } from './caller-id/caller-id.service';
import { CallerIdController, CallerIdAdminController } from './caller-id/caller-id.controller';
import {TrunksService} from './trunks/trunks.service';
import {TrunksController,AdminTrunksController} from './trunks/trunks.controller';
@Module({imports:[JwtModule.registerAsync({global:true,useFactory:()=>({secret:process.env.JWT_SECRET,signOptions:{expiresIn:'15m',issuer:'789-network-solutions',audience:'789-portal'},verifyOptions:{issuer:'789-network-solutions',audience:'789-portal',algorithms:['HS256']}})}),ThrottlerModule.forRoot([{ttl:60000,limit:100}])],controllers:[AuthController,PortalController,AdminController,CallerIdController,CallerIdAdminController,TrunksController,AdminTrunksController,ApiKeysController,AutomationController,SupportController,AdminSupportController,NotificationsController],providers:[PrismaService,AuthService,PortalService,DemoQueue,CallerIdService,TrunksService,ApiKeysService,ApiKeyGuard,ApiUsageInterceptor,SupportService,{provide:APP_GUARD,useClass:ThrottlerGuard},{provide:APP_GUARD,useClass:AccessGuard}]})
export class AppModule {}
