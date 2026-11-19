// «Πρόθεση Διορισμού – Απονομής»: για κάθε Αδελφό ενός Διατάγματος (ΔΙΟΡΙΖΟΜΕΝ / ΑΠΟΝΕΜΕΙ / ΤΜΔ) η επιστολή που του γνωστοποιεί
// την πρόθεση του Μεγάλου Διδασκάλου, με τα τέλη (Κανόνας 270) και σημείωμα αποδοχής. Το κείμενο αλλάζει δυναμικά ανάλογα με το
// Διάταγμα (αξίωμα, πράξη, τεκτονικό έτος) και το «Είδος πρόθεσης» κάθε Αδελφού (προτείνεται αυτόματα από την Επετηρίδα και αλλάζει).
// Οι επιλογές φυλάσσονται στο ίδιο το Διάταγμα (πεδίο intent) — η σελίδα ανοίγει από το Αρχείο Διαταγμάτων («📨 Πρόθεση»).
import { db } from '../core/store.js';
import { module, go, flash, bind, toast, table } from '../core/app.js';
import { esc, today, safeFileName } from '../core/util.js';
import { letterPaper, printPaper } from '../core/paper.js';
import { mailButtons } from '../core/mail.js';
import { AWARD_MAP } from './decree-catalog.js';
import { decreeMeta, decreePeople } from './decree-sync.js';
import { gmName } from './letter-fill.js';
import { identify } from '../core/people.js';

// Είδη πρόθεσης (πίνακας της Μεγάλης Γραμματείας): ρήμα επιστολής, φράση αποδοχής, τέλη, Κανόνας, Αγγλικά
export const INTENT_TYPES = {
  1: { label: 'Διορισμός', verb: 'διορίσει εις την θέσιν του', accept: 'τον διορισμό μου εις την θέση του', fee: 80, rule: 'Κανόνας 270.2 - επαναδιορισμός', en: 'appoint you to the office of', kind: 'appoint' },
  2: { label: 'Επαναδιορισμός', verb: 'επαναδιορίσει εις την θέσιν του', accept: 'τον επαναδιορισμό μου εις την θέσιν του', fee: 80, rule: 'Κανόνας 270.2 - επαναδιορισμός', en: 'reappoint you to the office of', kind: 'appoint' },
  3: { label: 'Διορισμός πρώτη φορά', verb: 'διορίσει πρώτη φορά εις την θέσιν του', accept: 'τον διορισμό μου εις την θέση του', fee: 150, rule: 'Κανόνας 270.1 - πρώτος διορισμός', en: 'appoint you to the office of', kind: 'appoint' },
  4: { label: 'Προαγωγή', verb: 'προάγει εις την θέσιν του', accept: 'την προαγωγή μου εις την θέσιν του', fee: 80, rule: 'Κανόνας 270.2 - προαγωγή', en: 'promote you to the office of', kind: 'appoint' },
  5: { label: 'Απονομή αξιώματος (Πρώην)', verb: 'απονείμει το αξίωμα του', accept: 'την απονομή προς εμέ του αξιώματος του', fee: 80, rule: 'Κανόνας 270.2 - απονομή Πρώην Μ.Αξ.', en: 'confer on you the rank of', kind: 'award' },
  6: { label: 'Απονομή Τ.Μ.Δ.', verb: 'απονείμει την διάκριση εις την', accept: 'την τιμητική διάκριση εις την', fee: 50, rule: 'Κανόνας 270.8 - απονομή Τ.Μ.Δ.', en: 'confer on you', kind: 'service_award' },
  7: { label: 'Απονομή αξιώματος πρώτη φορά', verb: 'απονείμει διά πρώτην φοράν το αξίωμα του', accept: 'την απονομή προς εμέ του αξιώματος του', fee: 150, rule: 'Κανόνας 270.2 - απονομή 1η φορά', en: 'confer on you the rank of', kind: 'award' },
  8: { label: 'Ευχαριστίες (αποχώρηση)', thanks: true, kind: 'any' },
};
const TMD = 'Τάξιν του Μεγάλου Διδασκάλου δι’ Υπηρεσίας προς την Τεκτονικήν';
// Γενική των αξιωμάτων που δεν έχουν «Πρώην» στον κατάλογο
const GEN_EXTRA = { 'Μέλος Συμβουλίου Γενικών Υποθέσεων': 'Μέλους του Συμβουλίου Γενικών Υποθέσεων', 'Ψηφολέκτης – εκλογή Μεγάλου Θησαυροφύλακος': 'Ψηφολέκτου για την εκλογή του Μεγάλου Θησαυροφύλακος',
  'Ψηφολέκτης – λοιπές ψηφοφορίες': 'Ψηφολέκτου για τις λοιπές ψηφοφορίες', 'Μέλος Πειθαρχικής Επιτροπής / Καταλόγου Δευτεροβαθμίου Πειθαρχικού Συμβουλίου': 'Μέλους της Πειθαρχικής Επιτροπής' };
