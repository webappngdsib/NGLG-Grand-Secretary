// 🎖 ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ — όχι χωριστή λίστα: οι γραμμές της Επετηρίδας (πίνακας «epeteirida») με τίτλο
// «Μέγας Επιμελητής» και Ενεργός = ΝΑΙ, συνδεδεμένες με το μέλος του Μητρώου (member_id). Η Στοά του Μεγάλου Επιμελητή
// γράφεται στη στήλη «Επαρχία / Στοά Μ. Επιμ.» και το έτος στο «Εν ενεργεία αξίωμα» (π.χ. «Μέγας Επιμελητής 2026–2027»).
// Email, κινητό και όνομα διαβάζονται πάντα από το Μητρώο Μελών. Ενημέρωση: επικόλληση του καταλόγου του έτους
// (Όνομα · Επώνυμο · Τάξις/Αξίωμα · Στοά Αριθμός) — η ταύτιση γίνεται με το ονοματεπώνυμο μέσα στη Στοά.
import { db } from '../core/store.js';
import { bind, flash, go, toast, table, notice, confirmDo } from '../core/app.js';
import { esc, foldName, sortBy, parsePasted, exportXlsx, today, fmtDate } from '../core/util.js';
import { parseRank } from './epeteirida-import.js';
import { precedenceOf } from './decree-catalog.js';
import { canonicalId, person } from '../core/people.js';
import { matchMember, provinceOfLodge } from '../core/officers.js';
import { reportPaper, printPaper } from '../core/paper.js';
import { lodgeByNumber } from './lodges.js';
import { attachPicker, memberItems, setRecipientGroup, addContactSource, primaryEmailOf, noContact } from '../core/pickers.js';
import { masonicYear } from './visits.js';

export const STEWARD_TITLE = 'Μέγας Επιμελητής';
export const STEWARDS_HREF = '#/members/stewards';
const T = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const fold = (v) => foldName(T(v));
const isStewardTitle = (t) => /^μεγασ επιμελητησ/.test(fold(t));
export const isActiveSteward = (r) => !!r && Number(r.active) === 1 && isStewardTitle(r.title);
const yearOf = (r) => (String(r.current || '').match(/(\d{4})\s*[–-]\s*(\d{4})/) || [])[0]?.replace('-', '–') || '';

const view = (r) => {
  const mid = r.member_id ? canonicalId(r.member_id) : null, p = mid ? person(mid) : null, rk = parseRank(r.title, false);
  return { r, member_id: mid, name: p ? p.name : T(r.full_name), surname: p && p.member ? T(p.member.surname) : T(r.full_name).split(' ')[0],
    title: T(r.title), prec: (rk ? precedenceOf(rk.office) : null) ?? 9999, lodge: T(r.province), email: p ? p.email || '' : '', mobile: p ? p.mobile || '' : '',
    year: yearOf(r), current: T(r.current) };
};
// Οι εν ενεργεία Μεγάλοι Επιμελητές: { r, member_id, name, lodge, email, mobile, year }
export const activeStewards = () => sortBy(db.all('epeteirida').filter(isActiveSteward).map(view), 'surname', 'name');
// Όλοι οι εν ενεργεία Μεγάλοι Αξιωματικοί της Επετηρίδας — ίδιος κανόνας με τη σελίδα Δηλώσεων («ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΑΞΙΩΜΑΤΙΚΟΙ»):
// τίτλος αξιώματος που δεν είναι «Πρώην …», χωρίς όσους «Μετέστη», και όσοι έχουν Ενεργός = ΝΑΙ· κατά τάξη προβαδίσματος (Σύνταγμα) και Α/Α
export const isActiveOfficer = (r) => !!T(r.title) && !/Μετέστη/i.test(r.current || '') && (!/^Πρώην /.test(T(r.title)) || Number(r.active) === 1)
  && !(isStewardTitle(r.title) && Number(r.active) !== 1);
