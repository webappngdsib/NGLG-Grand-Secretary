// Κέρκυρα 2026 — Ευγενική Υπενθύμιση σε όσους εν ενεργεία Μεγάλους Αξιωματικούς δεν έχουν δηλώσει μετακίνηση/διαμονή.
// Δηλώσεις: corfu-2026/attendees.json (δημόσια λίστα). Εν ενεργεία ΜΑΞ: Επετηρίδα (publicOfficers, χωρίς «Πρώην»).
// Email: από το Μητρώο (identify → person). Ένα μήνυμα, όλοι σε Bcc, με προεπισκόπηση και επιβεβαίωση πριν φύγει.
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

// Αντιστοίχιση ονομάτων δηλώσεων ↔ Επετηρίδας (ίδιος κανόνας με τη σελίδα corfu-2026/: επώνυμο + όνομα, και υποκοριστικά)
const NICK = { ΤΑΣΟΣ: 'ΑΝΑΣΤΑΣΙΟΣ', ΑΝΑΣΤΑΣΗΣ: 'ΑΝΑΣΤΑΣΙΟΣ', ΝΑΣΟΣ: 'ΑΘΑΝΑΣΙΟΣ', ΘΑΝΑΣΗΣ: 'ΑΘΑΝΑΣΙΟΣ', ΘΑΝΟΣ: 'ΑΘΑΝΑΣΙΟΣ', ΦΩΤΗΣ: 'ΦΩΤΙΟΣ', ΝΙΚΟΣ: 'ΝΙΚΟΛΑΟΣ',
  ΣΠΥΡΟΣ: 'ΣΠΥΡΙΔΩΝ', ΓΙΑΝΝΗΣ: 'ΙΩΑΝΝΗΣ', ΓΙΩΡΓΟΣ: 'ΓΕΩΡΓΙΟΣ', ΚΩΣΤΑΣ: 'ΚΩΝΣΤΑΝΤΙΝΟΣ', ΝΤΙΝΟΣ: 'ΚΩΝΣΤΑΝΤΙΝΟΣ', ΔΗΜΗΤΡΗΣ: 'ΔΗΜΗΤΡΙΟΣ', ΤΑΚΗΣ: 'ΔΗΜΗΤΡΙΟΣ',
  ΜΙΧΑΛΗΣ: 'ΜΙΧΑΗΛ', ΠΑΝΟΣ: 'ΠΑΝΑΓΙΩΤΗΣ', ΒΑΣΙΛΗΣ: 'ΒΑΣΙΛΕΙΟΣ', ΑΝΤΩΝΗΣ: 'ΑΝΤΩΝΙΟΣ', ΘΟΔΩΡΗΣ: 'ΘΕΟΔΩΡΟΣ', ΑΛΕΞΗΣ: 'ΑΛΕΞΑΝΔΡΟΣ', ΜΑΝΟΣ: 'ΕΜΜΑΝΟΥΗΛ',
  ΜΑΝΩΛΗΣ: 'ΕΜΜΑΝΟΥΗΛ', ΛΕΥΤΕΡΗΣ: 'ΕΛΕΥΘΕΡΙΟΣ', ΣΤΕΛΙΟΣ: 'ΣΤΥΛΙΑΝΟΣ', ΣΤΑΘΗΣ: 'ΕΥΣΤΑΘΙΟΣ', ΓΡΗΓΟΡΗΣ: 'ΓΡΗΓΟΡΙΟΣ', ΧΑΡΗΣ: 'ΧΑΡΑΛΑΜΠΟΣ', ΣΩΤΗΡΗΣ: 'ΣΩΤΗΡΙΟΣ' };
const toks = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleUpperCase('el-GR').replace(/\([^)]*\)/g, ' ').split(/[^A-ZΑ-Ω]+/u).filter((t) => t.length > 1);
const canon = (t) => NICK[t] || t;
function matchKind(att, offName) {
  const ot = toks(offName); if (ot.length < 2) return '';
  const sur = ot[0], first = ot.slice(1), at = toks(att.name);
  if (!at.includes(sur)) return '';
  const rest = at.filter((t) => t !== sur);
  return rest.some((a) => first.some((f) => canon(a) === canon(f) || (a.length > 3 && f.length > 3 && a.slice(0, 4) === f.slice(0, 4)))) ? 'full' : 'surname';
}
// → [{ name, title, declared, email, memberId }] σε τάξη προβαδίσματος
export function remindRows(attendees, officers = publicOfficers()) {
  const act = officers.filter((o) => !/^Πρώην/.test(String(o.group || o.title || '').trim()));
  const surCount = {}; for (const o of act) { const s = toks(o.name)[0]; surCount[s] = (surCount[s] || 0) + 1; }
  const used = new Set();
  return act.map((o) => {
    let hit = attendees.find((r) => !used.has(r) && matchKind(r, o.name) === 'full');
    if (!hit && surCount[toks(o.name)[0]] === 1) hit = attendees.find((r) => !used.has(r) && matchKind(r, o.name) === 'surname');
    if (hit) used.add(hit);
    const id = identify({ full_name: o.name }), p = id ? person(id) : null;
    return { name: o.name, title: o.title, declared: !!hit, email: (p && p.email) || '', memberId: p ? p.id : null };
  });
}

