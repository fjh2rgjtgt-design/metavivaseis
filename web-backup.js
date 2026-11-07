/* Browser picked-file adapter. Browser writable streams replace atomically on close. */
(function(root) {
  'use strict';
  async function save(handle, text) {
    root.LatestBackup.verify(text);
    var old = await (await handle.getFile()).text();
    // Empty is a newly picked file. Refuse to replace unrelated/malformed content.
    if (old) root.LatestBackup.verify(old);
    var writer, committed = false;
    try {
      writer = await handle.createWritable();
      await writer.write(text);
      await writer.close();
      committed = true;
      root.LatestBackup.verify(await (await handle.getFile()).text(), text);
    } catch (error) {
      try {
        if (writer && !committed && writer.abort) await writer.abort();
        // Some providers can throw after committing close: always compare/read back.
        var current = await (await handle.getFile()).text();
        if (current !== old) {
          var restore = await handle.createWritable();
          await restore.write(old);
          await restore.close();
          if (await (await handle.getFile()).text() !== old) throw new Error('Restore mismatch');
        }
      } catch (restoreError) {
        throw new Error(error.message + '; backup restoration failed: ' + restoreError.message);
      }
      throw error;
    }
  }
  root.savePickedBackup = save;
}(typeof globalThis === 'object' ? globalThis : this));
