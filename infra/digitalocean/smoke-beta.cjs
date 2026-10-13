// Run in the UI container. Never print the beta password or returned cookie.
const base=process.env.SMOKE_UI_ORIGIN ?? 'http://127.0.0.1:3000';
const headers={host:'libraries.global','x-forwarded-host':'libraries.global','x-forwarded-proto':'https','x-forwarded-for':'192.0.2.77'};
async function check(path,status,options={}) {
  const response=await fetch(base+path,{redirect:'manual',...options,headers:{...headers,...options.headers}});
  if(response.status!==status) throw Error(path+': expected '+status+', received '+response.status);
  return response;
}
async function access(password,origin='https://libraries.global') {
  return fetch(base+'/api/beta/access',{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:JSON.stringify({password})});
}
async function main() {
  const page=await check('/beta',200);
  if(!page.headers.get('x-robots-tag')?.includes('noindex')) throw Error('Missing beta noindex');
  for(const path of ['/beta','/cs/beta','/fr/beta']) {
    const html=await (await check(path,200)).text();
    if(/<button\b[^>]*data-feedback-trigger/i.test(html)) throw Error(path+': feedback button is visible');
    if(!html.includes('href="mailto:info@libraries.global"') || /hello@libraries\.global/i.test(html)) throw Error(path+': incorrect contact address');
  }
  await check('/',307);
  await check('/cs',307);
  await check('/api/auth/get-session',401);
  if((await access('incorrect-smoke-password')).status!==401) throw Error('Invalid beta password was not rejected');
  if((await access(process.env.BETA_PASSWORD,'https://other.example')).status!==403) throw Error('Cross-origin beta request was not rejected');
  const accepted=await access(process.env.BETA_PASSWORD);
  if(accepted.status!==200) throw Error('Production beta access failed: '+accepted.status);
  const cookie=accepted.headers.get('set-cookie');
  if(!cookie?.includes('HttpOnly') || !cookie.includes('Secure')) throw Error('Missing production cookie protections');
  await check('/api/auth/get-session',200,{headers:{cookie:cookie.split(';')[0]}});
  await check('/api/beta/waitlist',400,{method:'POST',headers:{origin:'https://libraries.global','content-type':'application/json'},body:JSON.stringify({email:'invalid'})});
  console.log('Beta checks passed: EN/CS/FR entrance has no feedback button and uses info@libraries.global; noindex, root/localized gate, protected API, database-backed password check, secure cookie, origin rejection and waitlist validation.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
