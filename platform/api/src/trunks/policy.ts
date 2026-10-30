import ipaddr from 'ipaddr.js';
import {createHash, randomBytes} from 'node:crypto';
import {encrypt} from '../common/crypto';
const reserved4=['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.0.2.0/24','192.168.0.0/16','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/4','240.0.0.0/4'];
const reserved6=['::/96','::ffff:0:0/96','64:ff9b::/96','100::/64','2001:db8::/32','2002::/16','fc00::/7','fe80::/10','ff00::/8'];
export function normalizePublicCidr(value:string):string {
  if(typeof value!=='string'||value.length>80||/[\s%]/.test(value))throw new Error('Enter a public IPv4/IPv6 address or CIDR without whitespace.');
  const [addr,prefix]=ipaddr.parseCIDR(value.includes('/')?value:`${value}/${value.includes(':')?128:32}`);
  const ipv4=addr.kind()==='ipv4';
  if(addr.range()!=='unicast'||prefix<(ipv4?8:32))throw new Error('Only public networks are allowed; minimum prefix is /8 for IPv4 or /32 for IPv6.');
  const reserved=ipv4?reserved4:reserved6;
  for(const subnet of reserved){const [blocked,bits]=ipaddr.parseCIDR(subnet);if((addr as any).match(blocked,Math.min(prefix,bits)))throw new Error('The network overlaps a private, reserved, or special-purpose range.');}
  const bytes=addr.toByteArray().map((byte,i)=>{const bits=Math.max(0,Math.min(8,prefix-i*8));return byte & (bits?256-(1<<(8-bits)):0);});
  return `${ipaddr.fromByteArray(bytes).toString()}/${prefix}`;
}
export function validateSipHost(host:string){
  if(host.length>253||! /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(host))throw new Error('Use a SIP hostname, not a URL, userinfo, or port.');
  return host.toLowerCase();
}
export function generateSipCredential(realm:string,existingUsername?:string){
  const username=existingUsername||`789_${randomBytes(12).toString('hex')}`;
  const password=randomBytes(32).toString('base64url');
  const ha1=createHash('sha256').update(`${username}:${realm}:${password}`).digest('hex');
  return {persisted:{username,realm,algorithm:'SHA-256',digestEncrypted:encrypt(ha1),rotatedAt:new Date()},reveal:{username,password,realm,algorithm:'SHA-256',oneTime:true}};
}
export function validateTrunkLimits(concurrent:number,cps:number,accountConcurrent:number,accountCps:number){
  if(!Number.isInteger(concurrent)||!Number.isInteger(cps)||concurrent<1||cps<1||concurrent>accountConcurrent||cps>accountCps)throw new Error('Trunk limits must be positive integers within the customer account caps.');
}
