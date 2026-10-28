import { Prisma, PrismaClient } from '@prisma/client';
export function calculateCharge(seconds:number, rate:string, increment=6, minimum=6, fee='0', minimumCharge='0') {
  if (!Number.isInteger(seconds)||seconds<0||increment<=0||minimum<0) throw new Error('Invalid billing parameters');
  if (seconds===0) return new Prisma.Decimal(0);
  const billable=Math.ceil(Math.max(seconds,minimum)/increment)*increment;
  return Prisma.Decimal.max(new Prisma.Decimal(rate).mul(billable).div(60).plus(fee),new Prisma.Decimal(minimumCharge)).toDecimalPlaces(6);
}
export async function loadDemoDataset(db:PrismaClient,organizationId:string,actorId:string) {
  if ((process.env.APP_MODE||'DEMO')!=='DEMO') throw new Error('Demo dataset is restricted to DEMO mode');
  return db.$transaction(async tx=>{
    const org=await tx.organization.findUniqueOrThrow({where:{id:organizationId}});
    if(org.mode!=='DEMO') throw new Error('Organization is not a demo organization');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
    const wallet=await tx.wallet.upsert({where:{organizationId_mode_currency:{organizationId,mode:'DEMO',currency:'USD'}},create:{organizationId},update:{}});
    const key=`demo-dataset-v1:${organizationId}`;
    if(await tx.ledgerEntry.findUnique({where:{idempotencyKey:key}})) return {created:false,message:'This workspace already has the demo dataset.'};
    await tx.ledgerEntry.create({data:{walletId:wallet.id,amount:'500.000000',kind:'DEMO_CREDIT',description:'Sample credit — no money received',idempotencyKey:key}});
    const trunks=await Promise.all(['Primary office','Support desk','Development'].map(name=>tx.sipTrunk.upsert({where:{organizationId_name:{organizationId,name}},create:{organizationId,name,enabled:false},update:{}})));
    const now=new Date();
    for(let i=0;i<96;i++) {
      const success=i%11!==0;
      const duration=success?42+(i*37)%420:0;
      const start=new Date(now.getTime()-(i*19+5)*60000);
      const charge=calculateCharge(duration,'0.008');
      const upstream=calculateCharge(duration,'0.005');
      const cdr=await tx.callDetailRecord.create({data:{organizationId,trunkId:trunks[i%3].id,source:'+12025550101',destination:`+1202555${String(100+i%99).padStart(4,'0')}`,callerId:'+12025550101',direction:i%3===0?'INBOUND':'OUTBOUND',startTime:start,answerTime:success?new Date(start.getTime()+2000):null,endTime:new Date(start.getTime()+(duration+2)*1000),duration,billableDuration:Math.ceil(duration/6)*6,status:success?'COMPLETED':'FAILED',sipCode:success?200:486,upstreamCost:upstream,customerRate:'0.008',customerCharge:charge,grossMargin:charge.minus(upstream),disconnectReason:success?'DEMO_NORMAL_CLEARING':'DEMO_BUSY',idempotencyKey:`${key}:call:${i}`}});
      if(charge.gt(0)) await tx.ledgerEntry.create({data:{walletId:wallet.id,amount:charge.negated(),kind:'DEMO_CALL',description:'Simulated voice usage',idempotencyKey:`${key}:charge:${i}`,referenceId:cdr.id,createdAt:start}});
    }
    await tx.auditLog.create({data:{organizationId,actorId,action:'DEMO_DATASET_CREATED',metadata:{simulated:true,calls:96,realFunds:false}}});
    return {created:true,message:'96 simulated CDRs and test ledger entries stored. No real calls or payments occurred.'};
  },{timeout:30000});
}