export const activeOfficers = () => sortBy(db.all('epeteirida').filter(isActiveOfficer).map(view), 'prec', (x) => Number(x.r.aa) || 0, 'surname');
export const OFFICERS_HREF = '#/members/officers';
// Ομάδες παραληπτών «📣 Ενημέρωση Μεγάλων Αξιωματικών»: κύριο email του Μητρώου, χωρίς διαγραμμένους
const recipient = (x) => { const p = x.member_id ? person(x.member_id) : null, blocked = p && noContact(p.member);
  return blocked ? null : { name: [x.title, x.name].filter(Boolean).join(' · '), email: p ? primaryEmailOf(p.member) || p.email || '' : '' }; };
export const officerRecipients = () => activeOfficers().filter((x) => !isActiveSteward(x.r)).map(recipient).filter(Boolean);
export const stewardRecipients = () => activeStewards().map(recipient).filter(Boolean);
setRecipientGroup('officers', '🏛 Εν ενεργεία Μεγάλοι Αξιωματικοί', officerRecipients);
setRecipientGroup('stewards', '🎖 Εν ενεργεία Μεγάλοι Επιμελητές', stewardRecipients);
addContactSource(() => [['🏛 Όλοι οι εν ενεργεία Μεγάλοι Αξιωματικοί (ΜΑΞ)', officerRecipients()], ['🎖 Όλοι οι εν ενεργεία Μεγάλοι Επιμελητές', stewardRecipients()]]
  .map(([name, xs]) => ({ name, email: xs.map((x) => x.email).filter(Boolean).join(', '), sub: `Ομάδα · ${xs.filter((x) => x.email).length} email` })).filter((c) => c.email));
// Η γραμμή «Μέγας Επιμελητής» (εν ενεργεία) ενός μέλους, αν υπάρχει
export function stewardOf(memberId) {
  if (!memberId) return null;
  const k = canonicalId(memberId);
  return db.all('epeteirida').find((r) => isActiveSteward(r) && r.member_id && canonicalId(r.member_id) === k) || null;
}

// «Ηλιοτρόπιον 8» → { name, number }· «Καθήκον 99 99» → { Καθήκον, 99 }· «Ισότης 1882 97» → { Ισότης 1882, 97 }
export function parseLodge(text) {
  const t = T(text).split(' ');
  if (!t.length || !/^\d+$/.test(t[t.length - 1])) return { name: T(text), number: '' };
  const number = t.pop();
  while (t.length > 1 && t[t.length - 1] === number) t.pop();
  return { name: t.join(' '), number };
}
// Γραμμές επικόλλησης (στήλες Excel ή κείμενο): Όνομα · Επώνυμο · [Τάξις] · Αξίωμα · Στοά Αριθμός
export function parseStewards(text) {
  const out = [], bad = [];
  for (const row of parsePasted(text)) {
    let c = row.map(T).filter(Boolean), first, surname, lodge;
    if (c.length >= 3) { [first, surname] = c; lodge = c[c.length - 1]; }
    else {
      const m = /^(\S+)\s+(\S+)\s+(?:\d+\s+)?Μέγας\s+Επιμελητής\s+(.+)$/i.exec(c.join(' '));
      if (!m) { if (c.length) bad.push(c.join(' ')); continue; }
      [, first, surname, lodge] = m;
    }
    const l = parseLodge(lodge);
    if (!l.number) { if (!/όνομα|επώνυμο/i.test(c.join(' '))) bad.push(c.join(' ')); continue; }
    out.push({ first, surname, lodge: l });
  }
  return { items: out, bad };
}

// Μέλος του Μητρώου για «Επώνυμο Όνομα» μέσα στη Στοά: πρώτα η κοινή ταύτιση ονοματεπωνύμου (core/officers.js),
// αλλιώς μοναδικό ενεργό μέλος της Στοάς με το ίδιο επώνυμο (χωρίς τόνους/διαλυτικά) — π.χ. «Μιχάλης» = «Μιχαήλ»· με
// συνώνυμους, και τα πρώτα γράμματα του ονόματος. Χωρίς βεβαιότητα: null (δεν δημιουργείται νέο μέλος — όχι διπλοεγγραφές).
export function memberInLodge(x, src = db) {
  const mid = matchMember(`${x.surname} ${x.first}`, x.lodge.number) || matchMember(`${x.first} ${x.surname}`, x.lodge.number);
  if (mid) return canonicalId(mid);
  const key = (n) => String(n ?? '').replace(/\s+/g, '').replace(/^0+/, ''), ms = new Map(src.all('member_registry').map((m) => [m.id, m]));
  const inLodge = [...new Set(src.all('member_lodges').filter((l) => key(l.lodge_number) === key(x.lodge.number) && !/ΔΙΑΓΡΑΦ|ΜΕΤΕΣΘ/i.test(foldName(l.member_status).toUpperCase()))
    .map((l) => l.member_id))].map((id) => ms.get(id)).filter((m) => m && fold(m.surname) === fold(x.surname));
  const ids = (xs) => [...new Set(xs.map((m) => canonicalId(m.id)))];
  if (ids(inLodge).length === 1) return ids(inLodge)[0];
  const f3 = fold(x.first).slice(0, 3), same = inLodge.filter((m) => fold(m.first_name).startsWith(f3) || f3.startsWith(fold(m.first_name).slice(0, 3)));
  return ids(same).length === 1 ? ids(same)[0] : null;
}

