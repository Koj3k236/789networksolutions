import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public, AuthRequest } from '../common/security';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ResetDto, ResetRequestDto, TokenDto, TotpDto } from './dto';
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  private cookie(res: Response, token: string) { res.cookie('refresh',token,{httpOnly:true,secure:process.env.COOKIE_SECURE==='true',sameSite:'strict',path:'/api/v1/auth',maxAge:7*86400000}); }
  @Public() @Post('register') @Throttle({default:{limit:5,ttl:60000}})
  register(@Body() body: RegisterDto,@Req() req: Request) { return this.auth.register(body,req.ip||'unknown'); }
  @Public() @Post('login') @Throttle({default:{limit:10,ttl:60000}})
  async login(@Body() body:LoginDto,@Req() req:Request,@Res({passthrough:true}) res:Response) {
    const {refreshToken,...data}=await this.auth.login(body,req.ip||'unknown',req.headers['user-agent']||'unknown'); this.cookie(res,refreshToken); return data;
  }
  @Public() @Post('refresh')
  async refresh(@Req() req:Request,@Res({passthrough:true}) res:Response) { const {refreshToken,...data}=await this.auth.refresh(req.cookies?.refresh); this.cookie(res,refreshToken); return data; }
  @Public() @Post('logout')
  async logout(@Req() req:Request,@Res({passthrough:true}) res:Response) { const result=await this.auth.logout(req.cookies?.refresh); res.clearCookie('refresh',{path:'/api/v1/auth',httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true'}); return result; }
  @Public() @Post('verify-email') verify(@Body() body:TokenDto) { return this.auth.verify(body.token); }
  @Public() @Post('request-reset') @Throttle({default:{limit:3,ttl:60000}})
  requestReset(@Body() body:ResetRequestDto) { return this.auth.requestReset(body.email); }
  @Public() @Post('reset-password') reset(@Body() body:ResetDto) { return this.auth.reset(body.token,body.password); }
  @ApiBearerAuth() @Get('me') me(@Req() req:AuthRequest) { return req.user; }
  @ApiBearerAuth() @Post('totp/setup') setup(@Req() req:AuthRequest) { return this.auth.setupTotp(req.user.id); }
  @ApiBearerAuth() @Post('totp/enable') enable(@Req() req:AuthRequest,@Body() body:TotpDto) { return this.auth.enableTotp(req.user.id,body.code); }
}
