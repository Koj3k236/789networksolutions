import {create} from 'zustand';
import type {User} from './types';
export const PREVIEW=process.env.NEXT_PUBLIC_PREVIEW==='true';
export const API_BASE=process.env.NEXT_PUBLIC_API_BASE||'/api/v1';
export const useSession=create<{token:string|null;user:User|null;ready:boolean;set:(token:string|null,user:User|null)=>void}>((set)=>({token:null,user:null,ready:PREVIEW,set:(token,user)=>set({token,user,ready:true})}));
let refreshPromise:Promise<void>|null=null;
export async function refreshSession(){
  if(PREVIEW)return;
  if(!refreshPromise)refreshPromise=(async()=>{try{const res=await fetch(`${API_BASE}/auth/refresh`,{method:'POST',credentials:'include'});if(!res.ok)throw new Error('Session expired');const data=await res.json();useSession.getState().set(data.accessToken,data.user);}catch{useSession.getState().set(null,null);}finally{refreshPromise=null;}})();
  await refreshPromise;
}
export async function api<T=any>(path:string,options:RequestInit={},retry=true):Promise<T>{
  if(PREVIEW)throw new Error('Read-only preview. Run the PostgreSQL-backed application locally to use this action. No changes were saved.');
  const token=useSession.getState().token;
  let res:Response;
  try{res=await fetch(`${API_BASE}${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}});}catch{throw new Error('Cannot reach the NestJS API. Check your local API and PostgreSQL services, then retry.');}
  if(res.status===401&&retry&&!path.startsWith('/auth/')){await refreshSession();return api<T>(path,options,false);}
  const data=await res.json().catch(()=>({message:'Unexpected server response.'}));
  if(!res.ok)throw new Error(Array.isArray(data.message)?data.message.join(' '):data.message||'Request failed.');return data;
}
export const post=<T=any>(path:string,body:unknown={})=>api<T>(path,{method:'POST',body:JSON.stringify(body)});
export const money=(value:string|number,digits=2)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(value));
export function downloadCsv(filename:string,rows:Record<string,unknown>[]){if(!rows.length)return;const keys=Object.keys(rows[0]);const safe=(value:unknown)=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const csv=[keys.map(safe).join(','),...rows.map(row=>keys.map(k=>safe(row[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
