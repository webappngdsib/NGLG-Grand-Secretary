// Κέρκυρα 2026 — Ευγενική Υπενθύμιση σε όσους εν ενεργεία Μεγάλους Αξιωματικούς δεν έχουν δηλώσει μετακίνηση/διαμονή.
// Εν ενεργεία ΜΑΞ: corfu-2026/active-officers.json (επίσημος κατάλογος Μεγάλης Γραμματείας)· αλλιώς Επετηρίδα της εφαρμογής.
// Δηλώσεις: corfu-2026/attendees.json · Δικαιολογημένες απουσίες: corfu-2026/excused.json (εκτός υπενθύμισης, πορτοκαλί).
// Email: ΟΛΑ τα email του προσώπου από το Μητρώο (identify → person.emails) + όποιο email έχει στείλει στις δηλώσεις.
// Επιλογή παραληπτών με κουτάκι ανά Μεγάλο Αξιωματικό· προσθήκη οποιουδήποτε μέλους από το Μητρώο· ένα email, όλοι σε Bcc,
// με προεπισκόπηση και επιβεβαίωση πριν φύγει.
import { module, bind, toast } from '../core/app.js';
import { esc } from '../core/util.js';
import { identify, person } from '../core/people.js';
import { senderFor } from '../core/mail.js';
import { publicOfficers } from './visits.js';

export const REMIND_SUBJECT = 'Ευγενική Υπενθύμιση — Δήλωση Συμμετοχής σε Μετακίνηση & Διαμονή Μεγάλων Αξιωματικών';
export const REMIND_BODY = `Αγαπητοί Σεβτ., Πσεβ., Λίαν Σεβ., Σεβ. Αδ.,

Δεν φαίνεται στο σύστημα συμμετοχής να έχει λάβει ενημέρωση η Μεγάλη Γραμματεία για τη μετακίνηση ή την επιθυμία φιλοξενίας σας, σύμφωνα με τις σχετικές επιστολές.

Η δήλωση δείπνου είναι ανεξάρτητη, μόνο για το δείπνο, και γίνεται στο www.nglgreece.org, στα ΝΕΑ, στη «Δήλωση Συμμετοχής».

Για τη διαμονή και τη μετακίνηση, παρακαλώ στείλτε email στο grand.secretary@nglgreece.gr με θέμα ακριβώς το εξής μοτίβο, ώστε να το αναγνωρίσει το σύστημα:
Διαμονή - Μετακίνηση Ονοματεπώνυμό σας (μόνον)

με κείμενο:
«Επιθυμώ να έρθω με το λεωφορείο της ΕΜΣτΕ» ή «Θα έρθω με ιδιωτικό μέσο»
και
«Θα διαμείνω φιλοξενούμενος της ΕΜΣτΕ σε δίκλινο με άλλον αδελφό» ή «Επιθυμώ να μείνω σε δίκλινο αποκλειστικά για εμένα, με κόστος 45€ ανά βραδιά».

Με Αφοσίωση και Αδελφική Αγάπη,

Πσεβ. Αδ. Δημήτριος Σκιαδόπουλος
Μέγας Γραμματέας
6951097562`;

