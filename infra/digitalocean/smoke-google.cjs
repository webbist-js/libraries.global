// Run inside the UI container. Do not print OAuth state, cookies or credentials.
const base = process.env.SMOKE_UI_ORIGIN ?? 'http://127.0.0.1:3000';
const headers = {host:'libraries.global','x-forwarded-host':'libraries.global','x-forwarded-proto':'https','x-forwarded-for':'192.0.2.78'};

async function main() {
  const access = await fetch(base+'/api/beta/access', {
    method:'POST', headers:{...headers,origin:'https://libraries.global','content-type':'application/json'},
    body:JSON.stringify({password:process.env.BETA_PASSWORD}),
  });
  if(access.status !== 200) throw Error('Beta access failed: '+access.status);
  const cookie = access.headers.get('set-cookie')?.split(';')[0];
  if(!cookie) throw Error('Beta cookie missing');
  const response = await fetch(base+'/api/auth/sign-in/social', {
    method:'POST', redirect:'manual',
    headers:{...headers,cookie,origin:'https://libraries.global','content-type':'application/json'},
    body:JSON.stringify({provider:'google',callbackURL:'https://libraries.global/auth/post-signin',disableRedirect:true}),
  });
  if(response.status !== 200) throw Error('Google sign-in initialization failed: '+response.status);
  const result = await response.json();
  const authorization = new URL(result.url);
  if(authorization.protocol !== 'https:' || authorization.hostname !== 'accounts.google.com') throw Error('Unexpected authorization destination');
  if(authorization.searchParams.get('client_id') !== process.env.GOOGLE_CLIENT_ID) throw Error('Google client ID mismatch');
  if(authorization.searchParams.get('redirect_uri') !== 'https://libraries.global/api/auth/callback/google') throw Error('Google callback mismatch');
  const scopes = authorization.searchParams.get('scope')?.split(/\s+/).sort();
  if(JSON.stringify(scopes) !== JSON.stringify(['email','openid','profile'])) throw Error('Unexpected Google scopes');
  if(!authorization.searchParams.get('state')) throw Error('OAuth state missing');
  console.log('Google sign-in initialization passed: production client, exact HTTPS callback, openid/email/profile scopes and OAuth state. Account consent and callback acceptance remain for the owner.');
}

main().catch(error => { console.error(error.message);process.exitCode=1; });
