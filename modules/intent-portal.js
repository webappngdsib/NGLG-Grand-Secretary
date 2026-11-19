// ΕΝΗΜΕΡΩΣΗ ΠΡΟΘΕΣΗΣ ΔΙΟΡΙΣΜΩΝ — καταγραφή και έλεγχος όλων των προθέσεων διορισμού / απονομής:
// ανά Αδελφό απάντηση (ΝΑΙ / ΟΧΙ / δεν έχει απαντήσει), ποσό που κατέθεσε, υπόλοιπο, πότε κατέθεσε, κινητό, email και «επί τιμή ΜΔ» (0€).
// Ίδια καταγραφή: εδώ (σελίδα #/intents), στη σελίδα «Πρόθεση» κάθε Διατάγματος και στη δημόσια σελίδα prothesi/ (όσοι έχουν πρόσβαση:
// email → κωδικός SKIADO#### για 1 ώρα, από τον server της Πύλης Γραμματέων). Η εφαρμογή δημοσιεύει και παίρνει πίσω τις αλλαγές.
import { db } from '../core/store.js';
import { module, bind, toast, go, flash } from '../core/app.js';
import { esc, fmtDate, sortBy, EMAIL_RE, splitEmails, matches } from '../core/util.js';
import { decreeKey } from './decree-templates.js';
import { intentRows, intentProtocol, setTrack, ANSWERS } from './decree-intent.js';
import { portalApi, portalReady } from './lodge-portal.js';

