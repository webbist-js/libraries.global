// Run on the provisioning Mac with an explicit private runtime env path.
// The probe is outside BILLING_EVENTS: it cannot grant access or create a charge.
const fs = require('node:fs');
const {parseEnv} = require('node:util');
const {createHmac, randomUUID} = require('node:crypto');
const env = parseEnv(fs.readFileSync(process.argv[2], 'utf8'));
const url = env.APP_PUBLIC_URL + '/api/billing/webhook';
if(!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) throw Error('Missing signing secret');
async function probe(mode, signed, expected) {
  const payload = JSON.stringify({id:'evt_configuration_probe_' + randomUUID(), object:'event', type:'billing.configuration_probe', livemode:mode==='live', data:{object:{id:'configuration_probe'}}});
  const timestamp = Math.floor(Date.now()/1000);
  const digest = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(timestamp+'.'+payload).digest('hex');
  const response = await fetch(url,{method:'POST', headers:{'content-type':'application/json','stripe-signature':signed?`t=${timestamp},v1=${digest}`:'invalid'}, body:payload, redirect:'manual',signal:AbortSignal.timeout(15000)});
  const result = await response.json();
  if(response.status!==expected || (expected===200 && result.received!==true)) throw Error('Webhook probe failed: '+response.status);
  console.log(JSON.stringify({check:signed?(mode===env.BILLING_ENV?'signed correct mode':'signed wrong mode'):'invalid signature',status:response.status}));
}
(async()=>{
  await probe(env.BILLING_ENV,false,400);
  await probe(env.BILLING_ENV==='live'?'sandbox':'live',true,400);
  await probe(env.BILLING_ENV,true,200);
  const access = await fetch(env.APP_PUBLIC_URL+'/api/beta/access',{method:'POST',headers:{origin:env.APP_PUBLIC_URL,'content-type':'application/json'},body:JSON.stringify({password:env.BETA_PASSWORD}),signal:AbortSignal.timeout(15000)});
  const cookie = access.headers.get('set-cookie')?.split(';')[0];
  if(access.status!==200 || !cookie) throw Error('Beta acceptance access failed');
  const response = await fetch(env.APP_PUBLIC_URL+'/api/billing/prices',{headers:{cookie},signal:AbortSignal.timeout(15000)});
  const catalogue = await response.json();
  const expected = {pro:{month:500,year:5000},supporter:{month:300,year:3000}};
  if(response.status!==200 || !catalogue.available || catalogue.sandbox!==(env.BILLING_ENV==='sandbox') || catalogue.prices?.length!==4 || catalogue.prices.some(price=>price.currency!=='gbp' || price.unitAmount!==expected[price.plan]?.[price.interval])) throw Error('Deployed catalogue verification failed');
  console.log('Deployed billing catalogue: provider returned all four expected GBP prices in the configured mode.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
