import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as OTPAuth from 'otpauth';
import { PrismaService } from '../common/prisma.service';
import { decrypt, encrypt, hashPassword, hashToken, newToken, verifyPassword } from '../common/crypto';
import { LoginDto, RegisterDto } from './dto';
@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private jwt: JwtService) {}
  private async message(tx: Prisma.TransactionClient, user: User, purpose: string) {
    const token = newToken();
    await tx.actionToken.create({data:{userId:user.id, hash:hashToken(token), purpose, expiresAt:new Date(Date.now()+3600000)}});
    const route = purpose === 'VERIFY' ? 'verify-email' : 'reset-password';
    const url = `${process.env.WEB_ORIGIN}/${route}/#token=${token}`;
    await tx.developmentMessage.create({data:{recipient:user.email, subject:`DEVELOPMENT ONLY: ${purpose}`, bodyEncrypted:encrypt(url)}});
  }
  async register(input: RegisterDto, ip: string) {
    if (!input.acceptTerms) throw new BadRequestException('Accept the terms and acceptable use policy.');
    if (input.password !== input.confirmPassword) throw new BadRequestException('Passwords do not match.');
    const passwordHash = await hashPassword(input.password);
    try {
      await this.db.$transaction(async tx => {
        const org = await tx.organization.create({data:{businessName:input.businessName,country:input.country,phone:input.phone,address:input.address,website:input.website,registrationNumber:input.registrationNumber,taxIdEncrypted:input.taxId ? encrypt(input.taxId) : undefined}});
        const user = await tx.user.create({data:{organizationId:org.id,fullName:input.fullName,email:input.email.toLowerCase().trim(),passwordHash}});
        await tx.wallet.create({data:{organizationId:org.id}});
        await tx.kycRequest.create({data:{organizationId:org.id,documentObjectKeys:[],notes:'Business details submitted. Document review is not implemented in Phase 1.'}});
        await this.message(tx,user,'VERIFY');
        await tx.auditLog.create({data:{organizationId:org.id,actorId:user.id,action:'ACCOUNT_REGISTERED',ip,metadata:{termsAccepted:true,productionEnabled:false}}});
      });
    } catch(e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('An account with this email already exists.');
      throw e;
    }
    return {message:'Account created. Verification link saved to the local development outbox; no email was sent.', delivery:'DEVELOPMENT_OUTBOX', mode:'DEMO'};
  }
  private async issue(user: User, tx: Prisma.TransactionClient = this.db) {
    const token = newToken();
    const session = await tx.refreshToken.create({data:{userId:user.id,hash:hashToken(token),expiresAt:new Date(Date.now()+7*86400000)}});
    return { refreshToken:token, accessToken:this.jwt.sign({sub:user.id,sid:session.id}), user:{id:user.id,fullName:user.fullName,email:user.email,organizationId:user.organizationId,role:user.role,emailVerified:user.emailVerified,totpEnabled:user.totpEnabled} };
  }
  private totp(user: User) {
    return new OTPAuth.TOTP({issuer:'789 NETWORK SOLUTIONS', label:user.email,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(decrypt(user.totpEncrypted!))});
  }
  private checkTotp(user: User, code?: string) {
    if (!code || !user.totpEncrypted) throw new UnauthorizedException('Enter the six-digit authenticator code.');
    const offset = this.totp(user).validate({token:code,window:1});
    if (offset === null) throw new UnauthorizedException('Invalid authenticator code.');
    const step = BigInt(Math.floor(Date.now()/30000)+offset);
    if (user.totpLastStep !== null && step <= user.totpLastStep) throw new UnauthorizedException('Code already used. Wait for the next code.');
    return step;
  }
  async login(input: LoginDto, ip: string, userAgent: string) {
    const user = await this.db.user.findUnique({where:{email:input.email.toLowerCase().trim()},include:{organization:true}});
    const valid = await verifyPassword(input.password,user?.passwordHash || 'scrypt:00000000000000000000000000000000:'+ '00'.repeat(64));
    if (user && !valid) await this.db.loginHistory.create({data:{userId:user.id,ip,userAgent:userAgent.slice(0,500),successful:false}});
    if (!user || !valid) throw new UnauthorizedException('Email or password is incorrect.');
    if (['SUSPENDED','REJECTED'].includes(user.organization.status)) throw new ForbiddenException('Account access is restricted.');
    const step = user.totpEnabled ? this.checkTotp(user,input.code) : undefined;
    return this.db.$transaction(async tx => {
      if (step !== undefined) {
        const consumed = await tx.user.updateMany({where:{id:user.id,OR:[{totpLastStep:null},{totpLastStep:{lt:step}}]},data:{totpLastStep:step}});
        if (!consumed.count) throw new UnauthorizedException('Authenticator code already used.');
      }
      await tx.loginHistory.create({data:{userId:user.id,ip,userAgent:userAgent.slice(0,500),successful:true}});
      await tx.auditLog.create({data:{organizationId:user.organizationId,actorId:user.id,action:'LOGIN_SUCCEEDED',ip}});
      return this.issue(user,tx);
    });
  }
  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException('Sign in to continue.');
    return this.db.$transaction(async tx => {
      const session = await tx.refreshToken.findUnique({where:{hash:hashToken(token)},include:{user:{include:{organization:true}}}});
      if (!session || session.revokedAt || session.expiresAt < new Date()) throw new UnauthorizedException('Session expired.');
      if (['SUSPENDED','REJECTED'].includes(session.user.organization.status)) throw new ForbiddenException('Account access is restricted.');
      const consumed = await tx.refreshToken.updateMany({where:{id:session.id,revokedAt:null},data:{revokedAt:new Date()}});
      if (!consumed.count) throw new UnauthorizedException('Session already rotated.');
      return this.issue(session.user,tx);
    });
  }
  async logout(token?: string) {
    if (token) await this.db.refreshToken.updateMany({where:{hash:hashToken(token),revokedAt:null},data:{revokedAt:new Date()}});
    return {message:'Signed out.'};
  }
  async verify(token: string) {
    await this.db.$transaction(async tx => {
      const t = await tx.actionToken.findUnique({where:{hash:hashToken(token)}});
      if (!t || t.usedAt || t.purpose !== 'VERIFY' || t.expiresAt < new Date()) throw new BadRequestException('Verification link is invalid or expired.');
      const consumed = await tx.actionToken.updateMany({where:{id:t.id,usedAt:null},data:{usedAt:new Date()}});
      if (!consumed.count) throw new BadRequestException('Link already used.');
      const user = await tx.user.update({where:{id:t.userId},data:{emailVerified:true}});
      await tx.organization.updateMany({where:{id:user.organizationId,status:'PENDING_VERIFICATION'},data:{status:'UNDER_REVIEW'}});
      await tx.auditLog.create({data:{organizationId:user.organizationId,actorId:user.id,action:'EMAIL_VERIFIED'}});
    });
    return {message:'Email verified. Your business remains subject to review. Production calling is disabled.'};
  }
  async requestReset(email: string) {
    const user = await this.db.user.findUnique({where:{email:email.toLowerCase().trim()}});
    if (user) await this.db.$transaction(tx=>this.message(tx,user,'RESET'));
    return {message:'If that account exists, a reset link is in the local development outbox. No email was sent.'};
  }
  async reset(token: string, password: string) {
    const passwordHash = await hashPassword(password);
    await this.db.$transaction(async tx => {
      const t = await tx.actionToken.findUnique({where:{hash:hashToken(token)}});
      if (!t || t.purpose!=='RESET' || t.usedAt || t.expiresAt < new Date()) throw new BadRequestException('Reset link is invalid or expired.');
      const consumed = await tx.actionToken.updateMany({where:{id:t.id,usedAt:null},data:{usedAt:new Date()}});
      if (!consumed.count) throw new BadRequestException('Link already used.');
      const user = await tx.user.update({where:{id:t.userId},data:{passwordHash}});
      await tx.refreshToken.updateMany({where:{userId:t.userId,revokedAt:null},data:{revokedAt:new Date()}});
      await tx.actionToken.updateMany({where:{userId:t.userId,purpose:'RESET',usedAt:null},data:{usedAt:new Date()}});
      await tx.auditLog.create({data:{organizationId:user.organizationId,actorId:user.id,action:'PASSWORD_RESET'}});
    });
    return {message:'Password updated. Sign in again.'};
  }
  async setupTotp(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({where:{id:userId}});
    if (user.totpEnabled) throw new BadRequestException('Two-factor authentication is already enabled.');
    const secret = new OTPAuth.Secret({size:20});
    await this.db.user.update({where:{id:userId},data:{totpEncrypted:encrypt(secret.base32),totpLastStep:null}});
    return {uri:new OTPAuth.TOTP({issuer:'789 NETWORK SOLUTIONS',label:user.email,secret}).toString(),secret:secret.base32};
  }
  async enableTotp(userId: string, code: string) {
    const user = await this.db.user.findUniqueOrThrow({where:{id:userId}});
    const step = this.checkTotp(user,code);
    await this.db.$transaction(async tx=>{
      await tx.user.update({where:{id:userId},data:{totpEnabled:true,totpLastStep:step}});
      await tx.auditLog.create({data:{organizationId:user.organizationId,actorId:user.id,action:'TOTP_ENABLED'}});
    });
    return {message:'Two-factor authentication enabled. Keep your authenticator securely backed up.'};
  }
}