// Ενημέρωση της Επετηρίδας (μέσα σε μία αποθήκευση tx): οι Μεγάλοι Επιμελητές του καταλόγου γίνονται εν ενεργεία, με Στοά και έτος,
// στην ΙΔΙΑ εγγραφή του μέλους (χωρίς διπλή γραμμή): η γραμμή του ως Μέγας Επιμελητής, αλλιώς η κύρια γραμμή του (το παλιό «Πρώην …»
// μένει στο «Ανώτατο αξίωμα»), αλλιώς νέα γραμμή. Όσοι ήταν εν ενεργεία Μεγάλοι Επιμελητές αλλά λείπουν γίνονται «Πρώην Μέγας Επιμελητής».
// Μία εγγραφή: ο Αδελφός x (Όνομα, Επώνυμο, Στοά) — ή το μέλος mid, αν δίνεται — γίνεται εν ενεργεία Μέγας Επιμελητής στη ΔΙΚΗ ΤΟΥ γραμμή Επετηρίδας
function upsertSteward(tx, x, year, mid, kept = new Set()) {
  const m = mid ? tx.get('member_registry', mid) : null, full = m ? `${T(m.surname)} ${T(m.first_name)}` : `${x.surname} ${x.first}`;
  const l = tx.find('lodges', (y) => String(y.number ?? '').replace(/^0+/, '') === String(x.lodge.number).replace(/^0+/, ''));
  const lodge = l ? `${T(l.name)} ${T(l.number)}` : T(`${x.lodge.name} ${x.lodge.number}`);
  const mine = (r) => !kept.has(r.id) && ((mid && r.member_id && canonicalId(r.member_id) === mid) || (!r.member_id && fold(r.full_name) === fold(full)));
  const rows = tx.all('epeteirida').filter(mine);
  const ex = rows.find((r) => /επιμελητησ/.test(fold(r.title))) || rows.find((r) => !T(r.title) || /^Πρώην /.test(T(r.title)));
  const patch = { active: 1, title: STEWARD_TITLE, province: lodge, current: `${STEWARD_TITLE} ${year}`, ...(mid ? { member_id: mid, full_name: full } : {}) };
  if (ex) {
    const old = T(ex.title);
    tx.update('epeteirida', ex.id, { ...patch, ...(old && !/επιμελητησ/.test(fold(old)) && !T(ex.rank) ? { rank: old } : {}) });
    kept.add(ex.id); return { id: ex.id, lodge, added: false };
  }
  const aa = Math.max(0, ...tx.all('epeteirida').map((r) => Number(r.aa) || 0)) + 1;
  const r = tx.insert('epeteirida', { aa, member_id: mid || null, full_name: full, honorific: '', rank: '', decree_no: '', decree_year: '', tmd: 0, tmd_decree: '', ...patch });
  kept.add(r.id); return { id: r.id, lodge, added: true };
}
export function applyStewards(tx, items, year) {
  const res = { total: items.length, matched: 0, unmatched: [], added: 0, updated: 0, retired: 0 };
  const kept = new Set();
  for (const x of items) {
    const mid = memberInLodge(x, tx), u = upsertSteward(tx, x, year, mid, kept);
    if (mid) res.matched++; else res.unmatched.push(`${x.surname} ${x.first} (${u.lodge})`);
    if (u.added) res.added++; else res.updated++;
  }
  for (const r of tx.all('epeteirida')) if (isActiveSteward(r) && !kept.has(r.id)) { tx.update('epeteirida', r.id, { active: 0, title: 'Πρώην ' + STEWARD_TITLE }); res.retired++; }
  tx.setting('grand_stewards_report', JSON.stringify({ year, at: new Date().toISOString(), ...res }));
  return res;
}
// Από την καρτέλα του μέλους: ορισμός ως Μέγας Επιμελητής (Στοά, έτος) — χωρίς να αλλάζουν οι υπόλοιποι
export async function setMemberSteward(memberId, lodgeNumber, year = masonicYear().label) {
  const mid = canonicalId(memberId), m = db.get('member_registry', mid);
  if (!m) throw new Error('Δεν βρέθηκε το μέλος.');
  if (!String(lodgeNumber || '').trim()) throw new Error('Επιλέξτε τη Στοά του Μεγάλου Επιμελητή.');
  await db.save(`Μέγας Επιμελητής ${year}: ${T(m.surname)} ${T(m.first_name)}`, (tx) => { upsertSteward(tx, { first: T(m.first_name), surname: T(m.surname), lodge: { name: '', number: String(lodgeNumber) } }, T(year) || masonicYear().label, mid); });
}
// Από την καρτέλα του μέλους: λήξη — «Πρώην Μέγας Επιμελητής», Ενεργός = ΟΧΙ (η εγγραφή μένει στο ιστορικό)
export async function retireMemberSteward(memberId) {
  const r = stewardOf(memberId); if (!r) return;
  await db.save(`Πρώην Μέγας Επιμελητής: ${T(r.full_name)}`, (tx) => { tx.update('epeteirida', r.id, { active: 0, title: 'Πρώην ' + STEWARD_TITLE }); });
}
// Πλαίσιο στην καρτέλα του μέλους: εν ενεργεία → στοιχεία, κουμπί προς τον κατάλογο, λήξη· αλλιώς → ορισμός με Στοά και έτος
export function stewardCard(m) {
  const r = stewardOf(m.id), k = canonicalId(m.id);
  if (r) return `<div class="card gs-member"><b>🎖 ${esc(r.current || r.title)}</b>${r.province ? ` · Στοά <b>${esc(r.province)}</b>` : ''}
<a class="btn small primary" href="${STEWARDS_HREF}" id="gsMemberBtn">ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ →</a> <button type="button" class="btn small" data-act="gsOff">Λήξη (γίνεται Πρώην)</button></div>`;
  const ls = db.all('member_lodges').filter((l) => canonicalId(l.member_id) === k && !/ΔΙΑΓΡΑΦ|ΜΕΤΕΣΘ/.test(foldName(l.member_status).toUpperCase()));
  const opts = [...new Map(ls.map((l) => [String(l.lodge_number), l])).values()].map((l) => { const x = lodgeByNumber(l.lodge_number); return `<option value="${esc(l.lodge_number)}">${esc(x ? `${T(x.name)} ${T(x.number)}` : `${T(l.lodge_name)} ${T(l.lodge_number)}`)}</option>`; }).join('');
  return `<div class="card gs-member gs-set"><h3>🎖 Μέγας Επιμελητής <small class="muted">— ορισμός για το τεκτονικό έτος</small></h3>
<div class="grid"><div><label for="gsLodge">Στοά</label><select id="gsLodge">${opts || '<option value="">— το μέλος δεν έχει ενεργή Στοά —</option>'}</select></div>
<div><label for="gsYearM">Τεκτονικό έτος</label><input id="gsYearM" value="${esc(masonicYear().label)}"></div></div>
<p class="muted">Γράφεται στην ίδια εγγραφή Επετηρίδας του μέλους (όχι νέα λίστα, όχι διπλή εγγραφή) και εμφανίζεται στους ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΥΣ ΕΠΙΜΕΛΗΤΕΣ και ΑΞΙΩΜΑΤΙΚΟΥΣ.</p>
<button type="button" class="btn gs-btn" data-act="gsSet">🎖 Ορισμός ως Μέγας Επιμελητής</button></div>`;
}
export async function saveStewards(text, year = masonicYear().label) {
  const { items, bad } = parseStewards(text);
  if (!items.length) throw new Error('Δεν βρέθηκαν γραμμές. Στήλες: Όνομα, Επώνυμο, Αξίωμα, Στοά Αριθμός.');
  let res;
  await db.save(`ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ ${year} (${items.length})`, (tx) => { res = applyStewards(tx, items, year); });
  return { ...res, bad };
}

