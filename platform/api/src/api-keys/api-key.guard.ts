import {CallHandler,CanActivate,ExecutionContext,Injectable,NestInterceptor,SetMetadata,UnauthorizedException} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {catchError,concatMap,Observable,throwError,from} from 'rxjs';
import {ApiKeysService} from './api-keys.service';
import {ApiScope} from './dto';
export const KeyScope=(scope:ApiScope)=>SetMetadata('api-key-scope',scope);
@Injectable()
export class ApiKeyGuard implements CanActivate {
 constructor(private service:ApiKeysService,private reflector:Reflector){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();const scope=this.reflector.getAllAndOverride<ApiScope>('api-key-scope',[ctx.getHandler(),ctx.getClass()]);if(!scope)throw new UnauthorizedException('API key access is not allowed on this endpoint.');const path=typeof req.route?.path==='string'?req.route.path:'';const route=path.startsWith('/api/')?path:`/api/v1/automation${path}`;const auth=await this.service.authenticate(req.headers['x-api-key'],scope,req.method,route);req.user=auth.principal;req.apiKey=auth.key;req.apiUsageRoute=route;return true;}
}
@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
 constructor(private service:ApiKeysService){}
 intercept(ctx:ExecutionContext,next:CallHandler):Observable<unknown>{const req=ctx.switchToHttp().getRequest();const res=ctx.switchToHttp().getResponse();return next.handle().pipe(concatMap(async value=>{await this.service.recordUsage(req.apiKey,req.method,req.apiUsageRoute,res.statusCode);return value;}),catchError(error=>from(this.service.recordUsage(req.apiKey,req.method,req.apiUsageRoute,typeof error.getStatus==='function'?error.getStatus():500)).pipe(concatMap(()=>throwError(()=>error)))));}
}