// Αντιστοίχιση ονομάτων (ίδιος κανόνας με το Πινάκιο της σελίδας corfu-2026/: επώνυμο + όνομα, υποκοριστικά, aliases)
const NICK = { ΤΑΣΟΣ: 'ΑΝΑΣΤΑΣΙΟΣ', ΑΝΑΣΤΑΣΗΣ: 'ΑΝΑΣΤΑΣΙΟΣ', ΝΑΣΟΣ: 'ΑΘΑΝΑΣΙΟΣ', ΘΑΝΑΣΗΣ: 'ΑΘΑΝΑΣΙΟΣ', ΘΑΝΟΣ: 'ΑΘΑΝΑΣΙΟΣ', ΦΩΤΗΣ: 'ΦΩΤΙΟΣ', ΝΙΚΟΣ: 'ΝΙΚΟΛΑΟΣ',
  ΣΠΥΡΟΣ: 'ΣΠΥΡΙΔΩΝ', ΣΠΥΡΙΔΩΝΑΣ: 'ΣΠΥΡΙΔΩΝ', ΓΙΑΝΝΗΣ: 'ΙΩΑΝΝΗΣ', ΓΙΩΡΓΟΣ: 'ΓΕΩΡΓΙΟΣ', ΚΩΣΤΑΣ: 'ΚΩΝΣΤΑΝΤΙΝΟΣ', ΝΤΙΝΟΣ: 'ΚΩΝΣΤΑΝΤΙΝΟΣ', ΔΗΜΗΤΡΗΣ: 'ΔΗΜΗΤΡΙΟΣ',
  ΤΑΚΗΣ: 'ΔΗΜΗΤΡΙΟΣ', ΜΙΧΑΛΗΣ: 'ΜΙΧΑΗΛ', ΠΑΝΟΣ: 'ΠΑΝΑΓΙΩΤΗΣ', ΒΑΣΙΛΗΣ: 'ΒΑΣΙΛΕΙΟΣ', ΑΝΤΩΝΗΣ: 'ΑΝΤΩΝΙΟΣ', ΘΟΔΩΡΗΣ: 'ΘΕΟΔΩΡΟΣ', ΑΛΕΞΗΣ: 'ΑΛΕΞΑΝΔΡΟΣ',
  ΜΑΝΟΣ: 'ΕΜΜΑΝΟΥΗΛ', ΜΑΝΩΛΗΣ: 'ΕΜΜΑΝΟΥΗΛ', ΛΕΥΤΕΡΗΣ: 'ΕΛΕΥΘΕΡΙΟΣ', ΣΤΕΛΙΟΣ: 'ΣΤΥΛΙΑΝΟΣ', ΣΤΑΘΗΣ: 'ΕΥΣΤΑΘΙΟΣ', ΓΡΗΓΟΡΗΣ: 'ΓΡΗΓΟΡΙΟΣ', ΧΑΡΗΣ: 'ΧΑΡΑΛΑΜΠΟΣ',
  ΣΩΤΗΡΗΣ: 'ΣΩΤΗΡΙΟΣ', ΑΓΓΕΛΗΣ: 'ΑΓΓΕΛΟΣ' };
const toks = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleUpperCase('el-GR').replace(/\([^)]*\)/g, ' ').split(/[^A-ZΑ-Ω]+/u).filter((t) => t.length > 1);
const canon = (t) => NICK[t] || t;
function matchKind(att, offName) {
  const ot = toks(offName); if (ot.length < 2) return '';
  const sur = ot[0], first = ot.slice(1), at = toks(att.name);
  if (!at.includes(sur)) return '';
  const rest = at.filter((t) => t !== sur);
  return rest.some((a) => first.some((f) => canon(a) === canon(f) || (a.length > 3 && f.length > 3 && a.slice(0, 4) === f.slice(0, 4)))) ? 'full' : 'surname';
}
const offNames = (o) => [o.name, ...(o.aliases || [])];
const matchOff = (att, o) => { let best = ''; for (const n of offNames(o)) { const k = matchKind(att, n); if (k === 'full') return k; if (k) best = k; } return best; };
const uniq = (xs) => [...new Map(xs.filter(Boolean).map((e) => [String(e).toLowerCase(), String(e)])).values()];

// Όλα τα email ενός προσώπου: Μητρώο (όλες οι εγγραφές του) + email που έστειλε στις δηλώσεις
function emailsFor(name, extra = []) {
  const id = identify({ full_name: name }), p = id ? person(id) : null;
  return { emails: uniq([...(p ? p.emails : []), ...extra]), memberId: p ? p.id : null, inRegistry: !!p };
}
// → [{ name, title, status: ok|exc|pending, reason, emails, memberId }] σε τάξη προβαδίσματος
export function remindRows(attendees, officers, excused = []) {
  const act = officers.filter((o) => !/^Πρώην/.test(String(o.group || o.title || '').trim())).sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const surCount = {}; for (const o of act) for (const n of offNames(o)) { const s = toks(n)[0]; surCount[s] = (surCount[s] || 0) + 1; }
  const used = new Set();
  return act.map((o) => {
    let hit = attendees.find((r) => !used.has(r) && matchOff(r, o) === 'full');
    if (!hit && offNames(o).some((n) => surCount[toks(n)[0]] === 1)) hit = attendees.find((r) => !used.has(r) && matchOff(r, o) === 'surname');
    if (hit) used.add(hit);
    const exc = hit ? null : excused.find((e) => matchOff(e, o) === 'full');
    const declaredMail = hit && hit.email && !/@nglgreece\.gr$/i.test(hit.email) ? [hit.email] : [];
    return { name: o.name, title: o.title, status: hit ? 'ok' : exc ? 'exc' : 'pending', reason: exc ? exc.reason || '' : '', ...emailsFor(o.name, declaredMail) };
  });
}