// Επαρχία της Στοάς (από τον κατάλογο Στοών) και σειρά Επαρχιών όπως στις Επαρχιακές Μεγάλες Στοές
const lodgeNo = (text) => (String(text || '').match(/(\d+)\s*$/) || [])[1] || '';
export function provinceOf(x) {
  const l = lodgeNo(x.lodge) ? lodgeByNumber(lodgeNo(x.lodge)) : null, p = l ? provinceOfLodge(l) : null;
  return { name: p ? T(p.short) : T((l || {}).provincial), order: p ? Number(p.sort_order) || p.id : 999 };
}
const rowsOf = (xs) => xs.map((x, i) => [i + 1, x.name, x.lodge, x.prov.name, x.year, x.email, x.mobile]);
export function stewardsPage({ query }) {
  // ταξινόμηση ανά Επαρχία (σειρά των Επαρχιακών Μεγάλων Στοών) και επώνυμο
  const xs = sortBy(activeStewards().map((x) => ({ ...x, prov: provinceOf(x) })), (x) => x.prov.order, 'surname', 'name'), y = masonicYear().label, years = [...new Set(xs.map((x) => x.year).filter(Boolean))];
  const shown = years.length === 1 ? years[0] : y;
  let rep = null; try { rep = JSON.parse(db.setting('grand_stewards_report') || 'null'); } catch { rep = null; }
  const warn = rep && rep.unmatched && rep.unmatched.length ? `<div class="card nocontact"><b>⚠ Χωρίς σύνδεση με μέλος του Μητρώου (${esc(rep.year)}):</b> ${rep.unmatched.map(esc).join(' · ')}<br><small>Ελέγξτε το ονοματεπώνυμο / τη Στοά του μέλους στο Μητρώο και ξαναπατήστε την ενημέρωση — δεν δημιουργήθηκαν νέα μέλη.</small></div>` : '';
  const tbl = (print) => table(['#', 'Ονοματεπώνυμο', 'Στοά', 'Επαρχία', 'Έτος', 'Email', 'Κινητό', ...(print ? [] : ['Ενέργειες'])], xs.map((x, i) => [i + 1,
    x.member_id && !print ? `<a href="#/members/${x.member_id}"><b>${esc(x.name)}</b></a>` : `<b>${esc(x.name)}</b>${x.member_id || print ? '' : ' <span class="pill bad" title="Δεν συνδέθηκε με μέλος του Μητρώου">χωρίς σύνδεση</span>'}`,
    esc(x.lodge), esc(x.prov.name), esc(x.year || '—'), esc(x.email), esc(x.mobile),
    ...(print ? [] : [x.member_id ? `<a class="btn small" href="#/members/${x.member_id}">Μέλος</a> <a class="btn small" href="#/members/card?ids=${x.member_id}">🪪 Κάρτα</a>` : '<a class="btn small" href="#/epeteirida/pinakas">Επετηρίδα</a>'])]),
  'Δεν υπάρχουν ακόμη εν ενεργεία Μεγάλοι Επιμελητές· επικολλήστε τον κατάλογο παρακάτω.');
  return {
    title: 'ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ',
    html: `<div class="noprint"><p><a href="#/members">← Μητρώο Μελών</a></p><h1>🎖 ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ <small class="muted">${esc(shown)}</small></h1>${notice(query.msg)}
<p class="muted">Ένας κατάλογος για όλη την εφαρμογή: η Επετηρίδα (τίτλος «Μέγας Επιμελητής», Ενεργός = ΝΑΙ), συνδεδεμένη με κάθε μέλος του Μητρώου. Email και κινητό από την καρτέλα του μέλους.</p>
<div class="toolbar"><button type="button" class="btn primary" data-act="print">🖨 Εκτύπωση / PDF</button><button type="button" class="btn" data-act="xlsx">⬇ Excel</button><a class="btn" href="#/epeteirida/pinakas">📜 Επετηρίδα</a><span class="muted" style="align-self:center">${xs.length} Μεγάλοι Επιμελητές</span></div>
${warn}<div class="card"><label for="gsFind"><b>+ Προσθήκη Μεγάλου Επιμελητή</b> — αναζήτηση μέλους του Μητρώου· στην καρτέλα του: «🎖 Μέγας Επιμελητής» → Ορισμός</label><input id="gsFind" placeholder="Επώνυμο, όνομα ή Αρ. Μητρώου" autocomplete="off"></div>
<div class="card tablecard" id="gstab">${tbl(false)}</div>
<details class="card fold" id="gsimp"${xs.length ? '' : ' open'}><summary><b>Ενημέρωση καταλόγου (επικόλληση από Excel)</b></summary>
<p class="muted">Στήλες: <b>Όνομα · Επώνυμο · Αξίωμα · Στοά Αριθμός</b> (π.χ. «30 Μέγας Επιμελητής» και «Ηλιοτρόπιον 8»). Κάθε όνομα συνδέεται με το μέλος του Μητρώου μέσα στη Στοά του
και η εγγραφή του στην Επετηρίδα γίνεται «Μέγας Επιμελητής» εν ενεργεία, με Στοά και έτος. Όσοι ήταν εν ενεργεία Μεγάλοι Επιμελητές και δεν υπάρχουν στον νέο κατάλογο γίνονται «Πρώην Μέγας Επιμελητής».</p>
<label for="gsYear">Τεκτονικό έτος</label><input id="gsYear" value="${esc(y)}" style="max-width:160px">
<textarea id="gsPaste" class="short" placeholder="Όνομα&#9;Επώνυμο&#9;30 Μέγας Επιμελητής&#9;Στοά Αριθμός"></textarea>
<div class="toolbar" style="margin-top:10px"><button type="button" class="btn primary" data-act="save">💾 Ενημέρωση Μητρώου και Επετηρίδας</button></div><div id="gsres"></div></details></div>
<div class="print-area" id="gspa" hidden></div>`,
    mount(el) {
      attachPicker(el.querySelector('#gsFind'), (q) => memberItems(q), (mm) => go(`/members/${mm.id}`));
      bind(el, {
        async save() {
          const text = el.querySelector('#gsPaste').value, year = T(el.querySelector('#gsYear').value) || y;
          if (xs.length && !confirmDo(`Ο κατάλογος ${year} αντικαθιστά τους σημερινούς εν ενεργεία Μεγάλους Επιμελητές (${xs.length}). Συνέχεια;`)) return;
          const r = await saveStewards(text, year);
          flash(`Μεγάλοι Επιμελητές ${year}: ${r.total} · ${r.matched} συνδέθηκαν με το Μητρώο · ${r.added} νέες και ${r.updated} ενημερωμένες εγγραφές Επετηρίδας`
            + (r.retired ? ` · ${r.retired} έγιναν Πρώην Μεγάλοι Επιμελητές` : '') + (r.unmatched.length ? ` · ΧΩΡΙΣ ΣΥΝΔΕΣΗ (ελέγξτε το Μητρώο): ${r.unmatched.join(', ')}` : '')
            + (r.bad.length ? ` · δεν διαβάστηκαν: ${r.bad.join(' · ')}` : ''));
          go('/members/stewards');
        },
        async xlsx() {
          await exportXlsx(`MEGALOI_EPIMELITES_${shown.replace(/\D+/g, '_')}.xlsx`, 'Μεγάλοι Επιμελητές', ['#', 'Ονοματεπώνυμο', 'Στοά', 'Επαρχία', 'Έτος', 'Email', 'Κινητό'], rowsOf(xs), [5, 32, 30, 34, 12, 32, 16]);
          toast(`Excel: ${xs.length} Μεγάλοι Επιμελητές.`);
        },
        print() {
          const pa = el.querySelector('#gspa');
          pa.innerHTML = reportPaper(`ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ ${shown}`, fmtDate(today()), tbl(true));
          pa.hidden = false; printPaper('MEGALOI_EPIMELITES_' + today());
          window.addEventListener('afterprint', () => (pa.hidden = true), { once: true });
        },
      });
    },
  };
}

