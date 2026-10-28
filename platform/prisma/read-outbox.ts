import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../api/src/common/crypto';
const db=new PrismaClient();
async function main(){
  if(process.env.APP_MODE!=='DEMO')throw new Error('Development outbox is DEMO-only.');
  const recipient=process.argv[2];if(!recipient)throw new Error('Usage: yarn tsx prisma/read-outbox.ts you@example.com');
  const messages=await db.developmentMessage.findMany({where:{recipient:recipient.toLowerCase()},orderBy:{createdAt:'desc'},take:5});
  for(const message of messages)console.log(message.subject, decrypt(message.bodyEncrypted));
}
main().finally(()=>db.$disconnect());
