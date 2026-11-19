// node tests/gas/intent_portal.test.js — ΕΝΗΜΕΡΩΣΗ ΠΡΟΘΕΣΗΣ ΔΙΟΡΙΣΜΩΝ: δημοσίευση → κωδικός SKIADO#### (1 ώρα) → καταγραφή → λήψη από την εφαρμογή
const assert = require('assert');
const { makeEnv } = require('./harness');
const E = makeEnv();
E.props.ADMIN_KEY = 'k';
const decree = { id: 7, no: '520', year: '2026', date: '2026-11-01', matter: 'Διορισμού', protocol: '20601 ΠΡΟΘΕΣΗ', kind: 'appoint',
  people: [{ i: 0, name: 'Γεώργιος Δοκιμαστής', office: 'Μέγας Γραμματεύς', label: 'Πρόθεση Διορισμού', fee: 150, mobile: '6900000000', email: 'g@example.com' },
    { i: 1, name: 'Νίκος Δεύτερος', office: 'Μέγας Ξιφοφόρος', label: 'Πρόθεση Διορισμού', fee: 80 }] };
let r = E.call({ action: 'admin_intent_push', key: 'k', emails: ['Viewer@Example.com', 'όχι-email'], decrees: [decree] });
assert.ok(r.ok && r.decrees === 1 && r.people === 2 && r.emails === 1, JSON.stringify(r));
assert.equal(E.call({ action: 'admin_intent_push', key: 'x', decrees: [] }).error, 'admin_unauthorized');
// άγνωστο email: ίδια απάντηση, κανένα email
assert.ok(E.call({ action: 'intent_otp_send', email: 'nobody@example.com' }).ok && E.mails.length === 0);
r = E.call({ action: 'intent_otp_send', email: 'viewer@example.com' });
assert.ok(r.ok && E.mails.length === 1 && /^ΕΝΗΜΕΡΩΣΗ ΠΡΟΘΕΣΗΣ ΔΙΟΡΙΣΜΩΝ — κωδικός SKIADO\d{4}$/.test(E.mails[0].subject) && /μία ώρα/.test(E.mails[0].htmlBody), E.mails[0].subject);
const code = /(SKIADO\d{4})/.exec(E.mails[0].subject)[1];
assert.equal(E.call({ action: 'intent_otp_verify', email: 'viewer@example.com', code: 'SKIADO' + (code.endsWith('0000') ? '1111' : '0000') }).error, 'otp_wrong');
r = E.call({ action: 'intent_otp_verify', email: 'viewer@example.com', code: code.toLowerCase() });
assert.ok(r.ok && r.session && r.decrees.length === 1 && r.decrees[0].people.length === 2, JSON.stringify(r));
// ο κωδικός ισχύει για μία ώρα: ξανά είσοδος με τον ίδιο κωδικό (μόνο τα 4 ψηφία)
assert.ok(E.call({ action: 'intent_otp_verify', email: 'viewer@example.com', code: code.slice(6) }).ok);
const S = r.session;
assert.equal(E.call({ action: 'intent_save', session: 'y'.repeat(40), decree_id: 7, i: 0 }).error, 'unauthorized');
assert.equal(E.call({ action: 'intent_save', session: S, decree_id: 7, i: 9 }).error, 'not_found');
r = E.call({ action: 'intent_save', session: S, decree_id: 7, i: 0, answer: 'yes', paid: '100,50', paid_at: '2026-11-19', mobile: '6911111111', email: 'G2@Example.com', free: false });
assert.ok(r.ok && r.person.paid === 100.5 && r.person.answer === 'yes' && r.person.email === 'g2@example.com', JSON.stringify(r));
r = E.call({ action: 'intent_save', session: S, decree_id: 7, i: 1, answer: 'maybe', free: true });
assert.ok(r.person.answer === '' && r.person.free === true);
r = E.call({ action: 'intent_load', session: S });
assert.equal(r.decrees[0].people[0].paid_at, '2026-11-19');
// εφαρμογή: μία (η τελευταία) αλλαγή ανά Αδελφό· νέα δημοσίευση δεν την πατά μέχρι τη λήψη
E.call({ action: 'intent_save', session: S, decree_id: 7, i: 0, answer: 'yes', paid: 150, paid_at: '2026-11-20', mobile: '6911111111', email: 'g2@example.com', free: false });
r = E.call({ action: 'admin_intent_pull', key: 'k' });
assert.ok(r.changes.length === 2 && r.changes.find((c) => c.i === 0).values.paid === 150 && r.changes[0].by === 'viewer@example.com', JSON.stringify(r));
E.call({ action: 'admin_intent_push', key: 'k', emails: ['viewer@example.com'], decrees: [decree] });
assert.equal(E.call({ action: 'intent_load', session: S }).decrees[0].people[0].paid, 150, 'η αλλαγή που περιμένει λήψη μένει');
assert.equal(E.call({ action: 'admin_intent_ack', key: 'k', ids: r.changes.map((c) => c.id) }).left, 0);
// αφαίρεση πρόσβασης: η σύνδεση σταματά
E.call({ action: 'admin_intent_push', key: 'k', emails: [], decrees: [decree] });
assert.equal(E.call({ action: 'intent_load', session: S }).error, 'unauthorized');
console.log('intent portal: OK');
