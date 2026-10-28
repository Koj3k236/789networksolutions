import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { Role } from '@prisma/client';
import type { Request } from 'express';
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export type Principal = { id: string; organizationId: string; role: Role; email: string; fullName: string; emailVerified: boolean };
export type AuthRequest = Request & { user: Principal };
export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'BILLING_ADMIN', 'COMPLIANCE_ADMIN', 'SUPPORT_AGENT'];
export function assertRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) throw new ForbiddenException('This action requires an authorized administrator.');
}
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    let claims: { sub: string; sid: string };
    try { claims = this.jwt.verify((req.headers.authorization || '').replace(/^Bearer /, '')); } catch { throw new UnauthorizedException('Sign in to continue.'); }
    const session = await this.db.refreshToken.findUnique({ where: { id: claims.sid }, include: { user: { include: { organization: true } } } });
    if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt < new Date()) throw new UnauthorizedException('Session expired.');
    const user = session.user;
    if (['SUSPENDED','REJECTED'].includes(user.organization.status)) throw new ForbiddenException('This account is not permitted to access the platform.');
    const allowed = this.reflector.getAllAndOverride<Role[]>('roles', [context.getHandler(), context.getClass()]);
    if (allowed) assertRole(user.role, allowed);
    req.user = { id: user.id, organizationId: user.organizationId, role: user.role, email: user.email, fullName: user.fullName, emailVerified: user.emailVerified };
    return true;
  }
}
