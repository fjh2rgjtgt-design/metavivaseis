# Verified single latest backup — 2026.11.07.1

## Windows HTA (primary application)

The installed HTA is a separate customized artifact, not the web `index.html`.
It contains a legacy embedded customer seed: **do not add that artifact or its
input/output to Git**. Patch a privately downloaded copy with:

```
python3 scripts/patch-hta.py /private/Metavivaseis.hta /private/patched.hta
node scripts/check-private-hta.js /private/patched.hta
node --test tests/*.test.js
```

The patcher requires every exact legacy anchor once and refuses unknown source.
Keep a private code rollback artifact outside the application's data backups;
check the live source hash again immediately before deploying the patched HTA.
Do not replace the installed HTA with the web index. Restart the HTA after update.

Save, sync export and import safety now use `metavivaseis_backup_latest.json`.
All six dataset collections, savedAt and unknown settings are preserved. Input
and staged readback must parse and equal the entire expected dataset before
promotion. A fixed `.pending` stage and `.previous` recovery journal protect
replacement: old backup is renamed, never overwritten; final readback must pass
before journal deletion. Failure restores the previous file; if restoration is
blocked, recovery material is kept and the operation reports failure. Startup
recovers interrupted transactions and fails closed if recovery cannot complete.
Successful operations leave only the stable backup. Transient recovery files
must not be deleted manually. This does not prune old backups or other files.

A save protects the full new state before writing canonical data; an export
captures current memory; import safety captures pre-import memory. Failed backup
prevents a canonical write/import mutation. A canonical write failure still leaves
a validated full new-state backup available for explicit recovery. No claim of
filesystem durability beyond Windows/OneDrive's own guarantees is made. Only one
HTA process should write the configured data folder (the existing HTA is single
instance); do not run automation imports concurrently with interactive edits.

## Browser variant

Exports suggest the same stable name; picked files use browser transactional
writable streams plus full readback comparison, restoring original bytes on
reported write/close/readback failure. Local import safety uses one stable
localStorage key and verifies readback, aborting import if protection fails.
A browser download/share cannot inspect or prune the OS destination and may be
renamed `(1)` by the browser. For strict on-disk retention use the HTA, not repeated
unmanaged downloads. A browser/process crash after picked-file close but before
readback cannot offer the HTA's rename-journal guarantee. Browser backup failures
are surfaced; downloading a separate copy is never claimed as verified overwrite.

## Ongoing automation

Write complete current canonical JSON to a fixed staging candidate, verify exact
remote readback, promote to the stable latest name, and preserve the former valid
backup until successful verification. Never wildcard-delete unrelated files.
Generated customer PDFs/DOCX/invoices/scans belong in the separate OneDrive root
folder `Έγγραφα Μεταβιβάσεων`, not the runtime/config/state directory. This code
change does not edit routines or customer data.
