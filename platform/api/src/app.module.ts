import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './common/prisma.service';
import { AccessGuard } from './common/security';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { PortalService } from './portal/portal.service';
import { AdminController, PortalController } from './portal/portal.controller';
import { DemoQueue } from './demo/queue.service';
@Module({imports:[JwtModule.registerAsync({global:true,useFactory:()=>({secret:process.env.JWT_SECRET,signOptions:{expiresIn:'15m',issuer:'789-network-solutions',audience:'789-portal'},verifyOptions:{issuer:'789-network-solutions',audience:'789-portal',algorithms:['HS256']}})}),ThrottlerModule.forRoot([{ttl:60000,limit:100}])],controllers:[AuthController,PortalController,AdminController],providers:[PrismaService,AuthService,PortalService,DemoQueue,{provide:APP_GUARD,useClass:ThrottlerGuard},{provide:APP_GUARD,useClass:AccessGuard}]})
export class AppModule {}
