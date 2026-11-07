'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const cp = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const backup = require('../latest-backup');
const N = backup.name, P = N + '.pending', R = N + '.previous';
function data(n = 1) { return JSON.stringify({records:[{id:'synthetic-'+n}],partners:['Example'],generalExpenses:[{id:'expense'}],appointments:[{id:'appointment'}],recurring:[{id:'recurring'}],providers:[{name:'Example'}],savedAt:n,extra:{preserve:true}}); }
function disk(initial = {}, fail = () => {}) {
  const files = {...initial};
  return {files, exists:n=>Object.hasOwn(files,n), read(n){fail('read',n,files); if(!Object.hasOwn(files,n))throw Error('Missing '+n);return files[n];},
    write(n,t){fail('write',n,files);files[n]=t;},move(a,b){fail('move',a,files,b);if(Object.hasOwn(files,b))throw Error('Target exists');files[b]=files[a];delete files[a];},remove(n){fail('remove',n,files);delete files[n];}};
}
test('repeated saves keep only one complete latest snapshot, including unknown sections',()=>{
 const d=disk();for(let i=0;i<20;i++)backup.save(d,data(i));assert.deepEqual(Object.keys(d.files),[N]);assert.equal(d.files[N],data(19));
});
test('malformed/missing sections rejected without touching prior',()=>{
 for(const bad of ['{', '{}',data().replace('"records":[{','"records":[null,{'),JSON.stringify({records:[]})]){
  const d=disk({[N]:data()});assert.throws(()=>backup.save(d,bad));assert.equal(d.files[N],data());
 }
});
test('valid but truncated dataset readback rejected and old preserved',()=>{
 const d=disk({[N]:data()},(op,n,f)=>{if(op==='read'&&n===P)f[n]=data(0);});
 assert.throws(()=>backup.save(d,data(2)),/mismatch/);assert.equal(d.files[N],data());assert.deepEqual(Object.keys(d.files),[N]);
});
for(const [label,op,name] of [['stage write','write',P],['stage read','read',P],['first rename','move',N],['second rename','move',P],['latest readback','read',N]]){
 test(label+' failure preserves old backup',()=>{
  let triggered=false, staged=false;
  const d=disk({[N]:data()},(o,n,f)=>{
    if(o==='write'&&n===P)staged=true;
    if(!triggered&&o===op&&n===name&&(name!==N||op!=='read'||Object.hasOwn(f,R))){triggered=true;throw Error('Injected '+label);}
  });
  assert.throws(()=>backup.save(d,data(2)));assert.equal(d.files[N],data());assert.equal(d.files[R],undefined);
 });
}
test('corrupt promoted backup is rolled back',()=>{
 let corrupt=true;
 const d=disk({[N]:data()},(op,n,f)=>{if(op==='read'&&n===N&&f[R]&&corrupt){f[n]='{';corrupt=false;}});
 assert.throws(()=>backup.save(d,data(2)));assert.equal(d.files[N],data());
});
test('crash recovery restores previous during rename gap',()=>{
 const d=disk({[R]:data(),[P]:data(2)});backup.recover(d);assert.deepEqual(d.files,{[N]:data()});
});
test('crash after promotion keeps valid latest and cleans journal',()=>{
 const d=disk({[R]:data(),[N]:data(2)});backup.recover(d);assert.deepEqual(d.files,{[N]:data(2)});
});
test('failed rollback retains recovery material; next startup recovers',()=>{
 let stuck=true;
 const d=disk({[N]:data()},(op,n,f)=>{if(stuck&&op==='move'&&(n===P||n===R))throw Error('Locked');});
 assert.throws(()=>backup.save(d,data(2)),/recovery required/);assert.equal(d.files[R],data());stuck=false;backup.recover(d);assert.equal(d.files[N],data());
});
function htaContext(){
 // The patcher accepts a synthetic source with exact legacy anchors; no customer artifact in tests.
 const patch=fs.readFileSync('scripts/patch-hta.py','utf8');
 const anchors=[...patch.matchAll(/replace\('([^'\n]*(?:\\.[^'\n]*)*)',/g)].map(m=>m[1]);
 const source=anchors.map(s=>s.replace(/\\n/g,'\n').replace(/\\"/g,'"')).join('\n');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backup-hta-'));
 const input=path.join(dir,'source.hta'),output=path.join(dir,'patched.hta');fs.writeFileSync(input,source);
 cp.execFileSync('python3',['scripts/patch-hta.py',input,output]);
 const text=fs.readFileSync(output,'utf8');fs.rmSync(dir,{recursive:true});
 return text;
}
test('patch builder fails closed on unrelated source',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backup-hta-'));fs.writeFileSync(path.join(dir,'in'),'other');assert.throws(()=>cp.execFileSync('python3',['scripts/patch-hta.py',path.join(dir,'in'),path.join(dir,'out')],{stdio:'pipe'}));fs.rmSync(dir,{recursive:true});
});
test('patch builder synthetic integration covers save, export, safety and no accumulating names',()=>{
 const s=htaContext();assert.ok(s.includes('saveLatestBackup(t);writeU(DATAF, t)'));assert.ok(s.includes('if(!persist())return;'));
 for(const old of ['metavivaseis_data.backup.json','metavivaseis_prev_backup_','"metavivaseis_backup_"+today()'])assert.ok(!s.includes(old));
 const safety=s.match(/function mvSafetyAll\(\)\{[^\n]+/)[0];
 const exportFn=s.match(/function mvSyncExport\(\)\{[^\n]+/)[0];
 const d=disk({[N]:data()});const c={db:JSON.parse(data(2)),saveLatestBackup:t=>backup.save(d,t),okMsg:()=>{},showErr:()=>{},LatestBackup:backup};
 vm.createContext(c);vm.runInContext(safety+'\n'+exportFn,c);c.mvSafetyAll();assert.equal(d.files[N],JSON.stringify(c.db,null,2));assert.equal(c.mvSyncExport(),true);assert.deepEqual(Object.keys(d.files),[N]);
 c.saveLatestBackup=()=>{throw Error('disk full')};assert.throws(()=>c.mvSafetyAll());assert.equal(c.mvSyncExport(),false);
});
test('web uses stable backup name and guards import against unprotected changes',()=>{
 const s=fs.readFileSync('index.html','utf8');assert.ok(s.includes('function bkName(){return "'+N+'"}'));assert.ok(s.includes('if(!mvSafety())throw new Error'));assert.ok(!s.includes('metavivaseis_backup_"+new Date'));
});
function picked(initial, mode) {
 let value=initial, once=true;
 return {get value(){return value;},async getFile(){return{text:async()=>value};},async createWritable(){let pending;return{async write(t){if(mode==='write'&&once){once=false;throw Error('write');}pending=t;},async close(){if(mode==='truncate'&&once){once=false;value='{';}else if(mode==='close'&&once){once=false;throw Error('close');}else value=pending;},async abort(){}};}};
}
const wc={LatestBackup:backup};vm.createContext(wc);vm.runInContext(fs.readFileSync('web-backup.js','utf8'),wc);
test('browser picked file readback and preservation on write,close,truncation failures',async()=>{
 for(const mode of ['write','close','truncate']){const h=picked(data(),mode);await assert.rejects(wc.savePickedBackup(h,data(2)));assert.equal(h.value,data());}
 const h=picked(data());await wc.savePickedBackup(h,data(2));assert.equal(h.value,data(2));
});
test('first-ever backup crash keeps a validated stage instead of discarding the only snapshot',()=>{
 const d=disk({[P]:data(2)});backup.recover(d);assert.deepEqual(d.files,{[N]:data(2)});
 const bad=disk({[P]:'{'});assert.throws(()=>backup.recover(bad));assert.equal(bad.files[P],'{');
});
test('embedded browser modules exactly match their tested source',()=>{
 const s=fs.readFileSync('index.html','utf8');for(const p of ['latest-backup.js','web-backup.js'])assert.ok(s.includes(fs.readFileSync(p,'utf8')));
});
