// Ενδυμασία του Διατάγματος: για κάθε Διάταγμα με ΕΝΑΝ Αδελφό, σελίδα με την ενδυμασία του τίτλου / αξιώματος που του δίνει το Διάταγμα,
// από τον Οδηγό Ενδυμασίας της ΕΜΣτΕ (https://webappngdsib.github.io/NGLG-DRESS-CODE/ — ανοίγει απευθείας στον βαθμό με ?category=&role=).
// Όπως κάθε έντυπο: προβολή, PDF / εκτύπωση, αποστολή με email (σύνδεσμος) και WhatsApp.
import { db } from '../core/store.js';
import { module, bind, toast } from '../core/app.js';
import { esc } from '../core/util.js';
import { mailButtons, senderBanner } from '../core/mail.js';
import { decreeKey } from './decree-templates.js';
import { decreeMeta, decreePeople } from './decree-sync.js';
import { officeOf } from './decree-intent.js';
import { DEC_MAP } from './decree-catalog.js';

// Μεγάλη Στοά στον Οδηγό Ενδυμασίας: όλα τα αξιώματα του Κανόνα 5 (θέση προβαδίσματος → id του Οδηγού)
const GRAND_BY_RANK = { 1: 'gm', 2: 'pro_gm', 5: 'deputy_gm', 7: 'assistant_gm', 13: 'sgw', 15: 'jgw', 17: 'grand_chaplain', 19: 'president_bgp', 21: 'grand_registrar', 23: 'grand_secretary',
  25: 'grand_chancellor', 27: 'grand_sec_instruction', 29: 'grand_treasurer', 31: 'president_charity', 33: 'grand_doc', 35: 'grand_sword_bearer', 37: 'grand_works', 39: 'grand_inspector',
  41: 'deputy_grand_secretary', 43: 'deputy_grand_chancellor', 45: 'deputy_grand_doc', 47: 'grand_librarian', 49: 'sgd', 51: 'jgd', 53: 'assistant_grand_chancellor', 55: 'assistant_grand_secretary',
  57: 'grand_regalia', 59: 'grand_organist', 61: 'grand_standard_bearer', 63: 'grand_pursuivant', 65: 'grand_steward_year', 66: 'grand_tyler' };
export const DRESS_CODE_URL = 'https://webappngdsib.github.io/NGLG-DRESS-CODE/';
const PROVINCIAL = /^(Επαρχιακός|Περιφερειακός) Μέγας Διδάσκαλος$/;
// Αξίωμα του Διατάγματος → [κατηγορία, βαθμός] του Οδηγού Ενδυμασίας (assets/catalog.js)
export function dressRole(d, a = decreePeople(d)[0] || {}) {
  const m = decreeMeta(d);
  if (m.action === 'service_award') return ['grand', 'grand_officer'];
  if (m.action === 'award') {
    const o = m.award_office || '';
    if (o === 'Μέγας Διδάσκαλος') return ['past', 'past_gm'];
    if (PROVINCIAL.test(o)) return ['past', 'past_pgm'];
    if (/^Αντικαταστάτης (Επαρχιακός|Περιφερειακός)/.test(o)) return ['past', 'past_prov_officer'];
    if (o === 'Σεβάσμιος Διδάσκαλος') return ['craft', 'past_wm'];
    return ['past', 'past_grand_officer'];
  }
  const o = a.office || m.decree_office || '';
  if (o === 'Μέγας Διδάσκαλος') return ['grand', 'gm'];
  if (o === 'Μέγας Γραμματεύς') return ['grand', 'grand_secretary'];
  // Μεγάλοι Επιμεληταί: Σεβάσμιος (με προσφώνηση Σεβ./ΛΣεβ./Πσεβ./Σεβτ.) → περίζωμα με τα τρία Ταυ, αλλιώς Αδελφός → περίζωμα με ρόδακες
  if (/^Μέγας Επιμελητής/.test(o)) return ['stewards', /Σεβ/.test(a.honorific || '') ? 'steward_wm' : 'steward_bro'];
  if (PROVINCIAL.test(o)) return ['province', 'pgm'];
  if (/^Αντικαταστάτης (Επαρχιακός|Περιφερειακός)/.test(o)) return ['province', 'prov_officer'];
  const id = GRAND_BY_RANK[(DEC_MAP[o] || {}).precedence];
  return ['grand', id || 'grand_officer'];
}
// Μόνο Διατάγματα με έναν Αδελφό (όχι Γενικά)
export const hasDress = (d) => !!d && decreeKey(d) !== 'decree-general' && decreePeople(d).length === 1;
const personName = (a) => `${a.honorific ? a.honorific + ' ' : ''}${a.first_name || ''} ${a.last_name || ''}`.replace(/\s+/g, ' ').trim();
export function dressUrl(d, { embed = false } = {}) {
  const a = decreePeople(d)[0] || {}, [category, role] = dressRole(d, a);
  const q = new URLSearchParams({ category, role, name: personName(a), title: `${officeOf(d, a).nom} — Διάταγμα ${d.decree_no}/${d.decree_year}` });
  if (embed) q.set('embed', '1');
  return `${DRESS_CODE_URL}?${q}`;
}