export const officeGen = (o) => GEN_EXTRA[o] || String(AWARD_MAP[o] || o).replace(/^Πρώην /, '');
// Αγγλικός τίτλος (Grand Lodge of England ονοματολογία, όπως στον πίνακα της Μεγάλης Γραμματείας)
export const OFFICE_EN = { 'Μέγας Διδάσκαλος': 'Grand Master', 'Αντικαταστάτης Μέγας Διδάσκαλος': 'Pro Grand Master', 'Αναπληρωτής Μέγας Διδάσκαλος': 'Deputy Grand Master', 'Βοηθός Μέγας Διδάσκαλος': 'Assistant Grand Master',
  'Επαρχιακός Μέγας Διδάσκαλος': 'Provincial Grand Master', 'Περιφερειακός Μέγας Διδάσκαλος': 'District Grand Master', 'Αντικαταστάτης Επαρχιακός Μέγας Διδάσκαλος': 'Deputy Provincial Grand Master',
  'Αντικαταστάτης Περιφερειακός Μέγας Διδάσκαλος': 'Deputy District Grand Master', 'Πρώτος Μέγας Επόπτης': 'Senior Grand Warden', 'Δεύτερος Μέγας Επόπτης': 'Junior Grand Warden', 'Μέγας Ευχέτης': 'Grand Chaplain',
  'Πρόεδρος του Συμβουλίου Γενικών Υποθέσεων': 'President of the Board of General Purposes', 'Μέγας Νομοφύλαξ': 'Grand Registrar', 'Μέγας Γραμματεύς': 'Grand Secretary', 'Μέγας Καγκελάριος': 'Grand Chancellor',
  'Μέγας Γραμματεύς Εκπαιδεύσεως': 'Grand Secretary of Instruction', 'Μέγας Θησαυροφύλαξ': 'Grand Treasurer', 'Πρόεδρος του Μεγάλου Αγαθοεργού Σώματος': 'President of the Masonic Charitable Foundation',
  'Μέγας Τελετάρχης': 'Grand Director of Ceremonies', 'Μέγας Ξιφοφόρος': 'Grand Sword Bearer', 'Μέγας Επίτροπος των Έργων': 'Grand Superintendent of Works', 'Μέγας Επιθεωρητής Περιοχής': 'Grand Inspector of Area',
  'Αναπληρωτής Μέγας Γραμματεύς': 'Deputy Grand Secretary', 'Αναπληρωτής Μέγας Καγκελάριος': 'Deputy Grand Chancellor', 'Αναπληρωτής Μέγας Τελετάρχης': 'Deputy Grand Director of Ceremonies',
  'Μέγας Έφορος Βιβλιοθήκης και Μουσείου': 'Grand Superintendent of Museum and Library', 'Πρώτος Μέγας Διάκονος': 'Senior Grand Deacon', 'Δεύτερος Μέγας Διάκονος': 'Junior Grand Deacon',
  'Βοηθός Μέγας Καγκελάριος': 'Assistant Grand Chancellor', 'Βοηθός Μέγας Γραμματεύς': 'Assistant Grand Secretary', 'Μέγας Έφορος επί των Διασήμων': 'Grand Superintendent of Jewels and Regalia',
  'Μέγας Οργανιστής': 'Grand Organist', 'Μέγας Σημαιοφόρος': 'Grand Standard Bearer', 'Μέγας Προσαγωγεύς': 'Grand Pursuivant', 'Μέγας Επιμελητής του Έτους': 'Grand Steward of the Year', 'Μέγας Στεγαστής': 'Grand Tyler' };
const VOC = { 'Σεβτ. Αδ.': 'Σεβασμιώτατε Αδελφέ', 'Πσεβ. Αδ.': 'Πανσεβάσμιε Αδελφέ', 'ΛΣεβ. Αδ.': 'Λίαν Σεβάσμιε Αδελφέ', 'Σεβ. Αδ.': 'Σεβάσμιε Αδελφέ' };
const EN_HON = { 'Σεβτ. Αδ.': 'MW Bro', 'Πσεβ. Αδ.': 'RW Bro', 'ΛΣεβ. Αδ.': 'VW Bro', 'Σεβ. Αδ.': 'WM Bro' };