export const INTENT_PAGE = 'https://webappngdsib.github.io/NGLG-Grand-Secretary/prothesi/';
db.defaultSettings({ intent_portal_emails: '' });
db.seed('intent_portal_log', () => []);
const S = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
export const accessEmails = () => [...new Set(splitEmails(db.setting('intent_portal_emails')).map((e) => e.toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
const KIND = { 'decree-appoint': 'ΕΝ ΕΝΕΡΓΕΙΑ', 'decree-provincial': 'ΠΡΩΗΝ', 'decree-service': 'ΤΑΞΗ ΜΔ' };
// Διατάγματα με Αδελφούς (όχι Γενικά), νεότερα πρώτα
export const intentDecrees = () => sortBy(db.all('decree_documents').filter((d) => decreeKey(d) !== 'decree-general' && intentRows(d).length), (d) => -(Number(d.decree_year) || 0), (d) => -(Number(d.decree_no) || 0));
export const decreePayload = () => intentDecrees().map((d) => ({ id: d.id, no: String(d.decree_no), year: String(d.decree_year), date: d.decree_date || '', matter: S(d.matter), protocol: intentProtocol(d), kind: KIND[decreeKey(d)] || '', sent: d.sent_at || '',
  people: intentRows(d).map((r) => ({ i: r.i, name: r.name, honorific: r.honorific, office: r.office, label: r.label, fee: r.fee, answer: r.answer, paid: r.paid, paid_at: r.paid_at, mobile: S(r.mobile), email: S(r.email).toLowerCase(), free: r.free })) }));
export const pushIntents = () => portalApi({ action: 'admin_intent_push', emails: accessEmails(), decrees: decreePayload() });
// Λήψη των αλλαγών της δημόσιας σελίδας → Διατάγματα (πεδίο intent_track) → επιβεβαίωση → νέα δημοσίευση
export async function syncIntents() {
  const r = await portalApi({ action: 'admin_intent_pull' }), xs = r.changes || [];
  if (xs.length) {
    await db.save(`Ενημέρωση Πρόθεσης Διορισμών: ${xs.length} ${xs.length === 1 ? 'αλλαγή' : 'αλλαγές'}`, (tx) => {
      for (const c of xs) {
        const d = tx.get('decree_documents', Number(c.decree_id)); if (!d) continue;
        const v = c.values || {};
        setTrack(tx, d, Number(c.i), { answer: v.answer || '', paid: Number(v.paid) || 0, paid_at: v.paid_at || '', mobile: S(v.mobile), email: S(v.email), free: !!v.free });
        tx.insert('intent_portal_log', { rec_id: c.id, decree_id: d.id, i: Number(c.i), name: c.name || '', at: c.at, by: c.by, ...v });
      }
    });
    await portalApi({ action: 'admin_intent_ack', ids: xs.map((c) => c.id) });
  }
  await pushIntents();
  return xs.length;
}
let autoDone = false;
db.on((ev) => {
  if (ev.type !== 'refresh' || autoDone || !db.backend || db.backend.kind !== 'github' || !portalReady() || !accessEmails().length) return;
  autoDone = true;
  setTimeout(async () => { try { const n = await syncIntents(); if (n) toast(`Ενημέρωση Πρόθεσης Διορισμών: ${n} ${n === 1 ? 'αλλαγή' : 'αλλαγές'} από τη σελίδα.`); } catch (e) { console.warn('Πρόθεση:', e); } }, 5000);
});

const money = (n) => `${(Number(n) || 0).toLocaleString('el-GR', { maximumFractionDigits: 2 })}€`;
const answerSel = (v) => `<select data-k="answer">${Object.entries(ANSWERS).map(([k, l]) => `<option value="${k}"${k === (v || '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
// Πίνακας καταγραφής ενός Διατάγματος (ίδιες στήλες με τη δημόσια σελίδα)
export function trackTable(d) {
  const rows = intentRows(d);
  return `<div class="tablecard card"><table class="stack intent-track"><tr class="stack-head"><th>Ονοματεπώνυμο</th><th>Αξίωμα (από το Διάταγμα)</th><th>Αρ. Πρόθεσης</th><th>Αξία</th><th>Απάντηση</th><th>Κατέθεσε (€)</th><th>Υπόλοιπο</th><th>Πότε κατέθεσε</th><th>Κινητό</th><th>Email</th><th>Επί τιμή ΜΔ</th><th></th></tr>
${rows.map((r) => `<tr data-d="${d.id}" data-i="${r.i}"${r.free ? ' class="free"' : ''}><td data-label="Ονοματεπώνυμο"><b>${esc(`${r.honorific} ${r.name}`.trim())}</b></td><td data-label="Αξίωμα">${esc(r.office)}<br><small class="muted">${esc(r.label)}</small></td>
<td data-label="Αρ. Πρόθεσης"><a href="#/decrees/${d.id}/intent?p=${r.i}" class="official-number">${esc(intentProtocol(d) || '—')}</a></td>
<td data-label="Αξία">${r.free ? `<s>${money(r.fee)}</s> <b>0€</b><br><small class="vwarn">επί τιμή από ΜΔ</small>` : `<b>${money(r.fee)}</b>`}</td>
<td data-label="Απάντηση">${answerSel(r.answer)}</td><td data-label="Κατέθεσε (€)"><input data-k="paid" type="number" min="0" step="0.01" value="${r.paid || ''}" style="width:90px"></td>
<td data-label="Υπόλοιπο">${r.remainder ? `<b class="vwarn">${money(r.remainder)}</b>` : '<span class="vok">✓ 0€</span>'}</td>
<td data-label="Πότε κατέθεσε"><input data-k="paid_at" type="date" value="${esc(r.paid_at)}"></td><td data-label="Κινητό"><input data-k="mobile" type="tel" value="${esc(r.mobile)}" style="width:120px"></td>
<td data-label="Email"><input data-k="email" type="email" value="${esc(r.email)}"></td><td data-label="Επί τιμή ΜΔ"><label class="chk"><input data-k="free" type="checkbox"${r.free ? ' checked' : ''}> 0€</label></td>
<td><button type="button" class="btn small primary" data-act="saveRow">💾</button></td></tr>`).join('')}</table></div>`;
}
const rowValues = (tr) => Object.fromEntries([...tr.querySelectorAll('[data-k]')].map((i) => [i.dataset.k, i.type === 'checkbox' ? i.checked : i.dataset.k === 'paid' ? Number(String(i.value).replace(',', '.')) || 0 : S(i.value)]));
// Αποθήκευση γραμμής (και από τη σελίδα «Πρόθεση» του Διατάγματος)
export async function saveTrackRow(tr) {
  const d = db.get('decree_documents', Number(tr.dataset.d)), v = rowValues(tr);
  if (!d) return;
  if (v.email && !EMAIL_RE.test(v.email)) { toast('Μη έγκυρο email.', 'error'); return; }
  await db.save(`Πρόθεση ${intentProtocol(d) || d.decree_no + '/' + d.decree_year}: καταγραφή`, (tx) => setTrack(tx, d, Number(tr.dataset.i), v));
  toast('Αποθηκεύτηκε.');
  if (portalReady() && accessEmails().length) pushIntents().catch((e) => console.warn(e));
}

function intentsPage({ query = {} }) {
  let ds = intentDecrees();
  if (query.q) ds = ds.filter((d) => matches(query.q, d.matter, d.decree_no, intentProtocol(d), ...intentRows(d).map((r) => r.name)));
  const all = ds.flatMap((d) => intentRows(d));
  const tot = { due: all.reduce((s, r) => s + r.due, 0), paid: all.reduce((s, r) => s + r.paid, 0), rem: all.reduce((s, r) => s + r.remainder, 0) };
  const cnt = (a) => all.filter((r) => r.answer === a).length;
  const log = sortBy(db.all('intent_portal_log'), (x) => x.at || '').slice(-1)[0];
  return {
    title: 'ΕΝΗΜΕΡΩΣΗ ΠΡΟΘΕΣΗΣ ΔΙΟΡΙΣΜΩΝ',
    html: `<div class="hero"><div><h1>📨 ΕΝΗΜΕΡΩΣΗ ΠΡΟΘΕΣΗΣ ΔΙΟΡΙΣΜΩΝ</h1><p class="muted">Καταγραφή και έλεγχος όλων των προθέσεων διορισμού / απονομής: απάντηση, κατάθεση, υπόλοιπο. «Επί τιμή ΜΔ» = μηδενική χρέωση.</p></div>
<div class="toolbar"><a class="btn" href="#/decrees">Αρχείο Διαταγμάτων</a></div></div>
<div class="card intent-stats"><b>${all.length}</b> προθέσεις · ΝΑΙ <b>${cnt('yes')}</b> · ΟΧΙ <b>${cnt('no')}</b> · δεν απάντησαν <b>${cnt('')}</b> · επί τιμή ΜΔ <b>${all.filter((r) => r.free).length}</b>
 · οφειλόμενα <b>${money(tot.due)}</b> · κατατέθηκαν <b class="vok">${money(tot.paid)}</b> · υπόλοιπο <b class="${tot.rem ? 'vwarn' : 'vok'}">${money(tot.rem)}</b></div>
<details class="card fold"${accessEmails().length ? '' : ' open'}><summary><b>🔐 Δημόσια σελίδα για όσους δίνετε πρόσβαση</b> <small class="muted">${accessEmails().length} email με πρόσβαση${log ? ` · τελευταία αλλαγή από τη σελίδα ${esc(fmtDate(String(log.at || '').slice(0, 10)))} (${esc(log.by || '')})` : ''}</small></summary>
<p>Σελίδα: <a href="${INTENT_PAGE}" target="_blank" rel="noopener">${INTENT_PAGE} ↗</a> — ο χρήστης γράφει το email του· αν είναι στη λίστα, λαμβάνει αυτόματα κωδικό <b>SKIADO</b> + 4 αριθμούς (θέμα «ΕΝΗΜΕΡΩΣΗ ΠΡΟΘΕΣΗΣ ΔΙΟΡΙΣΜΩΝ») που ισχύει <b>μία ώρα</b>.
Βλέπει το Αρχείο Διαταγμάτων και τον ίδιο πίνακα και καταγράφει απαντήσεις και καταθέσεις· οι αλλαγές έρχονται εδώ με «⬇ Λήψη» ή με το άνοιγμα της εφαρμογής.</p>
${portalReady() ? '' : '<p class="vwarn">Χρειάζεται πρώτα η ρύθμιση και σύνδεση της <a href="#/lodge-portal">Πύλης Γραμματέων</a> (ίδιο Apps Script, νέα έκδοση του Code.gs — έκδοση 7).</p>'}
<form id="acc"><label>Email με πρόσβαση (χωρισμένα με κόμμα ή νέα γραμμή)</label><textarea name="emails" rows="3">${esc(accessEmails().join('\n'))}</textarea>
<div class="toolbar"><button class="btn primary">💾 Αποθήκευση πρόσβασης & ⬆ δημοσίευση</button><button type="button" class="btn" data-act="sync">⬇ Λήψη αλλαγών & ⬆ δημοσίευση</button><span class="muted" id="ist"></span></div></form></details>
<form class="filters" id="iflt"><input name="q" value="${esc(query.q || '')}" placeholder="Αριθμός Διατάγματος, όνομα, περί"><button>Αναζήτηση</button></form>
${ds.length ? ds.map((d) => `<section class="intent-decree"><h3><a href="#/decrees/${d.id}">Διάταγμα <span class="official-number">${esc(`${d.decree_no}/${d.decree_year}`)}</span></a> · ${esc(fmtDate(d.decree_date))} · ${esc(KIND[decreeKey(d)] || '')} · ${esc(d.matter || '')}
 <small class="muted">· Αρ. Πρόθεσης ${esc(intentProtocol(d) || '—')} · ${d.sent_at ? `<span class="vok">✓ email ${esc(fmtDate(d.sent_at))}</span>` : '<span class="vwarn">✉ χωρίς email</span>'}</small> <a class="btn small" href="#/decrees/${d.id}/intent">📨 Πρόθεση</a></h3>${trackTable(d)}</section>`).join('') : '<p class="muted">Δεν υπάρχουν Διατάγματα με προθέσεις.</p>'}`,
    mount(el) {
      const st = el.querySelector('#ist'), busy = async (m, fn) => { st.textContent = '⏳ ' + m; try { return await fn(); } catch (e) { toast(e.message || String(e), 'error'); return null; } finally { st.textContent = ''; } };
      el.querySelector('#iflt').addEventListener('submit', (e) => { e.preventDefault(); const q = new FormData(e.target).get('q'); go('/intents', q ? { q } : {}); });
      el.querySelector('#acc').addEventListener('submit', async (e) => {
        e.preventDefault();
        const list = [...new Set(splitEmails(new FormData(e.target).get('emails')).map((x) => x.toLowerCase()))], bad = list.filter((x) => !EMAIL_RE.test(x));
        if (bad.length) { toast(`Μη έγκυρα email: ${bad.join(', ')}`, 'error'); return; }
        await db.save('Ενημέρωση Πρόθεσης Διορισμών: πρόσβαση', (tx) => { tx.setting('intent_portal_emails', list.join(', ')); });
        if (portalReady()) { const r = await busy('Δημοσίευση…', pushIntents); if (r) flash(`✓ Δημοσιεύτηκαν ${r.decrees} Διατάγματα (${r.people} προθέσεις) · πρόσβαση: ${r.emails} email.`); }
        else flash('Η πρόσβαση αποθηκεύτηκε· η δημοσίευση θα γίνει μόλις ρυθμιστεί η Πύλη Γραμματέων.');
        go('/intents', query);
      });
      bind(el, {
        async sync() { const n = await busy('Λήψη…', syncIntents); if (n !== null) { flash(n ? `Ενημερώθηκαν ${n} προθέσεις από τη σελίδα.` : 'Δεν υπάρχουν νέες αλλαγές· οι προθέσεις δημοσιεύτηκαν.'); go('/intents', query); } },
        async saveRow(_, b) { await saveTrackRow(b.closest('tr')); go('/intents', query); },
      });
    },
  };
}

module({ id: 'intent-portal', routes: { '/intents': intentsPage } });
