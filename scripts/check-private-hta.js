// Optional private artifact integration check. No artifact or dataset is committed.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const backup=require('../latest-backup');
const html=fs.readFileSync(process.argv[2],'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach(s=>new vm.Script(s));
function extract(name){
 const s=scripts.join('\n'), start=s.indexOf('function '+name+'(');
 assert.ok(start>=0,name);
 // These narrowly scoped functions do not contain braces in string literals.
 const begin=s.indexOf('{',start);let depth=1,end=begin+1;
 for(;depth&&end<s.length;end++){if(s[end]==='{')depth++;if(s[end]==='}')depth--;}
 return s.slice(start,end);
}
const synthetic={records:[{id:'test'}],partners:[],generalExpenses:[{id:'expense'}],appointments:[{id:'appt'}],recurring:[],providers:[],savedAt:1};
const old=JSON.stringify({...synthetic,savedAt:0});let files={},fail=false,oks=[],errors=[];
const c={db:synthetic,LatestBackup:backup,Date,JSON,DATAF:'metavivaseis_data.json',JSF:'metavivaseis_data.js',
 dataDir:()=>'',existsU:n=>Object.hasOwn(files,n),readU:n=>{if(!Object.hasOwn(files,n))throw Error('Missing');return files[n];},
 writeU:(n,t)=>{if(fail&&n.endsWith('.pending'))throw Error('Full');files[n]=t;},okMsg:m=>oks.push(m),showErr:m=>errors.push(m),
 fso:()=>({MoveFile(a,b){assert.ok(!Object.hasOwn(files,b));files[b]=files[a];delete files[a];},DeleteFile(n){delete files[n];}})};
vm.createContext(c);
vm.runInContext(['backupIO','saveLatestBackup','persist','mvSafetyAll','mvSyncExport'].map(extract).join('\n'),c);
files[c.DATAF]=old;files[backup.name]=old;
assert.equal(c.persist(),true);backup.verify(files[c.DATAF],files[backup.name]);assert.equal(oks.length,1);
for(let i=0;i<5;i++){assert.equal(c.mvSyncExport(),true);c.mvSafetyAll();assert.equal(c.persist(),true);}
assert.deepEqual(Object.keys(files).sort(),[c.DATAF,c.JSF,backup.name].sort());
const prior=files[backup.name], canonical=files[c.DATAF], okCount=oks.length;fail=true;
assert.equal(c.persist(),false);assert.equal(files[c.DATAF],canonical);assert.equal(files[backup.name],prior);assert.equal(oks.length,okCount);
assert.equal(c.mvSyncExport(),false);assert.throws(()=>c.mvSafetyAll());assert.ok(errors.length>=2);
for(const forbidden of ['metavivaseis_data.backup.json','metavivaseis_prev_backup_','"metavivaseis_backup_"+today()'])assert.ok(!html.includes(forbidden));
console.log('Private HTA syntax + save/export/safety integration: PASS (synthetic data only)');