// Γενική ονόματος (Ιωάννης Μπενετάτος → Ιωάννη Μπενετάτου)
const genName = (n) => String(n).split(/\s+/).map((w) => w.replace(/ος$/, 'ου').replace(/ης$/, 'η').replace(/ας$/, 'α')).join(' ');
const dot = (t) => (/\.$/.test(t) ? t : t + '.');
const parse = (v, f) => { try { return typeof v === 'string' ? JSON.parse(v || 'null') ?? f : v ?? f; } catch { return f; } };
export const intentChoices = (d) => parse(d.intent, {}) || {};
const name = (a) => `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.full_name || '';
// Τεκτονικό έτος του Διατάγματος («2026-2027»): από το Διάταγμα, αλλιώς έτος Διατάγματος – επόμενο
const year = (d) => { const r = parse(d.rules, {}) || {}; return String(r.period || (d.decree_year ? `${d.decree_year}-${Number(d.decree_year) + 1}` : '')).replace(/\s+/g, ''); };
// Το αξίωμα του Αδελφού στο Διάταγμα (ονομαστική) και στη γενική
export function officeOf(d, a) {
  const m = decreeMeta(d);
  if (m.action === 'service_award') return { nom: 'Τάξις του Μεγάλου Διδασκάλου', gen: TMD, en: 'the Grand Master’s Order of Service to Masonry' };
  if (m.action === 'award') { const o = m.award_office || ''; return { nom: 'Πρώην ' + o, gen: AWARD_MAP[o] || 'Πρώην ' + officeGen(o), en: OFFICE_EN[o] ? 'Past ' + OFFICE_EN[o] : '' }; }
  const o = a.office || m.decree_office || '';
  return { nom: o, gen: officeGen(o), en: OFFICE_EN[o] || '' };
}
// Προτεινόμενο είδος από την Επετηρίδα: ίδιο αξίωμα στο παρελθόν → επαναδιορισμός· κανένα αξίωμα Μεγάλης Στοάς → πρώτη φορά
export function autoType(d, a) {
  const m = decreeMeta(d);
  if (m.action === 'service_award') return 6;
  let mid = a.member_id;
  if (!mid) { try { mid = identify({ surname: a.last_name, first_name: a.first_name, email: a.email, mobile: a.mobile }, db); } catch { mid = null; } }
  const prev = mid ? db.all('member_degrees_offices').filter((o) => o.member_id === mid && o.decree_id !== d.id && (o.record_type === 'appoint' || o.record_type === 'award' || /Μέγ|Μεγάλ|Πρώην/.test(o.office || ''))) : [];
  if (m.action === 'award') return prev.length ? 5 : 7;
  const office = a.office || m.decree_office || '';
  if (prev.some((o) => String(o.office || '').trim() === office)) return 2;
  return prev.length ? 1 : 3;
}
export const intentType = (d, a, i) => { const t = Number(intentChoices(d)[i]); return INTENT_TYPES[t] ? t : autoType(d, a); };
const isThanks = (t) => !!INTENT_TYPES[t].thanks;
export const intentLabel = (t) => (isThanks(t) ? 'Ευχαριστίες' : INTENT_TYPES[t].kind === 'appoint' ? 'Πρόθεση Διορισμού' : 'Πρόθεση Απονομής');

// Η επιστολή (θέμα + κείμενο) για τον Αδελφό a (θέση i) του Διατάγματος d
export function intentLetter(d, a, i) {
  const m = decreeMeta(d), t = intentType(d, a, i), T = INTENT_TYPES[t], off = officeOf(d, a), who = name(a);
  const hon = a.honorific || '', yr = m.action === 'appoint' ? year(d) : '';
  const recipient = `${hon ? hon + ' ' : ''}${who}`.trim();
  const greet = (VOC[hon] || 'Αγαπητέ Αδελφέ') + ',';
  if (isThanks(t)) {
    return { type: t, recipient, subject: `Ευχαριστίες του Μεγάλου Διδασκάλου — ${off.nom}`, body: [greet, '',
      `Σας διαβιβάζουμε τις ευχαριστίες του Μεγάλου Διδασκάλου, Σεβτ. Αδ. ${genName(gmName())}, για το έργο το οποίο προσφέρατε στην Εθνική Μεγάλη Στοά της Ελλάδος, από την θέση του ${off.gen}${yr ? ` κατά το τεκτονικόν έτος ${yr} Ε.Κ.` : '.'}`].join('\n') };
  }
  const period = yr ? ` διά τό τεκτονικόν έτος ${yr} Ε.Κ.` : '';
  const what = `${T.verb} ${off.gen}${period}`.replace(/\s+/g, ' ');
  const acc = `${T.accept} ${off.gen}${period}`.replace(/\s+/g, ' ');
  const ref = `ΤΕΛΗ ${T.kind === 'appoint' ? 'ΔΙΟΡΙΣΜΟΥ' : 'ΑΠΟΝΟΜΗΣ'} ${d.decree_year || new Date().getFullYear()} ${who}`.toLocaleUpperCase('el').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const en = off.en ? `${EN_HON[hon] || 'Bro'} ${who}: the Grand Master intends to ${T.en} ${off.en}${yr ? ` for the masonic year ${yr} A.D.` : '.'}` : '';
  return { type: t, recipient, subject: `${intentLabel(t)} — ${off.nom}${yr ? ` (${yr})` : ''}`, body: [greet, '',
    `Σας γνωρίζουμε ότι ο Μέγας Διδάσκαλος της Εθνικής Μεγάλης Στοάς της Ελλάδος, Σεβτ. Αδ. ${gmName()}, προτίθεται να σας ${dot(what)}`,
    '',
    `Παρακαλούμε να μας γνωρίσετε την αποδοχή σας, συμπληρώνοντας και υπογράφοντας το κατωτέρω σημείωμα, και να καταβάλετε τα προβλεπόμενα τέλη ύψους [b]${T.fee}€[/b] (${T.rule}). Στην αιτιολογία της κατάθεσης παρακαλούμε να αναγράψετε: «${ref}».`,
    '', '────────────────────────────────', '[b]ΑΠΟΔΟΧΗ[/b]', '',
    `Ο υπογράφων ${recipient} αποδέχομαι ${dot(acc)}`, '', 'Ημερομηνία: ………………………          Υπογραφή: ………………………',
    ...(en ? ['', `[i]${en}[/i]`] : [])].join('\n') };
}
// Τα τέλη όλων των προθέσεων ενός Διατάγματος (για το σύνολο στη σελίδα)
const feeOf = (t) => (isThanks(t) ? 0 : INTENT_TYPES[t].fee || 0);
// Αρ. πρωτοκόλλου της Πρόθεσης = ο αριθμός πρωτοκόλλου του αντίστοιχου Διατάγματος, με «ΠΡΟΘΕΣΗ» δίπλα (π.χ. «20546 ΠΡΟΘΕΣΗ»)
export const intentProtocol = (d) => (d.protocol_seq ? `${d.protocol_seq} ΠΡΟΘΕΣΗ` : '');
const fileName = (d, a, x) => safeFileName(`${intentProtocol(d) ? intentProtocol(d) + ' - ' : 'ΠΡΟΘΕΣΗ '}ΔΙΑΤΑΓΜΑ ${d.decree_no}-${d.decree_year} ${name(a)} ${x.subject.replace(/^.*? — /, '')}`.toLocaleUpperCase('el'));

function intentPage({ params, query }) {
  const d = db.get('decree_documents', params.id);
  if (!d) return '<h1>Δεν βρέθηκε το Διάταγμα</h1>';
  const m = decreeMeta(d), ppl = decreePeople(d);
  if (m.action === 'general' || !ppl.length) return { title: 'Πρόθεση', html: `<h1>Πρόθεση Διορισμού – Απονομής</h1><p class="muted">Το Διάταγμα ${esc(`${d.decree_no}/${d.decree_year}`)} δεν έχει Αδελφούς για πρόθεση διορισμού/απονομής.</p><a class="btn" href="#/decrees">Αρχείο Διαταγμάτων</a>` };
  const only = query.p != null && ppl[Number(query.p)] ? Number(query.p) : null;
  const xs = ppl.map((a, i) => ({ a, i, x: intentLetter(d, a, i) }));
  const shown = only == null ? xs : [xs[only]];
  const kindOk = (t) => INTENT_TYPES[t].kind === 'any' || INTENT_TYPES[t].kind === m.action;
  const opts = (sel) => Object.entries(INTENT_TYPES).filter(([k]) => kindOk(Number(k))).map(([k, T]) => `<option value="${k}"${Number(k) === sel ? ' selected' : ''}>${k}. ${esc(T.label)}${T.fee ? ` — ${T.fee}€` : ''}</option>`).join('');
  const total = xs.reduce((s, r) => s + feeOf(r.x.type), 0);
  const paper = (r) => letterPaper({ letter_date: d.decree_date || today(), protocol_no: intentProtocol(d) || 'ΠΡΟΘΕΣΗ — το Διάταγμα δεν έχει ακόμη αρ. πρωτοκόλλου', recipient_name: r.x.recipient, subject: r.x.subject, body: r.x.body, signer: 'dimitrios' });
  return {
    title: `Πρόθεση — Διάταγμα ${d.decree_no}/${d.decree_year}`,
    html: `<div class="hero noprint"><div><h1>Πρόθεση Διορισμού – Απονομής</h1><p class="muted">Διάταγμα <a href="#/decrees/${d.id}"><b class="official-number">${esc(`${d.decree_no}/${d.decree_year}`)}</b></a> · ${esc(d.matter || '')} · Αρ. Πρωτ. Πρόθεσης: <b class="official-number">${esc(intentProtocol(d) || 'δεν έχει δοθεί — δώστε πρώτα αρ. πρωτοκόλλου στο Διάταγμα')}</b> · ${xs.length} ${xs.length === 1 ? 'Αδελφός' : 'Αδελφοί'} · σύνολο τελών <b>${total}€</b></p></div>