async function page() {
  let attendees = [], err = '';
  try {
    const r = await fetch('corfu-2026/attendees.json?fresh=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    attendees = (await r.json()).attendees || [];
  } catch (e) { err = `Δεν φορτώθηκε η λίστα δηλώσεων (${e.message || e}).`; }
  const rows = remindRows(attendees), todo = rows.filter((x) => !x.declared), noMail = todo.filter((x) => !x.email);
  return {
    title: 'Κέρκυρα — Υπενθύμιση ΜΑΞ',
    html: `<h1>🚌 Κέρκυρα 2026 — Υπενθύμιση σε όσους δεν δήλωσαν</h1>
${err ? `<p class="warn">${esc(err)}</p>` : ''}
<p class="muted">Εν ενεργεία Μεγάλοι Αξιωματικοί (Επετηρίδα): <b>${rows.length}</b> · δήλωσαν μετακίνηση/διαμονή: <b>${rows.length - todo.length}</b> · <b style="color:#c01d1d">δεν δήλωσαν: ${todo.length}</b>${noMail.length ? ` · <span class="warn">χωρίς email στο Μητρώο: ${noMail.length}</span>` : ''}.
Η λίστα δηλώσεων: <a href="corfu-2026/" target="_blank" rel="noopener">corfu-2026 ↗</a> · <a href="corfu-2026/#max" target="_blank" rel="noopener">Πινάκιο ΜΑΞ ↗</a></p>
<div class="card tablecard"><table><thead><tr><th><input type="checkbox" id="cfAll" checked aria-label="Όλοι"></th><th>Ονοματεπώνυμο</th><th>Αξίωμα</th><th>Email (Μητρώο)</th></tr></thead><tbody>
${todo.map((x, i) => `<tr><td><input type="checkbox" class="cf-pick" data-i="${i}"${x.email ? ' checked' : ' disabled'}></td><td><b>${esc(x.name)}</b></td><td>${esc(x.title)}</td>
<td>${x.email ? esc(x.email) : '<span class="warn">— χωρίς email στο Μητρώο</span>'}</td></tr>`).join('') || (rows.length ? '<tr><td colspan="4" class="muted">Όλοι οι εν ενεργεία έχουν δηλώσει. 🎉</td></tr>' : '<tr><td colspan="4" class="warn">Δεν βρέθηκαν εν ενεργεία Μεγάλοι Αξιωματικοί στην Επετηρίδα της εφαρμογής (Μέλη → Επετηρίδα → εισαγωγή καταλόγου).</td></tr>')}
</tbody></table></div>
<div class="card"><label>Θέμα<input id="cfSubj" value="${esc(REMIND_SUBJECT)}"></label><label style="margin-top:8px">Κείμενο<textarea id="cfBody" rows="18">${esc(REMIND_BODY)}</textarea></label>
<p class="muted">Αποστολή από <b>${esc(senderFor('general'))}</b> · ένα email, <b>όλοι σε Bcc</b> (δεν βλέπει ο ένας τη διεύθυνση του άλλου) · πριν φύγει εμφανίζεται προεπισκόπηση για επιβεβαίωση.</p>
<div class="toolbar"><button class="btn primary big" data-act="send" id="cfSend">📤 Αποστολή υπενθύμισης σε <span id="cfN">${todo.filter((x) => x.email).length}</span></button>
<button class="btn big" data-act="draft">✉ Πρόχειρο στο Gmail (έλεγχος πριν την αποστολή)</button></div><div id="cfState" class="muted" style="margin-top:8px"></div></div>`,
    mount(el) {
      const picked = () => [...el.querySelectorAll('.cf-pick:checked')].map((c) => todo[Number(c.dataset.i)]).filter((x) => x && x.email);
      const count = () => { el.querySelector('#cfN').textContent = picked().length; };
      el.addEventListener('change', (e) => {
        if (e.target.id === 'cfAll') for (const c of el.querySelectorAll('.cf-pick:not(:disabled)')) c.checked = e.target.checked;
        count();
      });
      const msg = () => {
        const from = senderFor('general');
        return { to: from, bcc: picked().map((x) => x.email).join(', '), subject: el.querySelector('#cfSubj').value.trim(), body: el.querySelector('#cfBody').value };
      };
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
          if (!await g.confirmSend({ from: senderFor('general'), msg: m, note: `Θα σταλεί ένα email σε ${names.length} Μεγάλους Αξιωματικούς (Bcc): ${names.join(', ')}.` })) return;
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

module({ id: 'corfu-remind', routes: { '/corfu': page } });
