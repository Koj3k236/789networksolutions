import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../api/src/common/crypto';
import { loadDemoDataset } from '../api/src/demo/dataset';
const db=new PrismaClient();
async function seed(){
  if(process.env.APP_MODE!=='DEMO') throw new Error('Seed is DEMO-only.');
  for(const role of ['SUPER_ADMIN','CUSTOMER'] as const){
    const prefix=role==='SUPER_ADMIN'?'SEED_ADMIN':'SEED_CUSTOMER';
    const email=process.env[`${prefix}_EMAIL`]?.toLowerCase();const password=process.env[`${prefix}_PASSWORD`];
    if(!email||!password||password.length<12) throw new Error(`Set ${prefix}_EMAIL and a ${prefix}_PASSWORD of at least 12 characters.`);
    let user=await db.user.findUnique({where:{email}});
    if(!user){const org=await db.organization.create({data:{businessName:role==='SUPER_ADMIN'?'789 Operations':'Acme Communications (Demo)',country:'Demo',phone:'+12025550100',address:'Sample address — replace before review',status:'UNDER_REVIEW'}});user=await db.user.create({data:{organizationId:org.id,email,fullName:role==='SUPER_ADMIN'?'Platform administrator':'Alex Morgan',role,passwordHash:await hashPassword(password),emailVerified:true}});await db.auditLog.create({data:{organizationId:org.id,actorId:user.id,action:'DEMO_ACCOUNT_SEEDED'}});}
    if(role==='CUSTOMER')await loadDemoDataset(db,user.organizationId,user.id);
  }
  console.log('Demo seed complete. No real calls, payments, numbers, or KYC approvals.');
}
seed().finally(()=>db.$disconnect());
