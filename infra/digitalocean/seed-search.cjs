// Run inside the CMS image against freshly provisioned general search indexes.
// Page both source reads and writes; use the application's allowlisted transforms.
const plugins = require('/app/dist/config/plugins.js').default;
const env = (key, fallback) => process.env[key] ?? fallback;
env.array = (key, fallback = []) => process.env[key]?.split(',') ?? fallback;
env.bool = (key, fallback = false) => process.env[key] ? process.env[key] === 'true' : fallback;
env.int = (key, fallback = 0) => process.env[key] ? Number(process.env[key]) : fallback;
env.json = (key, fallback = {}) => process.env[key] ? JSON.parse(process.env[key]) : fallback;
const config = plugins({env}).meilisearch.config;
const source = 'http://127.0.0.1:1337';
// Events use the events plugin and sync worker, not a generic /api/events route.
const collections = {library:'libraries','blog-article':'blog-articles','wiki-article':'wiki-articles'};
async function cms(route) {
  const response = await fetch(source+route,{headers:{Authorization:'Bearer '+process.env.STRAPI_API_TOKEN,'X-Service-Secret':process.env.STRAPI_BRIDGE_SECRET},signal:AbortSignal.timeout(60000)});
  if(response.status===404 && route.startsWith('/api/mobile/')) return null;
  if(!response.ok) throw Error('CMS '+route.split('?')[0]+' returned '+response.status);
  return response.json();
}
async function meili(route, method='GET', body) {
  const response = await fetch(process.env.MEILISEARCH_HOST+route,{method,headers:{Authorization:'Bearer '+process.env.MEILISEARCH_ADMIN_API_KEY,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
  if(response.status===404) return null;
  if(!response.ok) throw Error('Search '+method+' '+route+' returned '+response.status);
  return response.json();
}
async function wait(uid) {
  for(;;) {
    const task=await meili('/tasks/'+uid);
    if(task.status==='succeeded') return;
    if(['failed','canceled'].includes(task.status)) throw Error('Search task failed: '+task.error?.code);
    await new Promise(resolve=>setTimeout(resolve,500));
  }
}
function append(params,prefix,value) {
  if(value && typeof value==='object') for(const [key,child] of Object.entries(value)) append(params,`${prefix}[${key}]`,child);
  else if(value!==undefined && value!==null) params.set(prefix,String(value));
}
async function main() {
  for(const [name,collection] of Object.entries(collections)) {
    const index=config[name];
    const stats=await meili(`/indexes/${name}/stats`);
    if(stats?.numberOfDocuments) throw Error(name+' already has documents; refusing a destructive reseed');
    if(!stats) await wait((await meili('/indexes','POST',{uid:name,primaryKey:'_meilisearch_id'})).taskUid);
    await wait((await meili(`/indexes/${name}/settings`,'PATCH',index.settings)).taskUid);
    let total=0;
    for(let page=1;;page++) {
      const params=new URLSearchParams({'pagination[page]':String(page),'pagination[pageSize]':'100',status:'published','sort[0]':'documentId:asc'});
      for(const [key,value] of Object.entries(index.entriesQuery)) append(params,key,value);
      const json=await cms(`/api/${collection}?${params}`);
      const entries=json.data ?? [];
      const notices=new Map();
      if(name==='library' && entries.length) {
        const ids=[...new Set(entries.map(entry=>entry.documentId))];
        const response=await cms('/api/library-notices/for-libraries?ids='+encodeURIComponent(ids.join(',')));
        for(const [id,rows] of Object.entries(response.data ?? {})) notices.set(id,rows);
        for(const entry of entries) if(entry.libraryType==='Mobile') {
          const mobile=await cms(`/api/mobile/${entry.documentId}/timetable`);
          entry.mobileTimetable=mobile?.timetable ?? null;
        }
      }
      const documents=[];
      for(const entry of entries) {
        if(!entry.locale) throw Error(name+' source entry lacks locale');
        const document=await index.transformEntry({entry,...(name==='library'?{notices:notices.get(entry.documentId) ?? []}:{})});
        document._meilisearch_id=`${name}-${entry.documentId}${entry.locale?'-'+entry.locale:''}`;
        documents.push(document);
      }
      if(documents.length) await wait((await meili(`/indexes/${name}/documents`,'PUT',documents)).taskUid);
      total+=documents.length;
      if(page%50===0) console.log(name+': '+total+' published documents indexed');
      if(page>=json.meta.pagination.pageCount) break;
    }
    const final=await meili(`/indexes/${name}/stats`);
    if(final.numberOfDocuments!==total) throw Error(name+' indexed count mismatch');
    console.log(name+': verified '+total+' published documents');
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
