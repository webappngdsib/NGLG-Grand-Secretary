// Αρχική σελίδα (πλακίδια όλων των ενοτήτων), επιλογή Υπογράφοντος και το κεντρικό μενού της εφαρμογής.
// Το μενού ορίζεται μόνο εδώ, ώστε να φαίνεται και να αλλάζει σε ένα σημείο.
import { module, tilesHtml, bannersHtml, ACTORS, actor, setActor, bind, go, flash } from '../core/app.js';
import { esc } from '../core/util.js';

// Στοιχείο μενού: [ετικέτα, href, εξωτερικό] · ['-'] διαχωριστικό · ['# Τίτλος ενότητας'] επικεφαλίδα ενότητας (στήλη)
const M = (title, order, items, cls) => ({ title, order, cls, items: items.map(([label, href, external]) => (label === '-' ? { sep: true } : label.startsWith('# ') ? { head: label.slice(2) } : { label, href, external: !!external })) });

module({
  id: 'home',
  // Μενού κατά τη λογική της δουλειάς: ΤΙ γράφω (Έγγραφα) → ΠΟΙΟΝ αφορά (Μέλη, Στοές) → ΤΙ τρέχει (Επισκέψεις, ΣΓΥ, Ταμείο) →
  // Επικοινωνία → Σύστημα. Κάθε κατηγορία με δικό της χρώμα· οι μεγάλες χωρίζονται σε ενότητες-στήλες. Κάθε σελίδα μία φορά.
  menu: [
    M('✉ Έγγραφα', 10, [
      ['# Επιστολές'], ['+ Νέα Επιστολή', '#/letters/new'], ['Αρχείο Επιστολών', '#/letters'], ['📎 Καταχώριση έτοιμης επιστολής (PDF)', '#/letter-import'], ['🏛 + Έγκριση Εσωτερικού Κανονισμού', '#/letters/new?template=kanonismos'],
      ['# Διατάγματα'], ['+ Διάταγμα ΕΝ ΕΝΕΡΓΕΙΑ', '#/decrees/new'], ['+ Διάταγμα ΠΡΩΗΝ', '#/decrees/new?kind=decree-provincial'], ['+ Διάταγμα ΤΑΞΗ ΜΔ', '#/decrees/new?kind=decree-service'], ['+ Γενικό Διάταγμα', '#/decrees/new?kind=decree-general'], ['Αρχείο Διαταγμάτων', '#/decrees'],
      ['# Έντυπα & Πρωτόκολλο'], ['🎓 + Δίπλωμα Διδασκάλου Τέκτονος (A3)', '#/members/diploma'], ['Πρότυπα (Επιστολές & Διατάγματα)', '#/templates'], ['📖 Βιβλίο Πρωτοκόλλου', '#/database/protocol']], 'letters'),
    M('👥 Μέλη', 20, [
      ['# Μητρώο'], ['Μητρώο Μελών', '#/members'], ['🪪 Κάρτα Μέλους', '#/members/card'],
      ['# Επετηρίδα'], ['📜 Επετηρίδα (πίνακας)', '#/epeteirida/pinakas'], ['Ιστορικό αξιωμάτων', '#/epeteirida'],
      ['# Διπλώματα Διδασκάλου'], ['🎓 Διπλώματα Διδασκάλου', '#/members/diplomas'], ['📖 Πρωτόκολλο Διπλωμάτων', '#/members/diplomas?tab=protocol'], ['🏛 Διπλώματα ανά Στοά', '#/members/diplomas?tab=lodges'], ['⬆ Φόρτωση Διπλωμάτων (Excel)', '#/members/diplomas?tab=import']], 'members'),
    M('🏛 Στοές', 22, [
      ['# Στοές & Επαρχίες'], ['📇 Αρχείο Στοών & Επαρχιών', '#/members/lodges'], ['Συμβολικές Στοές', '#/lodges'], ['Επαρχιακές Μεγάλες Στοές', '#/provinces'], ['📇 Κατάλογος επικοινωνίας', '#/directory'], ['🏛 Στοές με < 12 κύρια μέλη', '#/members/small-lodges'],
      ['# Γραμματείς Στοών'], ['🔐 Πύλη Γραμματέων (Μητρώα Στοών)', '#/lodge-portal'], ['🗂 Γραμματείς Στοών (Επαρχίες)', '#/lodge-secretaries'], ['🛡 ΕΛΕΓΧΟΣ ΑΛΛΑΓΩΝ (Αναγγελίες)', '#/registry-audit']], 'lodges'),
    M('📅 Επισκέψεις ΜΔ', 30, [
      ['# Ροή εργασίας'], ['① Πρόγραμμα Εγκαταστάσεων', '#/visits'], ['② Δηλώσεις Διάθεσης Μ. Αξιωματικών', '#/declarations'], ['③ Αποφάσεις Μ.Δ.', '#/visits/decisions'], ['④ Ενημέρωση Επαρχίας', '#/visits/publish'], ['⑤ Αναφορά επισκέψεων', '#/visits/report'],
      ['# Καταχώριση'], ['+ Νέα επίσκεψη', '#/visits/new'], ['Εκπρόσωποι ΜΔ', '#/reps'], ['Στοές χωρίς ημερομηνία Εγκατάστασης', '#/visits/missing']], 'visits'),
    M('🏛 ΣΓΥ', 34, [['🏛 ΣΓΥ — Μέλη', '#/sgy'], ['🏛 Μητρώο Μελών ΣΓΥ', '#/members/sgy'], ['📋 Παρουσιολόγιο ΣΓΥ', '#/sgy/attendance'], ['-'], ['✉ Νέα Επιστολή προς ΣΓΥ', '#/letters/new?category=ΣΓΥ&to_name=' + encodeURIComponent('Προς τα Μέλη του Συμβουλίου Γενικών Υποθέσεων')], ['Επιστολές ΣΓΥ', '#/letters?category=ΣΓΥ'], ['-'], ['📑 Ροή Συνεδρίασης & Αναφορά ΜΓραμ ↗', 'https://dskiad.github.io/SGY-report-NGLG-/', true]], 'sgy'),
    M('💶 Ταμείο', 36, [['📊 Σύνοψη εισφορών', '#/treasury'], ['🏛 Ανά Στοά', '#/treasury/lodges'], ['👤 Ανά μέλος', '#/treasury/members'], ['🗺 Ανά Επαρχία', '#/treasury/provinces'], ['-'], ['⚙ Ποσά & ειδικές Στοές', '#/treasury/settings']], 'treasury'),
    M('🎉 Επικοινωνία', 40, [['🎉 Εορτολόγιο & ευχές', '#/namedays'], ['👥 Επαφές & Ομάδες (Google)', '#/contacts'], ['Πρότζεκτ ΜΔ', '#/projects']], 'contact'),
    M('⚙ Σύστημα', 50, [
      ['# Ρυθμίσεις'], ['Ρυθμίσεις', '#/settings'], ['✍ Ποιος υπογράφει', '#/identity'], ['🗄 Βάση Δεδομένων', '#/database'], ['💾 Αντίγραφο & μεταφορά δεδομένων', '#/database/backup'], ['🩺 Έλεγχος εφαρμογής', '#/system'],
      ['# Δημόσιες σελίδες'], ['Πρόγραμμα επισκέψεων ΜΔ ↗', 'programme/', true], ['Δηλώσεις Διάθεσης ↗', 'declarations/', true], ['Πύλη Γραμματέων Στοών ↗', 'lodge/', true], ['Γραμματείς Στοών — Επαρχίες ↗', 'secretaries/', true], ['Ψηφιακό Έντυπο Διατάγματος', 'diatagma/'], ['⚖ Καγκελαρία — Πατέντες & Αναγνώριση', 'chancellor/'], ['🏛 Πύλη (όλες οι εφαρμογές)', '#/portal']], 'system'),
    // γρήγορες ενέργειες (πάντα ορατές)
    { title: '📋 Αναφορά ΜΔ', order: 60, href: '#/visits/gm-programme', cls: 'navbtn' },
    { title: '🔒 Ενημέρωση ΜΔ', order: 61, href: '#/declarations?view=report', cls: 'navbtn' },
  ],
  routes: {
    '/': () => ({
      title: 'Αρχική',
      html: `<div class="hero home-hero"><div><h1>Μεγάλη Γραμματεία</h1><p>Όλη η δουλειά της Γραμματείας σε ένα σημείο — τι εκκρεμεί σε κάθε ενότητα και οι συχνές ενέργειες.</p></div>
<div class="toolbar"><a class="btn primary" href="#/letters/new">+ Νέα Επιστολή</a><details class="archdrop"><summary class="btn">ΑΡΧΕΙΟ ΕΠΙΣΤΟΛΩΝ <span class="caret">▾</span></summary><div class="archdrop-menu"><a href="#/decrees">ΔΙΑΤΑΓΜΑΤΑ</a><a href="#/letters">ΕΠΙΣΤΟΛΕΣ</a></div></details><a class="btn" href="#/decrees/new">+ Νέο Διάταγμα</a><a class="btn" href="#/members/diploma">🎓 + Δίπλωμα Διδασκάλου Τέκτονος</a></div></div>${bannersHtml()}${tilesHtml()}`,
    }),
    '/identity': () => ({
      title: 'Υπογράφων',
      html: `<h1>Ποιος υπογράφει;</h1><p class="muted">Ισχύει για τις νέες Επιστολές και τα Διατάγματα από αυτή τη συσκευή.</p>
<div class="identity-grid">${Object.entries(ACTORS).map(([k, v]) => `<div class="card identity-card"><h2>${esc(v)}</h2><p class="muted">${k === 'nikolaos' ? 'Αν. Μέγας Γραμματεύς' : 'Μέγας Γραμματεύς'}</p>
<button class="btn${actor() === k ? ' primary' : ''}" data-act="pick" data-k="${k}">${actor() === k ? '✓ Επιλεγμένος' : 'Επιλογή'}</button></div>`).join('')}</div>`,
      mount(el) { bind(el, { pick: (d) => { setActor(d.k); flash(`Υπογράφων: ${ACTORS[d.k]}`); go('/'); } }); },
    }),
  },
});

