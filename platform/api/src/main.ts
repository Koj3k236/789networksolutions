import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
export async function createApplication() {
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. PostgreSQL only; no fallback database.');
  if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32) throw new Error('Set a unique JWT_SECRET of at least 32 characters.');
  if(!/^[a-f0-9]{64}$/i.test(process.env.DATA_ENCRYPTION_KEY||'')) throw new Error('Set DATA_ENCRYPTION_KEY to a 32-byte hex key.');
  if(!process.env.WEB_ORIGIN) throw new Error('WEB_ORIGIN is required.');
  if((process.env.APP_MODE||'DEMO')!=='DEMO') throw new Error('Fail-closed: only DEMO mode is implemented in Phase 1.');
  if(process.env.NODE_ENV==='production'&&process.env.COOKIE_SECURE!=='true') throw new Error('Secure cookies are required for production web hosting. Calling remains DEMO.');
  const app=await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());app.use(cookieParser());
  app.enableCors({origin:process.env.WEB_ORIGIN,credentials:true,methods:['GET','POST','PATCH','DELETE','OPTIONS']});
  app.use((req:any,res:any,next:any)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.cookies?.refresh&&req.headers.origin!==process.env.WEB_ORIGIN) return res.status(403).json({message:'Request origin is not allowed.'});
    res.setHeader('Cache-Control','no-store');next();
  });
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  const document=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('789 NETWORK SOLUTIONS API').setDescription('Phase 1 foundation. DEMO ONLY. Real calling, provisioning, payments and email delivery are unavailable.').setVersion('1.0.0').addBearerAuth().build());
  SwaggerModule.setup('api/docs',app,document,{jsonDocumentUrl:'api/openapi.json'});
  app.enableShutdownHooks();return app;
}
if(require.main===module) createApplication().then(app=>app.listen(Number(process.env.PORT||8001),'0.0.0.0')).catch(()=>{console.error('API startup failed. Verify environment values and PostgreSQL connectivity; no fallback is used.');process.exit(1);});
