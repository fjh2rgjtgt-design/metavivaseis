/* Backup format 2026.11.07.1. ES5: also embedded in the Windows HTA. */
(function (root) {
  'use strict';
  var NAME = 'metavivaseis_backup_latest.json';
  var STAGE = NAME + '.pending', PREVIOUS = NAME + '.previous';
  function parse(text) {
    var d = JSON.parse(String(text).replace(/^\uFEFF/, ''));
    var sections = ['records', 'partners', 'generalExpenses', 'appointments', 'recurring', 'providers'];
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Invalid backup object');
    for (var i = 0; i < sections.length; i++) {
      if (!Array.isArray(d[sections[i]])) throw new Error('Missing backup section: ' + sections[i]);
    }
    for (i = 0; i < d.records.length; i++) {
      if (!d.records[i] || typeof d.records[i] !== 'object' || Array.isArray(d.records[i])) throw new Error('Invalid backup record');
    }
    if (!Object.prototype.hasOwnProperty.call(d, 'savedAt')) throw new Error('Missing savedAt');
    return d;
  }
  function verify(actual, expected) {
    var d = parse(actual);
    if (expected !== undefined && JSON.stringify(d) !== JSON.stringify(parse(expected))) throw new Error('Backup readback mismatch');
    return d;
  }
  function recover(io) {
    // A crash between renames leaves PREVIOUS intact. Never discard it unless latest is valid.
    if (io.exists(PREVIOUS)) {
      verify(io.read(PREVIOUS));
      var latestOK = false;
      try { if (io.exists(NAME)) { verify(io.read(NAME)); latestOK = true; } } catch (_) {}
      if (!latestOK) {
        if (io.exists(NAME)) io.remove(NAME);
        io.move(PREVIOUS, NAME);
        verify(io.read(NAME));
      } else io.remove(PREVIOUS);
    }
    if (io.exists(STAGE)) {
      if (io.exists(NAME)) { verify(io.read(NAME)); io.remove(STAGE); }
      else { verify(io.read(STAGE)); io.move(STAGE, NAME); verify(io.read(NAME)); }
    }
  }
  function save(io, text) {
    verify(text); // Never touch a previous backup for an incomplete input.
    recover(io);
    var hadPrevious = io.exists(NAME), old;
    if (hadPrevious) { old = io.read(NAME); verify(old); }
    try {
      io.write(STAGE, text);
      verify(io.read(STAGE), text);
      if (hadPrevious) io.move(NAME, PREVIOUS);
      io.move(STAGE, NAME);
      verify(io.read(NAME), text);
      if (io.exists(PREVIOUS)) io.remove(PREVIOUS);
    } catch (error) {
      // Restore only if the old name was moved. Keep recovery material if restoration itself fails.
      try {
        if (io.exists(PREVIOUS)) {
          verify(io.read(PREVIOUS), old);
          if (io.exists(NAME)) io.remove(NAME);
          io.move(PREVIOUS, NAME);
          verify(io.read(NAME), old);
        }
        if (io.exists(STAGE)) io.remove(STAGE);
      } catch (restoreError) {
        throw new Error(error.message + '; recovery required: ' + restoreError.message);
      }
      throw error;
    }
    return true;
  }
  var api = { name: NAME, parse: parse, verify: verify, recover: recover, save: save };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LatestBackup = api;
}(this));