// Σύνταγμα (Βοηθός Συντάγματος): πλακίδιο στην Αρχική που ανοίγει μόνο την αυτόνομη σελίδα constitution/ σε νέα καρτέλα
module({
  id: 'constitution-tile',
  tile: { order: 32, render: () => `<div class="dtile"><h3><a href="constitution/" target="_blank" rel="noopener">📜 Σύνταγμα</a></h3><div class="muted">Βοηθός Συντάγματος — Γενικοί Νόμοι και Κανονισμοί (αυτόνομη σελίδα, για αποστολή)</div>
<div class="acts"><a class="btn primary" href="constitution/" target="_blank" rel="noopener">Άνοιγμα ↗</a></div></div>` },
});

// ΣΓΥ · Ροή Συνεδρίασης & Αναφορά Μεγάλου Γραμματέως: αυτόνομη σελίδα (αποθετήριο dskiad/SGY-report-NGLG-) — μόνο σύνδεσμοι, σε νέα καρτέλα.
// Το πλακίδιο διαβάζει το latest.json εκείνου του αποθετηρίου (τρέχουσα Συνεδρίαση, PDF), ώστε να ενημερώνεται αυτόματα·
// χωρίς δίκτυο μένουν οι προεπιλογές παρακάτω.
const SGY_REPORT = 'https://dskiad.github.io/SGY-report-NGLG-/';
const SGY_LATEST = SGY_REPORT + 'latest.json';
const SGY_DEFAULT = {
  title: 'Τακτική Συνεδρίαση 02/11/2026',
  summary: 'ροή θεμάτων, ψηφοφορίες, Αναφορά ΜΓραμ (Συνοπτική Εποπτική Αναφορά + Τεύχος Ανάλυσης Δεδομένων)',
  page: SGY_REPORT,
  live: 'https://claude.ai/artifact/TokGbLGVAzWv6V5Nz1TFSb',
  report_pdf: SGY_REPORT + 'Anafora_MGram_SGY_301026_v20.pdf',
  session_pdf: SGY_REPORT + 'SGY_Synedriasi_021126_v20.pdf',
  archive: 'https://github.com/dskiad/SGY-report-NGLG-/tree/main/archive',
};
let sgyLatest = null, sgyFetched = 0;
const safeUrl = (u, d) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : d);
const ext = (href, label, cls = 'btn', title = '') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener"${title ? ` title="${esc(title)}"` : ''}>${esc(label)} ↗</a>`;
function sgyTileHtml() {
  const L = sgyLatest || {}, D = SGY_DEFAULT, u = (k) => safeUrl(L[k], D[k]);
  const title = typeof L.title === 'string' ? L.title : D.title, summary = typeof L.summary === 'string' ? L.summary : D.summary;
  return `<div class="dtile gold" data-tile="sgy-report"><h3><a href="${esc(u('page'))}" target="_blank" rel="noopener">📑 ΣΓΥ · Ροή Συνεδρίασης &amp; Αναφορά Μεγάλου Γραμματέως</a></h3>
<div class="muted">${esc(title)} · ${esc(summary)}</div>
<div class="acts">${ext(u('page'), 'Άνοιγμα Ροής ΣΓΥ', 'btn primary goldflash', 'Η σελίδα όπου συμπληρώνετε τη Συνεδρίαση και την Αναφορά')}${u('live') !== u('page') ? ext(u('live'), 'Ζωντανή σελίδα', 'btn', 'Κοινές καταχωρίσεις και στατιστικά Gmail/Drive (λογαριασμός claude.ai του Μεγάλου Γραμματέως)') : ''}${ext(u('report_pdf'), 'PDF Αναφοράς', 'btn', 'Αναφορά Μεγάλου Γραμματέως')}${ext(u('session_pdf'), 'PDF Συνεδρίασης', 'btn', 'Πλήρης Συνεδρίαση')}${ext(u('archive'), 'Αρχείο GitHub', 'btn', 'Αρχείο συνεδριάσεων ΣΓΥ στο GitHub')}</div></div>`;
}
function sgyRefresh() {
  if (Date.now() - sgyFetched < 60000) return;  // το πολύ μία ανάγνωση το λεπτό
  sgyFetched = Date.now();
  fetch(SGY_LATEST, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j || typeof j !== 'object') return;
    sgyLatest = j;
    const el = document.querySelector('[data-tile="sgy-report"]');
    if (el) el.outerHTML = sgyTileHtml();
  }).catch(() => {});
}
module({
  id: 'sgy-report-tile',
  tile: { order: 16, render: () => { setTimeout(sgyRefresh, 0); return sgyTileHtml(); } },
});
