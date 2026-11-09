// 📇 Αρχείο Στοών (Μητρώο → υπομενού): όλες οι Συμβολικές Στοές με αριθμό, Ανατολή, Επαρχία, email Στοάς,
// Γραμματέα και email Γραμματέα, και πλήθος ενεργών μελών — με φίλτρα, Excel, εκτύπωση και PDF.
// Μόνο ανάγνωση: τα στοιχεία αλλάζουν στη Στοά (#/lodges) ή έρχονται από τις Επαρχίες (#/lodge-secretaries).
import { bind, toast } from '../core/app.js';
import { esc, fold, sortBy, today, fmtDate, exportXlsx, download } from '../core/util.js';
import { reportPaper, printPaper } from '../core/paper.js';
import { lodgesAll, lodgeNoKey, lodgeMemberCounts, lodgeSecretaryName } from './lodges.js';
import { provincialChoices } from './provinces.js';

const COLS = [['number', 'Αριθμός'], ['name', 'Στοά'], ['orient', 'Ανατολή'], ['provincial', 'Επαρχία / Περιφέρεια'], ['email', 'Email Στοάς'], ['secretary', 'Γραμματέας'], ['secretary_email', 'Email Γραμματέα'], ['active', 'Ενεργά μέλη']];
const WIDTHS = [9, 28, 18, 34, 32, 28, 32, 12];
const seniority = (n) => (/^\d+$/.test(String(n)) ? Number(n) : 1e9);
const T = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function lodgeArchiveRows({ q = '', prov = '', inactive = false } = {}) {
  const counts = lodgeMemberCounts();
  const xs = lodgesAll(!inactive).map((l) => ({ id: l.id, number: T(l.number), name: T(l.name), orient: T(l.orient), provincial: T(l.provincial), email: T(l.email),
    secretary: lodgeSecretaryName(l), secretary_email: T(l.secretary_email), active: counts[lodgeNoKey(l.number)] || 0, status: T(l.status) }))
    .filter((r) => (!prov || (prov === '-' ? !r.provincial : r.provincial === prov)) && (!q || fold(COLS.map(([k]) => r[k]).join(' ')).includes(fold(q))));
  return sortBy(xs, (r) => seniority(r.number), 'number');
}

export function lodgeArchivePage({ query }) {
  const title = 'Αρχείο Στοών';
  return {
    title,
    html: `<div class="noprint"><p><a href="#/members">← Μητρώο Μελών</a></p><h1>📇 Αρχείο Στοών</h1>
<p class="muted">Όλες οι Συμβολικές Στοές: αριθμός, Επαρχία, email Στοάς, Γραμματέας και email Γραμματέα, ενεργά μέλη. Αλλαγές στοιχείων: στη <a href="#/lodges">Στοά</a> ή από τις Επαρχίες (<a href="#/lodge-secretaries">Γραμματείς Στοών</a>).</p>
<div class="card"><div class="grid"><div><label for="laq">Αναζήτηση</label><input id="laq" value="${esc(query.q || '')}" placeholder="αριθμός, όνομα, email, Γραμματέας…" autocomplete="off"></div>
<div><label for="laprov">Επαρχία / Περιφέρεια</label><select id="laprov"><option value="">Όλες</option>${provincialChoices().map((p) => `<option${p === query.prov ? ' selected' : ''}>${esc(p)}</option>`).join('')}<option value="-">Χωρίς ορισμό</option></select></div>
<div><label>&nbsp;</label><label class="chip"><input type="checkbox" id="lainactive"><span>Και ανενεργές Στοές</span></label></div></div></div>
<div class="toolbar"><button class="btn primary" data-act="xlsx">⬇ Excel</button><button class="btn" data-act="pdf">📄 PDF</button><button class="btn" data-act="print">🖨 Εκτύπωση</button><span class="muted" id="lacount" style="align-self:center"></span></div>
<div class="card tablecard"><table id="latable"><thead><tr>${COLS.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody id="labody"></tbody></table></div></div>
<section id="lapa" class="print-area" hidden></section>`,
    mount(el) {
      const opts = () => ({ q: el.querySelector('#laq').value, prov: el.querySelector('#laprov').value, inactive: el.querySelector('#lainactive').checked });
      const mail = (e) => (e ? `<a href="mailto:${esc(e)}">${esc(e)}</a>` : '<span class="muted">—</span>');
      const render = () => {
        const rows = lodgeArchiveRows(opts());
        el.querySelector('#labody').innerHTML = rows.length ? rows.map((r) => `<tr><td><b>${esc(r.number)}</b></td><td><a href="#/lodges/edit/${r.id}">${esc(r.name)}</a>${r.status && r.status !== 'Ενεργή' ? ` <span class="pill warn">${esc(r.status)}</span>` : ''}</td>
<td>${esc(r.orient)}</td><td>${esc(r.provincial || '—')}</td><td>${mail(r.email)}</td><td>${r.secretary ? esc(r.secretary) : '<span class="muted">—</span>'}</td><td>${mail(r.secretary_email)}</td>
<td><a href="#/members?field=lodge&q=${encodeURIComponent(r.number)}">${r.active}</a></td></tr>`).join('') : `<tr><td colspan="${COLS.length}" class="muted">Καμία Στοά για τα φίλτρα αυτά.</td></tr>`;
        el.querySelector('#lacount').textContent = `${rows.length} Στοές · ${rows.filter((r) => r.email).length} με email Στοάς · ${rows.filter((r) => r.secretary_email).length} με email Γραμματέα · ${rows.reduce((s, r) => s + r.active, 0)} ενεργά μέλη`;
      };
      const sub = () => { const o = opts(); return [fmtDate(today()), o.prov ? (o.prov === '-' ? 'Χωρίς Επαρχία' : o.prov) : '', o.q ? `αναζήτηση «${o.q}»` : ''].filter(Boolean).join(' · '); };
      const paper = () => {
        const rows = lodgeArchiveRows(opts()), pa = el.querySelector('#lapa');
        pa.innerHTML = reportPaper('ΑΡΧΕΙΟ ΣΥΜΒΟΛΙΚΩΝ ΣΤΟΩΝ', `${rows.length} Στοές · ${sub()}`, `<table class="la-print"><thead><tr><th>Α/Α</th>${COLS.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${COLS.map(([k]) => `<td>${esc(r[k] === '' ? '—' : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
        return pa;
      };
      const fname = () => `ARXEIO_STOON_${today().replace(/-/g, '')}`;
      el.querySelector('#laq').addEventListener('input', render);
      el.querySelector('#laprov').addEventListener('change', render);
      el.querySelector('#lainactive').addEventListener('change', render);
      bind(el, {
        async xlsx() { const rows = lodgeArchiveRows(opts()); await exportXlsx(fname() + '.xlsx', 'ΣΤΟΕΣ', ['Α/Α', ...COLS.map(([, l]) => l)], rows.map((r, i) => [i + 1, ...COLS.map(([k]) => r[k])]), [6, ...WIDTHS]); toast(`Excel: ${rows.length} Στοές.`); },
        print() { paper(); printPaper(fname()); },
        async pdf() { const pa = paper(); pa.hidden = false; try { const { paperPdf } = await import('../core/pdf.js'); download(fname() + '.pdf', await paperPdf(pa.querySelector('.paper'), { title: 'Αρχείο Στοών' }), 'application/pdf'); } finally { pa.hidden = true; } },
      });
      render();
    },
  };
}

// η διαδρομή /members/lodges δηλώνεται στο members.js (πριν από το /members/:id)
