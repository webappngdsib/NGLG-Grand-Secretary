// PDF από το επίσημο έντυπο (Επιστολή / Διάταγμα) μέσα στον browser — για αποθήκευση στο Drive χωρίς παράθυρο εκτύπωσης.
// Βιβλιοθήκες τοπικά: vendor/html2canvas.min.js, vendor/jspdf.umd.min.js (καμία εξωτερική υπηρεσία).
const loaded = {};
export function loadScript(rel) {
  return (loaded[rel] ||= new Promise((ok, bad) => {
    const s = Object.assign(document.createElement('script'), { src: new URL(rel, import.meta.url).href, onload: ok, onerror: () => bad(new Error('Δεν φορτώθηκε: ' + rel)) });
    document.head.appendChild(s);
  }));
}

// el: το στοιχείο .paper (A4) → Blob PDF μίας σελίδας Α4 (ό,τι ξεπερνά σμικρύνεται, όπως στην προεπισκόπηση)
// ή, για «Σελιδοποίηση Α4» (.paper.paged), PDF πολλών σελίδων Α4 — μία ανά φύλλο
export async function paperPdf(el, { title = '', author = '' } = {}) {
  await Promise.all([loadScript('../vendor/html2canvas.min.js'), loadScript('../vendor/jspdf.umd.min.js')]);
  await (await import('./paper.js')).resolveFileImages(el);
  if (document.fonts) await Promise.all([document.fonts.load("16px 'Noto Serif'"), document.fonts.load("bold 16px 'Noto Serif'")]).then(() => document.fonts.ready).catch(() => {}); // γραμματοσειρά των εντύπων
  await Promise.all([...el.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, H = 297;
  pdf.setProperties({ title, author });
  const shot = (node) => window.html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  if (el.classList.contains('paged')) { // Σελιδοποίηση Α4: μία σελίδα PDF ανά φύλλο
    const { paginatePaper } = await import('./paper.js');
    await paginatePaper(el); // τελική ροή (γραμματοσειρές/εικόνες φορτωμένες)
    const z = el.style.zoom; el.style.zoom = '1';
    try {
      const sheets = [...el.querySelectorAll(':scope > .sheet')];
      for (const [i, sh] of sheets.entries()) {
        const c = await shot(sh);
        if (i) pdf.addPage('a4');
        pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, Math.min(H, (c.height * W) / c.width));
      }
    } finally { el.style.zoom = z; }
    return pdf.output('blob');
  }
  const keep = { zoom: el.style.zoom, a4: el.classList.contains('a4') };
  el.style.zoom = '1'; el.classList.add('a4');
  let canvas;
  try { canvas = await shot(el); }
  finally { el.style.zoom = keep.zoom; el.classList.toggle('a4', keep.a4); }
  const h = (canvas.height * W) / canvas.width; // ύψος σε mm με πλάτος σελίδας
  if (h <= H) pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, h);
  else { const w = (W * H) / h; pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (W - w) / 2, 0, w, H); }
  return pdf.output('blob');
}