<div class="toolbar"><button class="btn primary" data-act="pdf">⬇ PDF / Εκτύπωση${only == null ? ' όλων' : ''}</button>${only == null ? '' : `<a class="btn" href="#/decrees/${d.id}/intent">Όλες οι προθέσεις</a>`}<a class="btn" href="#/decrees/${d.id}">Το Διάταγμα</a><a class="btn" href="#/decrees">Αρχείο Διαταγμάτων</a></div></div>
<div class="noprint intent-list">${intentTable(xs, opts, d)}</div>
<div class="print-area">${shown.map(paper).join('')}</div>`,
    mount(el) {
      el.querySelectorAll('select.intent-type').forEach((s) => s.addEventListener('change', async () => {
        const c = { ...intentChoices(d), [s.dataset.i]: Number(s.value) };
        await db.save(`Διάταγμα ${d.decree_no}/${d.decree_year}: είδος πρόθεσης`, (tx) => tx.update('decree_documents', d.id, { intent: JSON.stringify(c) }));
        toast('Αποθηκεύτηκε το είδος της πρόθεσης.'); go(`/decrees/${d.id}/intent`, query);
      }));
      bind(el, {
        pdf: () => printPaper(only == null ? safeFileName(`${intentProtocol(d) ? intentProtocol(d) + ' - ' : ''}ΠΡΟΘΕΣΕΙΣ ΔΙΑΤΑΓΜΑΤΟΣ ${d.decree_no}-${d.decree_year}`) : fileName(d, xs[only].a, xs[only].x)),
        async reset() { await db.save(`Διάταγμα ${d.decree_no}/${d.decree_year}: αυτόματα είδη πρόθεσης`, (tx) => tx.update('decree_documents', d.id, { intent: '' })); flash('Τα είδη πρόθεσης ξαναϋπολογίστηκαν από την Επετηρίδα.'); go(`/decrees/${d.id}/intent`); },
      });
    },
  };
}
function intentTable(xs, opts, d) {
  const chosen = intentChoices(d);
  return table(['Αδελφός', 'Αξίωμα', 'Είδος πρόθεσης', 'Τέλη', 'Ενέργειες'], xs.map(({ a, i, x }) => {
    const T = INTENT_TYPES[x.type];
    return [`<b>${esc(x.recipient)}</b>${a.email ? `<br><small>${esc(a.email)}</small>` : ''}`, esc(officeOf(d, a).nom),
      `<select class="intent-type" data-i="${i}">${opts(x.type)}</select>${chosen[i] ? '' : '<br><small class="muted">αυτόματα από την Επετηρίδα</small>'}`, T.fee ? `<b>${T.fee}€</b><br><small>${esc(T.rule)}</small>` : '—',
      `<a class="btn small" href="#/decrees/${d.id}/intent?p=${i}">📄 Μόνο αυτή / PDF</a> ${a.email ? mailButtons({ to: [a.email], subject: `${intentProtocol(d) ? `Αρ. Πρωτ. ${intentProtocol(d)} — ` : ''}${x.subject}`, body: x.body.replace(/\[\/?[bi]\]/g, ''), kind: 'official' }, '✉ Email') : ''}`];
  })) + `<div class="toolbar"><button type="button" class="btn small" data-act="reset">↺ Αυτόματα είδη από την Επετηρίδα</button><small class="muted">Το «Είδος πρόθεσης» αποθηκεύεται στο Διάταγμα· κάθε αλλαγή του Διατάγματος (αξίωμα, Αδελφοί, έτος) αλλάζει αυτόματα και το κείμενο.</small></div>`;
}

module({ id: 'decree-intent', routes: { '/decrees/:id/intent': intentPage } });
