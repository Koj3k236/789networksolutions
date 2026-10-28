const {readFileSync,writeFileSync,existsSync}=require('node:fs');
const {randomBytes}=require('node:crypto');
const {resolve}=require('node:path');
const root=resolve(__dirname,'..');
const envPath=resolve(root,'.env');
if(existsSync(envPath)) { console.error('Refusing to overwrite an existing .env. Existing secrets were not changed.'); process.exit(1); }
let template=readFileSync(resolve(root,'.env.example'),'utf8');
for(const name of ['JWT_SECRET','DATA_ENCRYPTION_KEY','SEED_ADMIN_PASSWORD','SEED_CUSTOMER_PASSWORD']) {
  template=template.replace(new RegExp(`^${name}=$`,'m'),`${name}=${randomBytes(32).toString('hex')}`);
}
writeFileSync(envPath,template,{mode:0o600,flag:'wx'});
const webPath=resolve(root,'web','.env.local');
if(!existsSync(webPath))writeFileSync(webPath,readFileSync(resolve(root,'web','.env.local.example')),{mode:0o600,flag:'wx'});
console.log('Created local environment files with unique random secrets. No secret values were printed. Configure your local PostgreSQL/Redis connection and protect these files.');
