"""Patch a private live HTA without committing its embedded legacy customer seed.

Usage: python3 scripts/patch-hta.py INPUT.hta OUTPUT.hta
Exact anchors fail closed on unrecognized/newer source. No customer data is read
or embedded by this script: the caller supplies its own private artifact.
"""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
s = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig')
def replace(old, new):
    global s
    if s.count(old) != 1:
        raise SystemExit('Source mismatch at: ' + old[:70])
    s = s.replace(old, new)

engine = (root / 'latest-backup.js').read_text()
adapter = '''
function backupIO() {
  return {
    exists: existsU, read: readU, write: writeU,
    move: function(a,b) { fso().MoveFile(dataDir()+a, dataDir()+b); },
    remove: function(n) { fso().DeleteFile(dataDir()+n, true); }
  };
}
function saveLatestBackup(t) { return LatestBackup.save(backupIO(), t); }
'''
replace('function persist() {', engine + adapter + '\nfunction persist() {')
replace('BAKF = "metavivaseis_data.backup.json"', 'BAKF = "metavivaseis_backup_latest.json"')
replace('if (existsU(DATAF)) writeU(BAKF, readU(DATAF));writeU(DATAF, t);',
        'saveLatestBackup(t);writeU(DATAF, t);')
replace('showErr("Αποτυχία αποθήκευσης στο " + dataDir() + DATAF + ": " + (e.message || e));',
        'showErr("Αποτυχία αποθήκευσης/backup στο " + dataDir() + DATAF + ": " + (e.message || e));return false;')
replace('okMsg("✔ Αποθηκεύτηκε " + new Date().toLocaleTimeString("el-GR"));',
        'okMsg("✔ Αποθηκεύτηκε " + new Date().toLocaleTimeString("el-GR"));return true;')
replace('function mvSafetyAll(){if(!mvSafety()){try{writeU("metavivaseis_prev_backup_"+new Date().getTime()+".json",JSON.stringify({savedAt:new Date().toISOString(),db:db}))}catch(e){}}}',
        'function mvSafetyAll(){saveLatestBackup(JSON.stringify(db,null,2));return true;}')
replace('function mvSyncExport(){download("metavivaseis_backup_"+today()+".json",JSON.stringify(db,null,2))}',
        'function mvSyncExport(){try{saveLatestBackup(JSON.stringify(db,null,2));okMsg("✔ Backup: "+LatestBackup.name);return true;}catch(e){showErr("Αποτυχία backup: "+e.message);return false;}}')
replace('mvSafetyAll();mvApply(d, p);migrate();persist();fillSelects();render();alert(mvDoneText(p));',
        'try{mvSafetyAll();}catch(e){showErr("Η εισαγωγή ακυρώθηκε: αποτυχία backup: "+e.message);return;}mvApply(d, p);migrate();if(!persist())return;fillSelects();render();alert(mvDoneText(p));')
replace('function load() {', 'function load() {\n  try{LatestBackup.recover(backupIO());}catch(e){alert(\"Αποτυχία ανάκτησης backup: \"+e.message);throw e;}')
# One feature release marker; do not alter existing unrelated product labels.
replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="backup-version" content="2026.11.07.1">')
pathlib.Path(sys.argv[2]).write_text('\ufeff' + s, encoding='utf-8')
