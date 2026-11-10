// Αξιωματικοί από ΜΙΑ πηγή: το Μητρώο Μελών.
// Η Στοά κρατά μόνο ποιο μέλος είναι Σεβάσμιος (master_id) και Γραμματέας (secretary_id)· η Επαρχία ποιο μέλος είναι
// ΕπΜΔ (master_id) και ΕπΜΓρ. (secretary_id). Όνομα, email και κινητό διαβάζονται πάντα από το Μητρώο.
// Τα παλιά πεδία κειμένου (master, secretary, master_name, secretary_name…) μένουν μόνο ως εφεδρεία για όσα
// δεν έχουν ακόμη συνδεθεί με μέλος — τότε η ταύτιση γίνεται με το ονοματεπώνυμο (πρώτα ανάμεσα στα μέλη της Στοάς).
// Τα email «θέσης» (π.χ. email Γραμματέα Στοάς για την Πύλη, email Γραμματείας Επαρχίας) είναι στοιχεία της θέσης, όχι του προσώπου.
import { db } from './store.js';
import { identify, nameCandidates, canonicalId, person } from './people.js';

const T = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const noKey = (n) => { n = String(n ?? '').replace(/\s+/g, '').toUpperCase(); return n.replace(/^0+/, '') || n; };
const gone = (st) => /ΔΙΑΓΡΑΦ|ΜΕΤΕΣΘ/.test(String(st || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase());
export const fullName = (m) => (m ? `${T(m.first_name)} ${T(m.surname)}`.trim() : '');

// Ενεργά μέλη ανά Στοά (για ταύτιση ονόματος μέσα στη Στοά)
let memo = { head: undefined, by: null };
function lodgeMemberIds() {
  if (memo.head === db.head && memo.by) return memo.by;
  const active = new Set(db.all('member_registry').filter((m) => m.active !== 0).map((m) => m.id)), by = new Map();
  for (const l of db.all('member_lodges')) {
    if (!active.has(l.member_id) || gone(l.member_status)) continue;
    const k = noKey(l.lodge_number); (by.get(k) || by.set(k, new Set()).get(k)).add(canonicalId(l.member_id));
  }
  memo = { head: db.head, by };
  return by;
}

// Ταύτιση ονοματεπωνύμου με μέλος: μοναδικός υποψήφιος μέσα στη Στοά, αλλιώς μοναδικός σε όλο το Μητρώο
export function matchMember(text, lodgeNo = null) {
  const t = T(text); if (!t) return null;
  const cands = nameCandidates(t);
  if (lodgeNo != null) {
    const inLodge = cands.filter((id) => (lodgeMemberIds().get(noKey(lodgeNo)) || new Set()).has(id));
    if (inLodge.length === 1) return inLodge[0];
    if (inLodge.length > 1) return null;
  }
  return cands.length === 1 ? cands[0] : identify({ full_name: t });
}

const lodgeText = (l, role) => (role === 'master' ? T(l.master) : [T(l.secretary_last), T(l.secretary_first)].filter(Boolean).join(' ') || T(l.secretary));
const resolve = (id, text, lodgeNo) => {
  const linked = Number(id) && db.get('member_registry', Number(id)) ? canonicalId(Number(id)) : null;
  return { mid: linked || matchMember(text, lodgeNo), linked: !!linked };
};

// Σεβάσμιος / Γραμματέας Στοάς → { id, member, name, email, mobile, linked, text }
export function lodgeOfficer(l, role) {
  if (!l) return null;
  const text = lodgeText(l, role), { mid, linked } = resolve(l[role + '_id'], text, l.number), p = mid ? person(mid) : null;
  const roleEmail = role === 'secretary' ? T(l.secretary_email) : '', roleMobile = T(l[role + '_mobile']);
  return { role, id: p ? p.id : null, member: p ? p.member : null, linked, text, name: p ? p.name : text,
    email: roleEmail || (p ? p.email : ''), personal_email: p ? p.email : '', mobile: (p && p.mobile) || roleMobile };
}

// ΕπΜΔ (gm) / ΕπΜΓρ. (gs) Επαρχίας → ίδια μορφή· το email θέσης (master_email / secretary_email) υπερισχύει
export function provinceOfficer(p, role) {
  if (!p) return null;
  const pre = role === 'gm' ? 'master' : 'secretary', text = T(p[pre + '_name']), { mid, linked } = resolve(p[pre + '_id'], text, null), x = mid ? person(mid) : null;
  return { role, id: x ? x.id : null, member: x ? x.member : null, linked, text, name: x ? x.name : text,
    // ΕπΜΓρ.: email θέσης → email Γραμματείας της Επαρχίας → του μέλους· ΕπΜΔ: email θέσης → του μέλους
    email: T(p[pre + '_email']) || (role === 'gs' ? T(p.email) : '') || (x ? x.email : ''), personal_email: x ? x.email : '', mobile: x ? x.mobile : '' };
}

export const provinceOfLodge = (l) => (l && T(l.provincial) ? db.all('grand_lodges').find((p) => T(p.short) === T(l.provincial)) || null : null);

// Τρέχοντα αξιώματα ενός μέλους (από τις Στοές και τις Επαρχίες)
const ROLE_LABEL = { master: 'Σεβάσμιος', secretary: 'Γραμματέας', gm: 'ΕπΜΔ', gs: 'ΕπΜΓρ.' };
let omemo = { head: undefined, by: null };
function officesIndex() {
  if (omemo.head === db.head && omemo.by) return omemo.by;
  const by = new Map(), add = (id, o) => { if (id) (by.get(id) || by.set(id, []).get(id)).push(o); };
  for (const l of db.all('lodges')) for (const r of ['master', 'secretary']) {
    const o = lodgeOfficer(l, r);
    if (o.id) add(o.id, { kind: r, label: `${ROLE_LABEL[r]} Στοάς ${T(l.name)} ${T(l.number)}`.trim(), short: `${ROLE_LABEL[r]} ${T(l.number)}`, href: `#/lodges/edit/${l.id}`, lodge: l });
  }
  for (const p of db.all('grand_lodges')) for (const r of ['gm', 'gs']) {
    const o = provinceOfficer(p, r), kind = p.kind === 'Περιφερειακή' ? (r === 'gm' ? 'ΠερΜΔ' : 'ΠερΜΓρ.') : p.kind === 'Εθνική' ? (r === 'gm' ? 'ΜΔ' : 'ΜΓρ.') : ROLE_LABEL[r];
    if (o.id) add(o.id, { kind: r, label: `${kind} — ${T(p.short)}`, short: `${kind} ${T(p.short)}`, href: `#/provinces/edit/${p.id}`, province: p });
  }
  omemo = { head: db.head, by };
  return by;
}
export const officesOf = (memberId) => (memberId ? officesIndex().get(canonicalId(memberId)) || [] : []);

// Σύνδεση με μέλος κατά την αποθήκευση: αν δόθηκε μέλος → το όνομα ακολουθεί το Μητρώο· αν άλλαξε το κείμενο → νέα ταύτιση
export function linkOfficer(d, idKey, textKey, lodgeNo = null, old = null) {
  const text = T(d[textKey]), id = Number(d[idKey]) || null, m = id ? db.get('member_registry', id) : null;
  if (!text) { d[idKey] = null; return d; }
  const changed = old && T(old[textKey]) !== text && !(m && fullName(m) === text);
  d[idKey] = m && !changed ? m.id : matchMember(text, lodgeNo);
  return d;
}

// Εφάπαξ: σύνδεση των υπαρχόντων ονομάτων (κείμενο) με μέλη του Μητρώου — μόνο όπου η ταύτιση είναι μοναδική.
// Τα υπόλοιπα μένουν «⚠ χωρίς σύνδεση» για έλεγχο (Αρχείο Στοών / Στοές / Επαρχίες).
db.migrate('officers-link-members-2026-11', (tx) => {
  for (const l of tx.all('lodges')) {
    const patch = {};
    for (const r of ['master', 'secretary']) if (!Number(l[r + '_id'])) { const id = matchMember(lodgeText(l, r), l.number); if (id) patch[r + '_id'] = id; }
    if (Object.keys(patch).length) tx.update('lodges', l.id, patch);
  }
  for (const p of tx.all('grand_lodges')) {
    const patch = {};
    for (const pre of ['master', 'secretary']) if (!Number(p[pre + '_id'])) { const id = matchMember(T(p[pre + '_name'])); if (id) patch[pre + '_id'] = id; }
    if (Object.keys(patch).length) tx.update('grand_lodges', p.id, patch);
  }
});
