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
import { matchMember } from '../core/officers.js';
import { reportPaper, printPaper } from '../core/paper.js';
import { lodgeByNumber } from './lodges.js';
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

// Ενημέρωση της Επετηρίδας: οι Μεγάλοι Επιμελητές του καταλόγου γίνονται εν ενεργεία (με Στοά και έτος) στο μέλος τους·
// όσοι ήταν εν ενεργεία Μεγάλοι Επιμελητές αλλά δεν είναι στον νέο κατάλογο γίνονται Ενεργός = ΟΧΙ και «Πρώην Μέγας Επιμελητής».
export async function saveStewards(text, year = masonicYear().label) {
  const { items, bad } = parseStewards(text);
  if (!items.length) throw new Error('Δεν βρέθηκαν γραμμές. Στήλες: Όνομα, Επώνυμο, Αξίωμα, Στοά Αριθμός.');
  const res = { total: items.length, matched: 0, unmatched: [], added: 0, updated: 0, retired: 0, bad };
  await db.save(`ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ ${year} (${items.length})`, (tx) => {
    Object.assign(res, { matched: 0, unmatched: [], added: 0, updated: 0, retired: 0 });
    const kept = new Set();
    let aa = Math.max(0, ...tx.all('epeteirida').map((x) => Number(x.aa) || 0));
    for (const x of items) {
      const full = `${x.surname} ${x.first}`, mid = matchMember(full, x.lodge.number) || matchMember(`${x.first} ${x.surname}`, x.lodge.number);
      const l = lodgeByNumber(x.lodge.number), lodge = l ? `${T(l.name)} ${T(l.number)}` : `${x.lodge.name} ${x.lodge.number}`;
      if (mid) res.matched++; else res.unmatched.push(`${full} (${lodge})`);
      const k = mid ? canonicalId(mid) : null;
      const ex = tx.all('epeteirida').find((r) => isStewardTitle(r.title) && !kept.has(r.id)
        && ((k && r.member_id && canonicalId(r.member_id) === k) || (!r.member_id && fold(T(r.full_name)) === fold(full))));
      const patch = { active: 1, province: lodge, current: `${STEWARD_TITLE} ${year}`, ...(mid ? { member_id: mid } : {}) };
      if (ex) { tx.update('epeteirida', ex.id, patch); kept.add(ex.id); res.updated++; }
      else {
        const r = tx.insert('epeteirida', { aa: ++aa, member_id: mid || null, full_name: full, honorific: '', rank: '', title: STEWARD_TITLE,
          decree_no: '', decree_year: '', tmd: 0, tmd_decree: '', ...patch });
        kept.add(r.id); res.added++;
      }
    }
    for (const r of tx.all('epeteirida')) if (isActiveSteward(r) && !kept.has(r.id)) { tx.update('epeteirida', r.id, { active: 0, title: 'Πρώην ' + STEWARD_TITLE }); res.retired++; }
  });
  return res;
}

const rowsOf = (xs) => xs.map((x, i) => [i + 1, x.name, x.lodge, x.year, x.email, x.mobile]);
export function stewardsPage({ query }) {
  const xs = activeStewards(), y = masonicYear().label, years = [...new Set(xs.map((x) => x.year).filter(Boolean))];
  const shown = years.length === 1 ? years[0] : y;
  const tbl = (print) => table(['#', 'Ονοματεπώνυμο', 'Στοά', 'Έτος', 'Email', 'Κινητό', ...(print ? [] : ['Ενέργειες'])], xs.map((x, i) => [i + 1,
    x.member_id && !print ? `<a href="#/members/${x.member_id}"><b>${esc(x.name)}</b></a>` : `<b>${esc(x.name)}</b>${x.member_id || print ? '' : ' <span class="pill bad" title="Δεν συνδέθηκε με μέλος του Μητρώου">χωρίς σύνδεση</span>'}`,
    esc(x.lodge), esc(x.year || '—'), esc(x.email), esc(x.mobile),
    ...(print ? [] : [x.member_id ? `<a class="btn small" href="#/members/${x.member_id}">Μέλος</a> <a class="btn small" href="#/members/card?ids=${x.member_id}">🪪 Κάρτα</a>` : '<a class="btn small" href="#/epeteirida/pinakas">Επετηρίδα</a>'])]),
  'Δεν υπάρχουν ακόμη εν ενεργεία Μεγάλοι Επιμελητές· επικολλήστε τον κατάλογο παρακάτω.');
  return {
    title: 'ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ',
    html: `<div class="noprint"><p><a href="#/members">← Μητρώο Μελών</a></p><h1>🎖 ΕΝ ΕΝΕΡΓΕΙΑ ΜΕΓΑΛΟΙ ΕΠΙΜΕΛΗΤΕΣ <small class="muted">${esc(shown)}</small></h1>${notice(query.msg)}
<p class="muted">Ένας κατάλογος για όλη την εφαρμογή: η Επετηρίδα (τίτλος «Μέγας Επιμελητής», Ενεργός = ΝΑΙ), συνδεδεμένη με κάθε μέλος του Μητρώου. Email και κινητό από την καρτέλα του μέλους.</p>
<div class="toolbar"><button type="button" class="btn primary" data-act="print">🖨 Εκτύπωση / PDF</button><button type="button" class="btn" data-act="xlsx">⬇ Excel</button><a class="btn" href="#/epeteirida/pinakas">📜 Επετηρίδα</a><span class="muted" style="align-self:center">${xs.length} Μεγάλοι Επιμελητές</span></div>
<div class="card tablecard" id="gstab">${tbl(false)}</div>
<details class="card fold" id="gsimp"${xs.length ? '' : ' open'}><summary><b>Ενημέρωση καταλόγου (επικόλληση από Excel)</b></summary>
<p class="muted">Στήλες: <b>Όνομα · Επώνυμο · Αξίωμα · Στοά Αριθμός</b> (π.χ. «30 Μέγας Επιμελητής» και «Ηλιοτρόπιον 8»). Κάθε όνομα συνδέεται με το μέλος του Μητρώου μέσα στη Στοά του
και η εγγραφή του στην Επετηρίδα γίνεται «Μέγας Επιμελητής» εν ενεργεία, με Στοά και έτος. Όσοι ήταν εν ενεργεία Μεγάλοι Επιμελητές και δεν υπάρχουν στον νέο κατάλογο γίνονται «Πρώην Μέγας Επιμελητής».</p>
<label for="gsYear">Τεκτονικό έτος</label><input id="gsYear" value="${esc(y)}" style="max-width:160px">
<textarea id="gsPaste" class="short" placeholder="Όνομα&#9;Επώνυμο&#9;30 Μέγας Επιμελητής&#9;Στοά Αριθμός"></textarea>
<div class="toolbar" style="margin-top:10px"><button type="button" class="btn primary" data-act="save">💾 Ενημέρωση Μητρώου και Επετηρίδας</button></div><div id="gsres"></div></details></div>
<div class="print-area" id="gspa" hidden></div>`,
    mount(el) {
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
          await exportXlsx(`MEGALOI_EPIMELITES_${shown.replace(/\D+/g, '_')}.xlsx`, 'Μεγάλοι Επιμελητές', ['#', 'Ονοματεπώνυμο', 'Στοά', 'Έτος', 'Email', 'Κινητό'], rowsOf(xs), [5, 32, 30, 12, 32, 16]);
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
