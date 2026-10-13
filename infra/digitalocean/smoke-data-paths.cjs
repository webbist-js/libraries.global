// Run in the CMS image with the UI runtime env and a mounted public icon fixture.
// Supply STRAPI_MAINTENANCE_API_TOKEN separately for cleanup; the frontend's
// upload credential deliberately cannot delete media. Never expand its access.
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {Client}=require('pg');
const identity='deployment-smoke-'+randomUUID();
const email=identity+'@example.invalid';
const db=new Client({connectionString:process.env.DATABASE_URL});
const headers={host:'libraries.global','x-forwarded-host':'libraries.global','x-forwarded-proto':'https','x-forwarded-for':'192.0.2.88'};
const mediaHeaders={Authorization:'Bearer '+process.env.STRAPI_UPLOAD_API_KEY,'X-Service-Secret':process.env.STRAPI_BRIDGE_SECRET};
const cleanupHeaders={...mediaHeaders,Authorization:'Bearer '+process.env.STRAPI_MAINTENANCE_API_TOKEN};
let uploaded=[];
let connected=false;
async function main() {
  if(!process.env.STRAPI_MAINTENANCE_API_TOKEN) throw Error('A separate maintenance credential is required before creating fixtures');
  await db.connect();
  connected=true;
  const waitlist=await fetch('http://127.0.0.1:3000/api/beta/waitlist',{method:'POST',headers:{...headers,origin:'https://libraries.global','content-type':'application/json'},body:JSON.stringify({email,locale:'en'})});
  if(waitlist.status!==200) throw Error('Waitlist persistence request returned '+waitlist.status);
  const stored=await db.query('SELECT type,state,consented_at FROM subscribers WHERE email=$1',[email]);
  if(stored.rows.length!==1 || stored.rows[0].type!=='beta_waitlist' || stored.rows[0].state!=='active' || !stored.rows[0].consented_at) throw Error('Waitlist consent was not stored correctly');
  console.log('Live waitlist path: consent persisted through Next.js and the private CMS; no newsletter or email triggered.');
  const form=new FormData();
  form.set('files',new Blob([fs.readFileSync('./public/apple-touch-icon.png')],{type:'image/png'}),identity+'.png');
  const upload=await fetch('http://127.0.0.1:1337/api/upload',{method:'POST',headers:mediaHeaders,body:form,signal:AbortSignal.timeout(60000)});
  if(upload.status!==201 && upload.status!==200) throw Error('CMS upload returned '+upload.status);
  uploaded=await upload.json();
  if(!Array.isArray(uploaded) || uploaded.length!==1 || uploaded[0].name!==identity+'.png') throw Error('Unexpected upload fixture response');
  const item=uploaded[0];
  if(item.provider!=='aws-s3' || !item.url.startsWith('https://libraries-global-production-media.lon1.cdn.digitaloceanspaces.com/')) throw Error('Upload provider/CDN mismatch');
  const media=await fetch(item.url,{headers:{Range:'bytes=0-0'}});
  if(media.status!==206) throw Error('Uploaded image failed CDN range verification');
  await media.arrayBuffer();
  console.log('Production CMS upload: image processing, Spaces provider and CDN byte range passed.');
}
async function cleanup() {
  if(!connected) return;
  for(const item of uploaded) {
    if(item.name!==identity+'.png') throw Error('Refusing to remove unrelated media');
    const response=await fetch('http://127.0.0.1:1337/api/upload/files/'+item.id,{method:'DELETE',headers:cleanupHeaders});
    if(!response.ok) throw Error('Upload fixture cleanup returned '+response.status);
  }
  await db.query("DELETE FROM subscribers WHERE email=$1 AND type='beta_waitlist'",[email]);
  console.log('Owned waitlist/upload fixtures removed.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
  try { await cleanup(); }
  catch(error) { console.error(error.message); process.exitCode=1; }
  finally { await db.end(); }
});
