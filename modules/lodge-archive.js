// 📇 Αρχείο Στοών & Επαρχιών (Μητρώο → υπομενού): όλες οι Συμβολικές Στοές (αριθμός, Ανατολή, Επαρχία, email Στοάς,
// Σεβάσμιος, Γραμματέας, ενεργά μέλη) και όλες οι Επαρχίες (email Γραμματείας, ΕπΜΔ, ΕπΜΓρ., Στοές, ενεργά μέλη).
// Μόνο ανάγνωση και μία πηγή: τα πρόσωπα έρχονται από το Μητρώο Μελών (core/officers.js)· τίποτα δεν αντιγράφεται εδώ.
// Αλλαγές: στη Στοά (#/lodges), στην Επαρχία (#/provinces) ή από τις Επαρχίες (#/lodge-secretaries).
import { bind, toast } from '../core/app.js';
import { esc, fold, sortBy, today, fmtDate, XLSX, download } from '../core/util.js';
import { reportPaper, printPaper } from '../core/paper.js';
import { lodgeOfficer } from '../core/officers.js';
import { lodgesAll, lodgeNoKey, lodgeMemberCounts } from './lodges.js';
import { provincialChoices, provincesAll, provinceRoles } from './provinces.js';

const COLS = [['number', 'Αριθμός'], ['name', 'Στοά'], ['orient', 'Ανατολή'], ['provincial', 'Επαρχία / Περιφέρεια'], ['email', 'Email Στοάς'],
  ['master', 'Σεβάσμιος'], ['secretary', 'Γραμματέας'], ['secretary_email', 'Email Γραμματέα'], ['active', 'Ενεργά μέλη']];
const WIDTHS = [9, 28, 18, 34, 32, 28, 28, 32, 12];
const PCOLS = [['short', 'Επαρχία / Περιφέρεια'], ['email', 'Email Γραμματείας'], ['gm', 'ΕπΜΔ'], ['gm_email', 'Email ΕπΜΔ'], ['gs', 'ΕπΜΓρ.'], ['gs_email', 'Email ΕπΜΓρ.'], ['lodges', 'Στοές'], ['active', 'Ενεργά μέλη']];
const PWIDTHS = [36, 34, 28, 32, 28, 32, 8, 12];
const seniority = (n) => (/^\d+$/.test(String(n)) ? Number(n) : 1e9);
const T = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function lodgeArchiveRows({ q = '', prov = '', inactive = false } = {}) {
  const counts = lodgeMemberCounts();
  const xs = lodgesAll(!inactive).map((l) => {
    const om = lodgeOfficer(l, 'master'), os = lodgeOfficer(l, 'secretary');
    return { id: l.id, number: T(l.number), name: T(l.name), orient: T(l.orient), provincial: T(l.provincial), email: T(l.email), master: om.name, master_id: om.id,
      secretary: os.name, secretary_id: os.id, secretary_email: os.email, active: counts[lodgeNoKey(l.number)] || 0, status: T(l.status) };
  }).filter((r) => (!prov || (prov === '-' ? !r.provincial : r.provincial === prov)) && (!q || fold(COLS.map(([k]) => r[k]).join(' ')).includes(fold(q))));
  return sortBy(xs, (r) => seniority(r.number), 'number');
}
export function provinceArchiveRows({ prov = '' } = {}) {
  const counts = lodgeMemberCounts(), ls = lodgesAll(true);
  return provincesAll(true).filter((p) => !prov || prov === '-' || p.short === prov).map((p) => {
    const [gm, gs] = provinceRoles(p), mine = ls.filter((l) => T(l.provincial) === T(p.short));
    return { id: p.id, short: T(p.short), kind: p.kind, email: T(p.email), gm: gm.name, gm_id: gm.member_id, gm_email: gm.email, gs: gs.name, gs_id: gs.member_id, gs_email: gs.email,
      gm_abbr: gm.abbr, gs_abbr: gs.abbr, lodges: p.kind === 'Εθνική' ? ls.length : mine.length, active: (p.kind === 'Εθνική' ? ls : mine).reduce((s, l) => s + (counts[lodgeNoKey(l.number)] || 0), 0) };
  });
}