// 🏛 ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΑΞΙΩΜΑΤΙΚΟΙ — η ίδια Επετηρίδα (Ενεργός = ΝΑΙ), κατά τάξη προβαδίσματος, συνδεδεμένη με το Μητρώο
export function officersPage({ query }) {
  const xs = activeOfficers(), y = masonicYear().label;
  const tbl = (print) => table(['Τάξις', 'Αξίωμα', 'Ονοματεπώνυμο', 'Επαρχία / Στοά', 'Εν ενεργεία αξίωμα / διάταγμα', 'Email', 'Κινητό', ...(print ? [] : ['Ενέργειες'])], xs.map((x, i) => [i + 1,
    `<b>${esc(x.title)}</b>`, x.member_id && !print ? `<a href="#/members/${x.member_id}">${esc(x.name)}</a>` : `${esc(x.name)}${x.member_id || print ? '' : ' <span class="pill bad" title="Δεν συνδέθηκε με μέλος του Μητρώου">χωρίς σύνδεση</span>'}`,
    esc(x.lodge), esc(x.current), esc(x.email), esc(x.mobile),
    ...(print ? [] : [x.member_id ? `<a class="btn small" href="#/members/${x.member_id}">Μέλος</a> <a class="btn small" href="#/members/card?ids=${x.member_id}">🪪 Κάρτα</a>` : '<a class="btn small" href="#/epeteirida/pinakas">Επετηρίδα</a>'])]),
  'Δεν υπάρχουν εγγραφές με Ενεργός = ΝΑΙ στην Επετηρίδα.');
  const rows = () => xs.map((x, i) => [i + 1, x.title, x.name, x.lodge, x.current, x.email, x.mobile]);
  return {
    title: 'ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΑΞΙΩΜΑΤΙΚΟΙ',
    html: `<div class="noprint"><p><a href="#/members">← Μητρώο Μελών</a></p><h1>🏛 ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΑΞΙΩΜΑΤΙΚΟΙ <small class="muted">${esc(y)}</small></h1>${notice(query.msg)}
<p class="muted">Ένας κατάλογος για όλη την εφαρμογή: η Επετηρίδα (Ενεργός = ΝΑΙ), κατά τάξη προβαδίσματος, συνδεδεμένη με κάθε μέλος του Μητρώου. Για αλλαγές: <a href="#/epeteirida/pinakas">Επετηρίδα</a> ή <a href="${STEWARDS_HREF}">Μεγάλοι Επιμελητές</a>.</p>
<div class="toolbar"><button type="button" class="btn primary" data-act="print">🖨 Εκτύπωση / PDF</button><button type="button" class="btn" data-act="xlsx">⬇ Excel</button><a class="btn" href="${STEWARDS_HREF}">🎖 Μεγάλοι Επιμελητές</a><span class="muted" style="align-self:center">${xs.length} Μεγάλοι Αξιωματικοί</span></div>
<div class="card tablecard" id="gotab">${tbl(false)}</div></div><div class="print-area" id="gopa" hidden></div>`,
    mount(el) {
      bind(el, {
        async xlsx() {
          await exportXlsx(`EN_ENERGEIA_MEGALOI_AXIOMATIKOI_${y.replace(/\D+/g, '_')}.xlsx`, 'Εν ενεργεία', ['Τάξις', 'Αξίωμα', 'Ονοματεπώνυμο', 'Επαρχία / Στοά', 'Εν ενεργεία αξίωμα / διάταγμα', 'Email', 'Κινητό'], rows(), [6, 36, 30, 26, 32, 30, 16]);
          toast(`Excel: ${xs.length} Μεγάλοι Αξιωματικοί.`);
        },
        print() {
          const pa = el.querySelector('#gopa');
          pa.innerHTML = reportPaper(`ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΑΞΙΩΜΑΤΙΚΟΙ ${y}`, fmtDate(today()), tbl(true));
          pa.hidden = false; printPaper('EN_ENERGEIA_MEGALOI_AXIOMATIKOI_' + today());
          window.addEventListener('afterprint', () => (pa.hidden = true), { once: true });
        },
      });
    },
  };
}
