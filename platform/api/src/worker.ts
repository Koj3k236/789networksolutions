import 'reflect-metadata';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Worker } from 'bullmq';
import { loadDemoDataset } from './demo/dataset';
import { redisConnection } from './demo/queue.service';
if(process.env.APP_MODE!=='DEMO') throw new Error('Only DEMO background work is implemented.');
const db=new PrismaClient();
const worker=new Worker('demo-dataset',job=>loadDemoDataset(db,job.data.organizationId,job.data.actorId),{connection:redisConnection(),concurrency:2});
worker.on('failed',job=>console.error('Demo job failed:',job?.id));
async function close(){await worker.close();await db.$disconnect();}
process.on('SIGTERM',close);process.on('SIGINT',close);