export function lodgeArchivePage({ query }) {
  return {
    title: 'Αρχείο Στοών',
    html: `<div class="noprint"><p><a href="#/members">← Μητρώο Μελών</a></p><h1>📇 Αρχείο Στοών & Επαρχιών</h1>
<p class="muted">Μία πηγή: Σεβάσμιοι, Γραμματείς, ΕπΜΔ και ΕπΜΓρ. είναι <b>μέλη του Μητρώου</b>· όνομα, email και κινητό έρχονται από εκεί.
Αλλαγές: στη <a href="#/lodges">Στοά</a>, στην <a href="#/provinces">Επαρχία</a> ή από τις Επαρχίες (<a href="#/lodge-secretaries">Γραμματείς Στοών</a>). «⚠ χωρίς σύνδεση» = το όνομα δεν αντιστοιχεί σε μοναδικό μέλος.</p>
<div class="card"><div class="grid"><div><label for="laq">Αναζήτηση Στοάς</label><input id="laq" value="${esc(query.q || '')}" placeholder="αριθμός, όνομα, email, Σεβάσμιος, Γραμματέας…" autocomplete="off"></div>
<div><label for="laprov">Επαρχία / Περιφέρεια</label><select id="laprov"><option value="">Όλες</option>${provincialChoices().map((p) => `<option${p === query.prov ? ' selected' : ''}>${esc(p)}</option>`).join('')}<option value="-">Χωρίς ορισμό</option></select></div>
<div><label>&nbsp;</label><label class="chip"><input type="checkbox" id="lainactive"><span>Και ανενεργές Στοές</span></label></div></div></div>
<div class="toolbar"><button class="btn primary" data-act="xlsx">⬇ Excel (Επαρχίες & Στοές)</button><button class="btn" data-act="pdf">📄 PDF</button><button class="btn" data-act="print">🖨 Εκτύπωση</button></div>
<h2>🏛 Επαρχίες <small class="muted" id="lapcount"></small></h2>
<div class="card tablecard"><table id="laptable"><thead><tr>${PCOLS.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody id="lapbody"></tbody></table></div>
<h2>🏛 Συμβολικές Στοές <small class="muted" id="lacount"></small></h2>
<div class="card tablecard"><table id="latable"><thead><tr>${COLS.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody id="labody"></tbody></table></div></div>
<section id="lapa" class="print-area" hidden></section>`,
    mount(el) {
      const opts = () => ({ q: el.querySelector('#laq').value, prov: el.querySelector('#laprov').value, inactive: el.querySelector('#lainactive').checked });
      const mail = (e) => (e ? `<a href="mailto:${esc(e)}">${esc(e)}</a>` : '<span class="muted">—</span>');
      const who = (name, id) => (!name ? '<span class="muted">—</span>' : id ? `<a href="#/members/${id}">${esc(name)}</a>` : `${esc(name)} <span class="pill warn">⚠ χωρίς σύνδεση</span>`);
      const render = () => {
        const rows = lodgeArchiveRows(opts()), prs = provinceArchiveRows(opts());
        el.querySelector('#lapbody').innerHTML = prs.map((r) => `<tr><td><a href="#/provinces/edit/${r.id}"><b>${esc(r.short)}</b></a></td><td>${mail(r.email)}</td><td>${who(r.gm, r.gm_id)}</td><td>${mail(r.gm_email)}</td>
<td>${who(r.gs, r.gs_id)}</td><td>${mail(r.gs_email)}</td><td>${r.lodges}</td><td>${r.active}</td></tr>`).join('');
        el.querySelector('#lapcount').textContent = `(${prs.length})`;
        el.querySelector('#labody').innerHTML = rows.length ? rows.map((r) => `<tr><td><b>${esc(r.number)}</b></td><td><a href="#/lodges/edit/${r.id}">${esc(r.name)}</a>${r.status && r.status !== 'Ενεργή' ? ` <span class="pill warn">${esc(r.status)}</span>` : ''}</td>
<td>${esc(r.orient)}</td><td>${esc(r.provincial || '—')}</td><td>${mail(r.email)}</td><td>${who(r.master, r.master_id)}</td><td>${who(r.secretary, r.secretary_id)}</td><td>${mail(r.secretary_email)}</td>
<td><a href="#/members?field=lodge&q=${encodeURIComponent(r.number)}">${r.active}</a></td></tr>`).join('') : `<tr><td colspan="${COLS.length}" class="muted">Καμία Στοά για τα φίλτρα αυτά.</td></tr>`;
        el.querySelector('#lacount').textContent = `(${rows.length} Στοές · ${rows.filter((r) => r.email).length} με email Στοάς · ${rows.filter((r) => r.secretary).length} με Γραμματέα · ${rows.filter((r) => r.master).length} με Σεβάσμιο · ${rows.reduce((s, r) => s + r.active, 0)} ενεργά μέλη)`;
      };
      const sub = () => { const o = opts(); return [fmtDate(today()), o.prov ? (o.prov === '-' ? 'Χωρίς Επαρχία' : o.prov) : '', o.q ? `αναζήτηση «${o.q}»` : ''].filter(Boolean).join(' · '); };
      const tbl = (cols, rows) => `<table class="la-print"><thead><tr><th>Α/Α</th>${cols.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(([k]) => `<td>${esc(r[k] === '' || r[k] == null ? '—' : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const paper = () => {
        const rows = lodgeArchiveRows(opts()), prs = provinceArchiveRows(opts()), pa = el.querySelector('#lapa');
        pa.innerHTML = reportPaper('ΑΡΧΕΙΟ ΕΠΑΡΧΙΩΝ ΚΑΙ ΣΥΜΒΟΛΙΚΩΝ ΣΤΟΩΝ', `${prs.length} Επαρχίες · ${rows.length} Στοές · ${sub()}`,
          `<h3>Επαρχίες</h3>${tbl(PCOLS, prs)}<h3>Συμβολικές Στοές</h3>${tbl(COLS, rows)}`);
        return pa;
      };
      const fname = () => `ARXEIO_STOON_${today().replace(/-/g, '')}`;
      el.querySelector('#laq').addEventListener('input', render);
      el.querySelector('#laprov').addEventListener('change', render);
      el.querySelector('#lainactive').addEventListener('change', render);
      bind(el, {
        async xlsx() {
          const X = await XLSX(), rows = lodgeArchiveRows(opts()), prs = provinceArchiveRows(opts()), wb = X.utils.book_new();
          const sheet = (cols, xs, w, name) => { const ws = X.utils.aoa_to_sheet([['Α/Α', ...cols.map(([, l]) => l)], ...xs.map((r, i) => [i + 1, ...cols.map(([k]) => r[k] ?? '')])]);
            ws['!cols'] = [6, ...w].map((wch) => ({ wch })); ws['!autofilter'] = { ref: `A1:${String.fromCharCode(65 + cols.length)}${xs.length + 1}` }; X.utils.book_append_sheet(wb, ws, name); };
          sheet(PCOLS, prs, PWIDTHS, 'ΕΠΑΡΧΙΕΣ'); sheet(COLS, rows, WIDTHS, 'ΣΤΟΕΣ');
          X.writeFile(wb, fname() + '.xlsx');
          toast(`Excel: ${prs.length} Επαρχίες · ${rows.length} Στοές.`);
        },
        print() { paper(); printPaper(fname()); },
        async pdf() { const pa = paper(); pa.hidden = false; try { const { paperPdf } = await import('../core/pdf.js'); download(fname() + '.pdf', await paperPdf(pa.querySelector('.paper'), { title: 'Αρχείο Στοών' }), 'application/pdf'); } finally { pa.hidden = true; } },
      });
      render();
    },
  };
}
