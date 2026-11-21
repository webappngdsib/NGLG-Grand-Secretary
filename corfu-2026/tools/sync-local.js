#!/usr/bin/env node
// Συγχρονισμός Κέρκυρας χωρίς Apps Script: τρέχει τους ΙΔΙΟΥΣ κανόνες του corfu-2026/Code.gs
// (extractDeclarations_ + συγχώνευση του syncCorfu2026) πάνω σε email που έχουν ήδη διαβαστεί από το Gmail,
// και ενημερώνει το corfu-2026/attendees.json.
//
// Χρήση:  node corfu-2026/tools/sync-local.js <messages.json> [--dry-run]
// messages.json (ΜΗΝ το βάζετε στο αποθετήριο — περιέχει κείμενα email):
//   [{ "subject": "...", "from": "Όνομα <a@b.gr>", "cc": "x@y.gr", "body": "απλό κείμενο", "date": "2026-11-20T20:29:05Z" }, ...]
// Μόνο τα μηνύματα που ταιριάζουν στο CFG.query του Code.gs (θέμα ΜΕΤΑΚΙΝΗΣΗ / ΔΙΑΜΟΝΗ / ΚΕΡΚΥΡΑ, από 1/11/2026).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const DIR = path.join(__dirname, '..');
const [input, ...flags] = process.argv.slice(2);
if (!input) { console.error('Χρήση: node corfu-2026/tools/sync-local.js <messages.json> [--dry-run]'); process.exit(2); }
const dry = flags.includes('--dry-run');
const messages = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(messages)) throw Error('Το messages.json πρέπει να είναι πίνακας μηνυμάτων');

const pad = (n) => String(n).padStart(2, '0');
const athensDate = (d) => { // yyyy-MM-dd σε ώρα Ελλάδας (όπως Utilities.formatDate(..., 'Europe/Athens', ...))
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const msgObjs = messages.map((m) => ({
  getSubject: () => m.subject || '', getFrom: () => m.from || '', getCc: () => m.cc || '',
  getPlainBody: () => m.body || '', getDate: () => new Date(m.date),
}));
const sandbox = {
  console, Map, Set, Date, JSON, String, Number, Array, Object, Error, RegExp,
  GmailApp: { search: (q, start) => (start ? [] : [{ getMessages: () => msgObjs }]) },
  Utilities: { formatDate: (d) => athensDate(d) },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8') + '\n;this.__extract = extractDeclarations_; this.__key = key_; this.__known = knownByEmail_; this.__notes = mergeNotes_;', sandbox);
const extract = sandbox.__extract, key = sandbox.__key, knownByEmail = sandbox.__known, mergeNotes = sandbox.__notes;

// Συγχώνευση — ίδια λογική με το syncCorfu2026() του Code.gs
const file = path.join(DIR, 'attendees.json');
const old = JSON.parse(fs.readFileSync(file, 'utf8'));
const existing = new Map((old.attendees || []).map((x) => [key(x.name), x]));
const extracted = extract(knownByEmail(old.attendees));
if (!extracted.length && (old.attendees || []).length) { console.error('Καμία δήλωση στα μηνύματα· η λίστα μένει ως έχει.'); process.exit(1); }
const attendees = extracted.map((x) => {
  const prior = existing.get(key(x.name));
  if (!prior) return x;
  const lock = Object.fromEntries((prior.locked || []).map((f) => [f, prior[f]]));
  return { ...x, email: x.email || prior.email || '', comments: x.correction ? x.comments : mergeNotes(prior.comments, x.comments),
    hotel_status: prior.hotel_status === 'Επιβεβαιωμένη κράτηση' ? 'Επιβεβαιωμένη κράτηση' : x.hotel_status , ...lock, ...(prior.locked ? { locked: prior.locked } : {}) };
});
for (const a of attendees) delete a.correction;
for (const prev of old.attendees || []) if (!attendees.some((x) => key(x.name) === key(prev.name))) attendees.push(prev);
attendees.sort((a, b) => a.name.localeCompare(b.name, 'el'));

const before = new Set((old.attendees || []).map((x) => key(x.name)));
const added = attendees.filter((x) => !before.has(key(x.name))).map((x) => x.name);
const changed = attendees.filter((x) => { const p = existing.get(key(x.name)); return p && JSON.stringify(p) !== JSON.stringify(x); }).map((x) => x.name);
const result = { ...old, mode: 'automatic', last_sync: new Date().toISOString(), refresh_hours: 3, attendees };
if (!dry && (added.length || changed.length)) fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ total: attendees.length, added, changed, written: !dry && !!(added.length || changed.length) }, null, 2));