async function getJson(url) { const r = await fetch(url + '?fresh=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }

async function page() {
  let attendees = [], officers = [], excused = [], src = '', err = '';
  try { attendees = (await getJson('corfu-2026/attendees.json')).attendees || []; } catch (e) { err = `Δεν φορτώθηκε η λίστα δηλώσεων (${e.message || e}). `; }
  try { const d = await getJson('corfu-2026/active-officers.json'); officers = d.officers || []; src = d.source || 'κατάλογος εν ενεργεία'; } catch { officers = publicOfficers(); src = 'Επετηρίδα της εφαρμογής'; }
  try { excused = (await getJson('corfu-2026/excused.json')).excused || []; } catch { excused = []; }
  const rows = remindRows(attendees, officers, excused);
  const extra = []; // πρόσθετοι παραλήπτες από το Μητρώο
  const n = (s) => rows.filter((x) => x.status === s).length, noMail = rows.filter((x) => x.status === 'pending' && !x.emails.length);
  const ST = { ok: ['✔ Δήλωσε', '#0d7a3e', '#e6f6ec'], exc: ['⚠ Δικαιολογημένη απουσία', '#b45309', '#fff1e0'], pending: ['✖ Δεν έχει δηλώσει', '#c01d1d', '#fdecec'] };
  const rowHtml = (x, i, kind = 'o') => {
    const [lab, col, bg] = ST[x.status] || ['➕ Πρόσθετος παραλήπτης', '#244d80', '#eef4fb'];
    return `<tr style="background:${bg}"><td><input type="checkbox" class="cf-pick" data-k="${kind}" data-i="${i}"${x.emails.length ? '' : ' disabled'}${(x.status === 'pending' || kind === 'x') && x.emails.length ? ' checked' : ''}></td>
<td><b>${esc(x.name)}</b>${x.title ? `<br><small class="muted">${esc(x.title)}</small>` : ''}</td><td style="color:${col};font-weight:700">${lab}${x.reason ? `<br><small style="font-weight:400">${esc(x.reason)}</small>` : ''}</td>
<td>${x.emails.length ? x.emails.map(esc).join('<br>') : `<span class="warn">— χωρίς email${x.inRegistry === false ? ' (δεν βρέθηκε στο Μητρώο)' : ' στο Μητρώο'}</span>`}</td></tr>`;
  };
  return {
    title: 'Κέρκυρα — Υπενθύμιση ΜΑΞ',
    html: `<h1>🚌 Κέρκυρα 2026 — Υπενθύμιση σε όσους δεν δήλωσαν</h1>
${err ? `<p class="warn">${esc(err)}</p>` : ''}
<p class="muted">Πηγή: ${esc(src)} · <b>${rows.length}</b> εν ενεργεία · <span style="color:#0d7a3e">δήλωσαν: <b>${n('ok')}</b></span> · <span style="color:#b45309">δικαιολογημένα απόντες: <b>${n('exc')}</b></span> ·
<b style="color:#c01d1d">δεν δήλωσαν: ${n('pending')}</b>${noMail.length ? ` · <span class="warn">χωρίς email: ${noMail.map((x) => esc(x.name)).join(', ')}</span>` : ''}.
<a href="corfu-2026/" target="_blank" rel="noopener">Λίστα δηλώσεων ↗</a> · <a href="corfu-2026/#max" target="_blank" rel="noopener">Πινάκιο ΜΑΞ ↗</a></p>
<p class="muted">Προεπιλογή: όσοι <b>δεν έχουν δηλώσει</b>. Με τα κουτάκια βάζετε ή βγάζετε όποιον θέλετε (και όσους δήλωσαν ή απουσιάζουν)· χρησιμοποιούνται <b>όλα</b> τα email του από το Μητρώο.</p>
<div class="card tablecard"><table><thead><tr><th><input type="checkbox" id="cfAll" aria-label="Όλοι όσοι δεν δήλωσαν" checked></th><th>Μέγας Αξιωματικός</th><th>Κατάσταση</th><th>Email (Μητρώο / δήλωση)</th></tr></thead>
<tbody id="cfRows">${rows.map((x, i) => rowHtml(x, i)).join('') || '<tr><td colspan="4" class="warn">Δεν βρέθηκε κατάλογος εν ενεργεία Μεγάλων Αξιωματικών.</td></tr>'}</tbody>
<tbody id="cfExtra"></tbody></table>
<div style="padding:10px 12px"><label>➕ Προσθήκη παραλήπτη από το Μητρώο<input id="cfAdd" placeholder="🔎 Επώνυμο, όνομα ή email μέλους…" autocomplete="off"></label></div></div>
<div class="card"><label>Θέμα<input id="cfSubj" value="${esc(REMIND_SUBJECT)}"></label><label style="margin-top:8px">Κείμενο<textarea id="cfBody" rows="18">${esc(REMIND_BODY)}</textarea></label>
<div id="cfWho" class="card" style="margin:10px 0;background:#f8fafc"></div>
<p class="muted">Αποστολή από <b>${esc(senderFor('general'))}</b> · ένα email, <b>όλοι σε Bcc</b> (δεν βλέπει ο ένας τη διεύθυνση του άλλου) · πριν φύγει εμφανίζεται προεπισκόπηση για επιβεβαίωση.</p>
<div class="toolbar"><button class="btn primary big" data-act="send">📤 Αποστολή υπενθύμισης σε <span id="cfN">0</span></button>
<button class="btn big" data-act="draft">✉ Πρόχειρο στο Gmail (έλεγχος πριν την αποστολή)</button></div><div id="cfState" class="muted" style="margin-top:8px"></div></div>`,
    mount(el) {
      const pick = (k, i) => (k === 'x' ? extra : rows)[Number(i)];
      const picked = () => [...el.querySelectorAll('.cf-pick:checked')].map((c) => pick(c.dataset.k, c.dataset.i)).filter((x) => x && x.emails.length);
      const refresh = () => {
        const p = picked(), mails = uniq(p.flatMap((x) => x.emails));
        el.querySelector('#cfN').textContent = p.length;
        el.querySelector('#cfWho').innerHTML = p.length
          ? `<b>Θα σταλεί σε ${p.length} (${mails.length} email):</b><br>${p.map((x) => `${esc(x.name)} <small class="muted">${esc(x.emails.join(', '))}</small>`).join('<br>')}`
          : '<span class="warn">Δεν έχει επιλεγεί κανείς.</span>';
      };
      el.addEventListener('change', (e) => {
        if (e.target.id === 'cfAll') for (const c of el.querySelectorAll('.cf-pick[data-k="o"]:not(:disabled)')) { const x = rows[Number(c.dataset.i)]; if (x.status === 'pending') c.checked = e.target.checked; }
        refresh();
      });
      import('../core/pickers.js').then(({ attachPicker, memberItems }) => attachPicker(el.querySelector('#cfAdd'), memberItems, (it) => {
        const m = it.value, p = person(m.id), name = `${m.surname || ''} ${m.first_name || ''}`.trim();
        if (extra.some((x) => x.memberId === (p ? p.id : m.id)) || rows.some((x) => x.memberId && p && x.memberId === p.id)) { toast('Είναι ήδη στη λίστα — επιλέξτε το κουτάκι του.', 'error'); return; }
        extra.push({ name, title: '', status: 'extra', reason: '', emails: uniq(p ? p.emails : [m.email]), memberId: p ? p.id : m.id, inRegistry: true });
        el.querySelector('#cfExtra').innerHTML = extra.map((x, i) => rowHtml(x, i, 'x')).join('');
        el.querySelector('#cfAdd').value = ''; refresh();
      }));
      refresh();
      const msg = () => ({ to: senderFor('general'), bcc: uniq(picked().flatMap((x) => x.emails)).join(', '), subject: el.querySelector('#cfSubj').value.trim(), body: el.querySelector('#cfBody').value });
      const state = (h) => { el.querySelector('#cfState').innerHTML = h; };
      const ready = async () => {
        if (!picked().length) { toast('Δεν επιλέχθηκε κανείς με email.', 'error'); return null; }
        const { driveReady } = await import('../core/drive.js');
        if (!driveReady()) { state('<span class="warn">Για αποστολή από την εφαρμογή χρειάζεται το Google Client ID (Ρυθμίσεις → Google).</span>'); return null; }
        return import('../core/gmail.js');
      };
      bind(el, {
        async send() {
          const g = await ready(); if (!g) return;
          const m = msg(), names = picked().map((x) => x.name);
          if (!await g.confirmSend({ from: senderFor('general'), msg: m, note: `Θα σταλεί ένα email σε ${names.length} (Bcc): ${names.join(', ')}.` })) return;
          state('⏳ Αποστολή…');
          try { await g.sendNow(m, [], 'general'); state(`<span style="color:#0d7a3e"><b>✓ Στάλθηκε</b> σε ${names.length}: ${esc(names.join(', '))}.</span>`); toast('✓ Η υπενθύμιση στάλθηκε.'); }
          catch (e) { state(`<span class="warn">${esc(e.message || e)}</span>`); }
        },
        async draft() {
          const g = await ready(); if (!g) return;
          try { const d = await g.createDraft(msg(), [], 'general'); state(`✓ Δημιουργήθηκε Πρόχειρο. <a href="${esc(g.draftWebUrl('general', d.messageId))}" target="_blank" rel="noopener">Άνοιγμα στο Gmail ↗</a>`); }
          catch (e) { state(`<span class="warn">${esc(e.message || e)}</span>`); }
        },
      });
    },
  };
}

// Πλακίδιο Αρχικής (17ο): Μεγάλη Συνέλευση 19 Δεκεμβρίου 2026 — δηλώσεις, Πινάκια, υπενθύμιση (οι αριθμοί φορτώνονται ζωντανά)
async function glRefresh() {
  const box = document.querySelector('[data-tile="grand-lodge-2026"] .gl-live');
  if (!box) return;
  try {
    const [a, o, x] = await Promise.all(['corfu-2026/attendees.json', 'corfu-2026/active-officers.json', 'corfu-2026/excused.json'].map((u) => getJson(u).catch(() => ({}))));
    const rows = remindRows(a.attendees || [], o.officers || [], x.excused || []), c = (s) => rows.filter((r) => r.status === s).length;
    const sum = document.querySelector('[data-tile="grand-lodge-2026"] > summary');
    if (sum) { let b = sum.querySelector('.dnum'); if (!b) { b = document.createElement('span'); b.className = 'dnum'; sum.querySelector('.caret').before(b); } b.textContent = String((a.attendees || []).length); b.title = `${(a.attendees || []).length} δηλώσεις μετακίνησης · ${c('pending')} ΜΑΞ δεν δήλωσαν`; }
    box.innerHTML = `<div class="big">${(a.attendees || []).length} δηλώσεις μετακίνησης</div><small class="muted">ΜΑΞ: <b style="color:#0d7a3e">${c('ok')} δήλωσαν</b> · <b style="color:#b45309">${c('exc')} απόντες</b> · <b style="color:#c01d1d">${c('pending')} δεν δήλωσαν</b> (από ${rows.length})</small>`;
  } catch { box.innerHTML = '<small class="muted">Δεν φορτώθηκαν τα στοιχεία.</small>'; }
}
const glTile = () => { setTimeout(glRefresh, 0); return `<div class="dtile gold" data-tile="grand-lodge-2026"><h3><a href="corfu-2026/" target="_blank" rel="noopener">🏛 Μεγάλη Συνέλευση 19 Δεκεμβρίου 2026</a></h3>
<div class="gl-live"><div class="big">…</div><small class="muted">Κέρκυρα · Μετακίνηση & Διαμονή ΜΑΞ</small></div>
<div class="acts"><a class="btn primary" href="corfu-2026/" target="_blank" rel="noopener">📋 Πινάκιο δηλωσάντων</a><a class="btn" href="corfu-2026/#max" target="_blank" rel="noopener">🏛 Πινάκιο ΜΑΞ</a><a class="btn" href="#/corfu">📧 Υπενθύμιση σε όσους δεν δήλωσαν</a></div></div>`; };

module({ id: 'corfu-remind', routes: { '/corfu': page }, tile: { order: 96, render: glTile } });
