import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
export function redisConnection() {
  if(!process.env.REDIS_URL) throw new ServiceUnavailableException('Redis is not configured; background jobs are unavailable.');
  const url=new URL(process.env.REDIS_URL);
  return {host:url.hostname,port:Number(url.port||6379),username:url.username||undefined,password:url.password||undefined,tls:url.protocol==='rediss:'?{}:undefined,maxRetriesPerRequest:null};
}
@Injectable()
export class DemoQueue implements OnModuleDestroy {
  private queue?: Queue;
  async enqueue(organizationId:string,actorId:string) {
    this.queue ??= new Queue('demo-dataset',{connection:redisConnection()});
    const job=await this.queue.add('populate',{organizationId,actorId},{jobId:`demo-${organizationId}`,attempts:3,backoff:{type:'exponential',delay:1000},removeOnComplete:100,removeOnFail:100});
    return {jobId:job.id,status:'QUEUED',message:'Accepted for background processing; not yet completed.'};
  }
  async onModuleDestroy(){await this.queue?.close();}
}