function dressPage({ params }) {
  const d = db.get('decree_documents', params.id);
  if (!d) return '<h1>Δεν βρέθηκε το Διάταγμα</h1>';
  const no = `${d.decree_no}/${d.decree_year}`;
  if (!hasDress(d)) return { title: 'Ενδυμασία', html: `<h1>👔 Ενδυμασία</h1><p class="muted">Η σελίδα ενδυμασίας υπάρχει για Διατάγματα με έναν Αδελφό· το Διάταγμα ${esc(no)} έχει ${decreePeople(d).length}.</p><a class="btn" href="#/decrees/${d.id}">Το Διάταγμα</a>` };
  const a = decreePeople(d)[0], off = officeOf(d, a).nom, url = dressUrl(d), who = personName(a);
  const subject = `Ενδυμασία — ${off} (Διάταγμα ${no})`;
  const body = `${who ? `Προς ${who},\n\n` : ''}Σας αποστέλλουμε τον οδηγό ενδυμασίας για τον τίτλο / το αξίωμα «${off}» (Διάταγμα ${no}):\n${url}\n\nΣτη σελίδα υπάρχει κουμπί «Εκτύπωση / PDF».\n\nΜε αδελφικούς χαιρετισμούς,\nΜεγάλη Γραμματεία ΕΜΣτΕ`;
  const wa = 'https://wa.me/?text=' + encodeURIComponent(`${subject}\n${url}`);
  return {
    title: `Ενδυμασία — Διάταγμα ${no}`,
    html: `<section class="card send-panel noprint"><h3>👔 Ενδυμασία — ${esc(who)} · ${esc(off)}</h3>${senderBanner('official')}
<div class="toolbar"><button class="btn primary" data-act="pdf">⬇ PDF / Εκτύπωση</button>${mailButtons({ to: a.email ? [a.email] : [], subject, body, kind: 'official' }, '✉ Αποστολή με Email')}
<a class="btn" target="_blank" rel="noopener" href="${esc(wa)}">WhatsApp μήνυμα</a><button class="btn" data-act="copy">📋 Αντιγραφή συνδέσμου</button><a class="btn" target="_blank" rel="noopener" href="${esc(url)}">↗ Άνοιγμα στον Οδηγό Ενδυμασίας</a></div>
<p class="send-help">Οδηγός Ενδυμασίας ΕΜΣτΕ: <a href="${DRESS_CODE_URL}" target="_blank" rel="noopener">${DRESS_CODE_URL}</a> · βαθμός στον Οδηγό: <b>${esc(dressRole(d, a).join(' / '))}</b></p></section>
<div class="toolbar noprint"><a class="btn" href="#/decrees/${d.id}">Το Διάταγμα</a><a class="btn" href="#/decrees/${d.id}/intent">📨 Πρόθεση</a><a class="btn" href="#/decrees">Αρχείο Διαταγμάτων</a></div>
<iframe class="dress-frame" title="Ενδυμασία ${esc(off)}" src="${esc(dressUrl(d, { embed: true }))}" style="width:100%;max-width:680px;height:1000px;border:1px solid #e3e6ee;border-radius:10px;display:block;margin:0 auto;background:#fff"></iframe>`,
    mount(el) {
      bind(el, {
        pdf() { // ίδια διεύθυνση (github.io): εκτύπωση της ενσωματωμένης σελίδας· αλλιώς άνοιγμα σε νέα καρτέλα με το δικό της «Εκτύπωση / PDF»
          const f = el.querySelector('.dress-frame');
          try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(url, '_blank', 'noopener'); }
        },
        async copy() { try { await navigator.clipboard.writeText(url); toast('Ο σύνδεσμος αντιγράφηκε.'); } catch { toast('Δεν επιτράπηκε η αντιγραφή.', 'error'); } },
      });
    },
  };
}

// Πλακίδιο 15 της αρχικής (μετά την Πύλη): ο Οδηγός Ενδυμασίας και τα Διατάγματα με έναν Αδελφό (σελίδα «Ενδυμασία»)
function dressTile() {
  const ds = db.all('decree_documents').filter(hasDress).sort((a, b) => (Number(b.decree_year) || 0) - (Number(a.decree_year) || 0) || (Number(b.decree_no) || 0) - (Number(a.decree_no) || 0));
  const last = ds[0];
  return `<div class="dtile dress-tile"><h3><a href="${DRESS_CODE_URL}" target="_blank" rel="noopener">👔 Ενδυμασία</a></h3><div class="big">${ds.length} Διατάγματα</div>
<div class="muted">Οδηγός Τεκτονικής Περιβολής ΕΜΣτΕ — ανά βαθμό και αξίωμα, με εκτύπωση / PDF${last ? ` · τελευταίο: <a href="#/decrees/${last.id}/dress">${esc(`${last.decree_no}/${last.decree_year}`)}</a>` : ''}</div>
<div class="acts"><a class="btn primary" href="${DRESS_CODE_URL}" target="_blank" rel="noopener">Οδηγός Ενδυμασίας ↗</a><a class="btn" href="#/decrees">Διατάγματα</a></div></div>`;
}

module({ id: 'decree-dress', routes: { '/decrees/:id/dress': dressPage }, tile: { order: 95, render: dressTile } });
