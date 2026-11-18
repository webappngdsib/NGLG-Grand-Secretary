// «ℹ ΣΤΟΕΣ ΑΡ» (Νέα Επιστολή): βοηθητικός κατάλογος των ΕΝΕΡΓΩΝ Στοών με τον αριθμό τους, στη μορφή
// «ΑΤΛΑΣ υπ.'αριθμ 118», ώστε το όνομα και ο αριθμός να γράφονται σωστά στις επιστολές.
// Μόνο ανάγνωση: δεν αγγίζει ποτέ τη φόρμα της επιστολής (το παράθυρο είναι εκτός φόρμας, τα κουμπιά type="button").
import { db } from '../core/store.js';
import { esc, fold } from '../core/util.js';

// Ενεργή = κατάσταση «Ενεργή» (ή κενή — η προεπιλογή της βάσης). Εκτός: «Σε αργία», «Ανενεργή» (διαγραμμένες/συγχωνευμένες) και κάθε άλλη.
export const isActiveLodge = (l) => (String(l.status || '').trim() || 'Ενεργή') === 'Ενεργή';
export const lodgeRefLine = (l) => `${String(l.name || '').replace(/\s+/g, ' ').trim()} υπ.'αριθμ ${String(l.number || '').trim()}`;
const noKey = (l) => { const n = String(l.number || '').trim(); return /^\d+$/.test(n) ? [0, Number(n), ''] : [1, 0, n]; };
export function activeLodgeLines() {
  return db.all('lodges').filter((l) => isActiveLodge(l) && String(l.name || '').trim() && String(l.number || '').trim())
    .sort((a, b) => { const x = noKey(a), y = noKey(b); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2], 'el'); })
    .map((l) => ({ line: lodgeRefLine(l), name: String(l.name || ''), number: String(l.number || '').trim() }));
}

// Αντιγραφή χωρίς prompt/εστίαση στη φόρμα: Clipboard API, αλλιώς προσωρινό textarea μέσα στο παράθυρο.
async function copy(text, host) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* παλιοί browsers / χωρίς άδεια */ }
  const t = document.createElement('textarea');
  t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px';
  host.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove(); return ok;
}

export function openLodgeNumbers() {
  const items = activeLodgeLines();
  const dlg = document.createElement('dialog');
  dlg.className = 'card lodgenos'; dlg.setAttribute('aria-label', 'Ενεργές Στοές και αριθμοί');
  dlg.innerHTML = `<div class="ln-head"><h3>Ενεργές Στοές · αριθμοί</h3><button type="button" class="btn small" data-ln="close" aria-label="Κλείσιμο">✕</button></div>
<div class="ln-tools"><input type="search" class="ln-q" placeholder="🔎 Όνομα ή αριθμός…" autocomplete="off" aria-label="Αναζήτηση Στοάς">
<button type="button" class="btn small primary" data-ln="all">📋 Αντιγραφή όλων</button></div>
<div class="ln-meta muted"><span class="ln-count"></span> <span class="ln-ok" role="status" aria-live="polite"></span></div>
<ul class="ln-list">${items.map((x, i) => `<li data-i="${i}" data-k="${esc(fold(`${x.name} ${x.number}`))}"><span class="ln-line">${esc(x.line)}</span><button type="button" class="btn small" data-ln="one" data-i="${i}" aria-label="Αντιγραφή: ${esc(x.line)}">📋</button></li>`).join('')}</ul>
${items.length ? '' : '<p class="muted">Δεν βρέθηκαν ενεργές Στοές στη βάση.</p>'}`;
  document.body.appendChild(dlg);
  const q = dlg.querySelector('.ln-q'), ok = dlg.querySelector('.ln-ok'), count = dlg.querySelector('.ln-count'), lis = [...dlg.querySelectorAll('.ln-list li')];
  const visible = () => lis.filter((li) => !li.hidden);
  const refresh = () => {
    const t = fold(q.value.trim());
    for (const li of lis) li.hidden = !!t && !li.dataset.k.includes(t);
    const n = visible().length; count.textContent = n === items.length ? `${n} Στοές` : `${n} από ${items.length} Στοές`;
  };
  let timer = 0;
  const done = (good, msg, li) => {
    ok.textContent = good ? `✓ Αντιγράφηκε${msg}` : '⚠ Η αντιγραφή δεν έγινε — επιλέξτε το κείμενο και αντιγράψτε το χειροκίνητα.';
    ok.className = 'ln-ok ' + (good ? 'ok' : 'warn');
    for (const x of lis) x.classList.remove('copied');
    if (good && li) li.classList.add('copied');
    clearTimeout(timer); timer = setTimeout(() => { ok.textContent = ''; for (const x of lis) x.classList.remove('copied'); }, 1800);
  };
  q.addEventListener('input', refresh);
  dlg.addEventListener('click', async (e) => {
    if (e.target === dlg) return dlg.close(); // κλικ στο φόντο
    const b = e.target.closest('[data-ln]'); if (!b) return;
    e.preventDefault();
    if (b.dataset.ln === 'close') return dlg.close();
    if (b.dataset.ln === 'one') { const x = items[Number(b.dataset.i)]; return done(await copy(x.line, dlg), '', b.closest('li')); }
    if (b.dataset.ln === 'all') {
      // «όλων»: πάντα ολόκληρη η λίστα των ενεργών Στοών, μία ανά γραμμή (ανεξάρτητα από την αναζήτηση)
      const xs = items.map((x) => x.line);
      return done(await copy(xs.join('\n'), dlg), ` (${xs.length} Στοές)`);
    }
  });
  dlg.addEventListener('close', () => { clearTimeout(timer); dlg.remove(); });
  refresh();
  dlg.showModal();
  if (matchMedia('(pointer: fine)').matches) q.focus(); else dlg.querySelector('[data-ln=close]').focus(); // στο κινητό χωρίς άνοιγμα πληκτρολογίου
  return dlg;
}
