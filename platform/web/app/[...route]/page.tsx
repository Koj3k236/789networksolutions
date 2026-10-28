import {PortalPage} from '@/components/portal';
import {AdminPage} from '@/components/admin';
import {AuthPage} from '@/components/auth';
import {PublicPage} from '@/components/public';
export function generateStaticParams(){return ['dashboard','dashboard/trunks','dashboard/numbers','dashboard/calls','dashboard/live','dashboard/billing','dashboard/rates','dashboard/developers','dashboard/webhooks','dashboard/settings','admin','admin/customers','admin/verification','admin/carriers','admin/audit','login','register','forgot-password','verify-email','reset-password','company','about','sip-trunking','wholesale-voice','outbound-termination','inbound-origination','local-did','toll-free','voice-api','pricing','coverage','network-infrastructure','developers','api-documentation','contact','terms','privacy','aup'].map(path=>({route:path.split('/')}));}
export const dynamicParams=false;
export default async function Page({params}:{params:Promise<{route:string[]}>}){const {route}=await params;const [first,section]=route;if(first==='dashboard')return <PortalPage section={section}/>;if(first==='admin')return <AdminPage section={section}/>;if(['login','register','forgot-password','verify-email','reset-password'].includes(first))return <AuthPage mode={first}/>;return <PublicPage page={first}/>;}
