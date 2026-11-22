// 📣 Ενημέρωση Μεγάλων Αξιωματικών — άμεσο email (ένα μήνυμα, όλοι σε Bcc) για οποιαδήποτε ενημέρωση ή επιστολή.
// Παραλήπτες: εν ενεργεία Μεγάλοι Αξιωματικοί (και, προαιρετικά, Μεγάλοι Επιμελητές) της Επετηρίδας — ΚΥΡΙΟ email του Μητρώου.
// Πριν φύγει: προεπισκόπηση όπου διορθώνονται Προς / Κοιν. / Bcc (χειρόγραφα ή με όνομα από το Μητρώο), Θέμα και Κείμενο.
// Συνημμένα: οποιοδήποτε αρχείο (π.χ. PDF επιστολής ή διατάγματος). Το ίδιο κουμπί υπάρχει σε κάθε καρτέλα email (Επιστολές, Διατάγματα…).
import { module, bind, toast } from '../core/app.js';
import { esc } from '../core/util.js';
import { senderFor } from '../core/mail.js';
import { recipientGroup, recipientGroups } from '../core/pickers.js';
import './grand-stewards.js';

const b64 = async (file) => { const u8 = new Uint8Array(await file.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };

function page() {
  const on = { officers: true, stewards: false };
  return {
    title: '📣 Ενημέρωση Μεγάλων Αξιωματικών',
    html: `<h1>📣 Ενημέρωση Μεγάλων Αξιωματικών</h1>
<p class="muted">Ένα email προς όλους τους εν ενεργεία Μεγάλους Αξιωματικούς (Επετηρίδα) με <b>Bcc</b> — ο ένας δεν βλέπει τη διεύθυνση του άλλου.
Χρησιμοποιείται το <b>κύριο email</b> του Μητρώου. Πριν φύγει ανοίγει <b>προεπισκόπηση όπου διορθώνονται όλα</b>: διευθύνσεις (χειρόγραφα ή με όνομα από το Μητρώο), θέμα και κείμενο.</p>
<div class="card"><div id="onGroups" class="toolbar"></div><div id="onList" style="max-height:260px;overflow:auto;margin-top:8px"></div></div>
<div class="card"><label>Θέμα<input id="onSubj" placeholder="π.χ. Ενημέρωση — …"></label>
<label>Κείμενο<textarea id="onBody" rows="10" placeholder="Αγαπητοί Σεβτ., Πσεβ., Λίαν Σεβ., Σεβ. Αδ.,&#10;&#10;…"></textarea></label>
<label>📎 Συνημμένα (προαιρετικά — π.χ. PDF επιστολής ή διατάγματος)<input id="onFiles" type="file" multiple></label>
<div class="toolbar" style="margin-top:10px"><button class="btn primary big" data-act="send">👁 Προεπισκόπηση &amp; αποστολή</button><button class="btn big" data-act="draft">✉ Πρόχειρο στο Gmail</button></div>
<p class="muted">Αποστολή από <b>${esc(senderFor('general'))}</b>.</p><div id="onState"></div></div>`,
    mount(el) {
      const sel = () => Object.keys(on).filter((k) => on[k]).map(recipientGroup);
      const emails = () => [...new Map(sel().flatMap((g) => g.emails).map((e) => [e.toLowerCase(), e])).values()];
      const refresh = () => {
        el.querySelector('#onGroups').innerHTML = recipientGroups().map((g) => `<label class="ms-extra"><input type="checkbox" data-g="${esc(g.key)}"${on[g.key] ? ' checked' : ''}> ${esc(g.label)} (${recipientGroup(g.key).people.length})</label>`).join('');
        const people = sel().flatMap((g) => g.people);
        el.querySelector('#onList').innerHTML = people.length ? `<table class="table"><tbody>${people.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.email ? esc(p.email) : '<span class="warn">— χωρίς email στο Μητρώο</span>'}</td></tr>`).join('')}</tbody></table>
<p class="muted"><b>${emails().length}</b> email στο Bcc.</p>` : '<p class="warn">Δεν βρέθηκαν εν ενεργεία Μεγάλοι Αξιωματικοί στην Επετηρίδα (συνδέστε τη Βάση Δεδομένων).</p>';
      };
      el.querySelector('#onGroups').addEventListener('change', (e) => { const c = e.target.closest('[data-g]'); if (c) { on[c.dataset.g] = c.checked; refresh(); } });
      refresh();
      const state = (h) => { el.querySelector('#onState').innerHTML = h; };
      const msg = () => ({ to: senderFor('general'), cc: '', bcc: emails().join(', '), subject: el.querySelector('#onSubj').value.trim(), body: el.querySelector('#onBody').value });
      const files = async () => Promise.all([...el.querySelector('#onFiles').files].map(async (f) => ({ name: f.name, type: f.type || 'application/octet-stream', b64: await b64(f) })));
      const ready = async () => {
        const { driveReady } = await import('../core/drive.js');
        if (!driveReady()) { state('<span class="warn">Για αποστολή από την εφαρμογή χρειάζεται το Google Client ID (Ρυθμίσεις → Google).</span>'); return null; }
        return import('../core/gmail.js');
      };
      bind(el, {
        async send() {
          const g = await ready(); if (!g) return;
          const names = [...el.querySelector('#onFiles').files].map((f) => f.name);
          const m = await g.confirmSend({ from: senderFor('general'), msg: msg(), editable: true, attachments: names });
          if (!m) return;
          state('⏳ Αποστολή…');
          try { await g.sendNow(m, await files(), 'general'); state('<span style="color:#0d7a3e"><b>✓ Στάλθηκε</b> — θα το βρείτε στα «Απεσταλμένα» του Gmail.</span>'); toast('✓ Η ενημέρωση στάλθηκε.'); }
          catch (e) { state(`<span class="warn">${esc(e.message || e)}</span>`); }
        },
        async draft() {
          const g = await ready(); if (!g) return;
          try { const d = await g.createDraft(msg(), await files(), 'general'); state(`✓ Δημιουργήθηκε Πρόχειρο. <a href="${esc(g.draftWebUrl('general', d.messageId))}" target="_blank" rel="noopener">Άνοιγμα στο Gmail ↗</a>`); }
          catch (e) { state(`<span class="warn">${esc(e.message || e)}</span>`); }
        },
      });
    },
  };
}

module({ id: 'officers-notify', routes: { '/notify-officers': page } });
