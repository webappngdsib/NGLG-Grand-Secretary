#!/usr/bin/env python3
"""Έλεγχος ιδιότητας δηλούντα (Κέρκυρα 2026) — ΥΠΟΧΡΕΩΤΙΚΟΣ σε κάθε νέα εγγραφή.

Για κάθε όνομα ψάχνει σε τρεις πηγές του ιδιωτικού αποθετηρίου δεδομένων (nglg-grammateia-data):
  1. Επετηρίδα (data/epeteirida.json) — αξίωμα, Ενεργός, «Εν ενεργεία αξίωμα»
  2. Λίστα Μεγάλων Επιμελητών — οι γραμμές της Επετηρίδας με «Μέγας Επιμελητής» και Ενεργός = ΝΑΙ, με τη Στοά τους
     (ίδιος κανόνας με modules/grand-stewards.js)
  3. Γενικό Μητρώο Μελών (data/member_registry.json + data/member_lodges.json) — βαθμός, ενεργός, Στοές
και επιπλέον στον επίσημο κατάλογο των εν ενεργεία ΜΑΞ (corfu-2026/active-officers.json).

Τα αποτελέσματα τυπώνονται ΜΟΝΟ στο τερματικό — δεν γράφεται τίποτα στο (δημόσιο) αποθετήριο.

Χρήση:
  python3 corfu-2026/tools/check-member.py --data /home/user/nglg-grammateia-data/data            # όλοι οι δηλώσαντες
  python3 corfu-2026/tools/check-member.py --data <dir> "ΤΖΙΒΑΣ ΑΘΑΝΑΣΙΟΣ" "Ροής Σπυρίδων"            # συγκεκριμένα ονόματα
"""
import argparse, json, os, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
CORFU = os.path.dirname(HERE)


def fold(s):
    s = unicodedata.normalize('NFD', str(s or '').upper())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').replace('Ϊ', 'Ι').replace('Ϋ', 'Υ')
    return [t for t in ''.join(c if c.isalnum() else ' ' for c in s).split() if t]


# Υποκοριστικά → επίσημο όνομα (όπως γράφονται στις δηλώσεις)
NICK = {'ΤΑΣΟΣ': 'ΑΝΑΣΤΑΣΙΟΣ', 'ΝΑΣΟΣ': 'ΑΘΑΝΑΣΙΟΣ', 'ΘΑΝΑΣΗΣ': 'ΑΘΑΝΑΣΙΟΣ', 'ΣΠΥΡΟΣ': 'ΣΠΥΡΙΔΩΝ', 'ΣΠΥΡΙΔΩΝΑΣ': 'ΣΠΥΡΙΔΩΝ',
        'ΦΩΤΗΣ': 'ΦΩΤΙΟΣ', 'ΚΩΣΤΑΣ': 'ΚΩΝΣΤΑΝΤΙΝΟΣ', 'ΚΩΝ': 'ΚΩΝΣΤΑΝΤΙΝΟΣ', 'ΓΙΑΝΝΗΣ': 'ΙΩΑΝΝΗΣ', 'ΓΙΩΡΓΟΣ': 'ΓΕΩΡΓΙΟΣ',
        'ΝΙΚΟΣ': 'ΝΙΚΟΛΑΟΣ', 'ΔΗΜΗΤΡΗΣ': 'ΔΗΜΗΤΡΙΟΣ', 'ΜΗΤΣΟΣ': 'ΔΗΜΗΤΡΙΟΣ', 'ΠΑΝΟΣ': 'ΠΑΝΑΓΙΩΤΗΣ', 'ΤΑΚΗΣ': 'ΠΑΝΑΓΙΩΤΗΣ',
        'ΒΑΣΙΛΗΣ': 'ΒΑΣΙΛΕΙΟΣ', 'ΘΟΔΩΡΗΣ': 'ΘΕΟΔΩΡΟΣ', 'ΜΙΧΑΛΗΣ': 'ΜΙΧΑΗΛ', 'ΣΤΕΛΙΟΣ': 'ΣΤΥΛΙΑΝΟΣ', 'ΛΕΥΤΕΡΗΣ': 'ΕΛΕΥΘΕΡΙΟΣ',
        'ΑΛΕΚΟΣ': 'ΑΛΕΞΑΝΔΡΟΣ', 'ΧΑΡΗΣ': 'ΧΑΡΑΛΑΜΠΟΣ', 'ΜΠΑΜΠΗΣ': 'ΧΑΡΑΛΑΜΠΟΣ', 'ΓΡΗΓΟΡΗΣ': 'ΓΡΗΓΟΡΙΟΣ', 'ΠΑΝΤΕΛΗΣ': 'ΠΑΝΤΕΛΕΗΜΩΝ'}


def first_ok(a, b):
    a, b = NICK.get(a, a), NICK.get(b, b)
    return a == b or (len(a) > 3 and len(b) > 3 and a[:4] == b[:4])


def match(query, surname, first):
    """'full' όταν ταιριάζει επώνυμο + όνομα (σε οποιαδήποτε σειρά), 'surname' μόνο για επώνυμο."""
    q, s, f = fold(query), fold(surname), fold(first)
    if not s or not all(t in q for t in s):
        return ''
    rest = [t for t in q if t not in s]
    return 'full' if any(first_ok(a, b) for a in rest for b in f) else 'surname'


def split_full(name):
    t = str(name or '').split()
    return (t[0], ' '.join(t[1:])) if t else ('', '')


def load(p):
    with open(p, encoding='utf-8') as fh:
        return json.load(fh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True, help='φάκελος data/ του nglg-grammateia-data')
    ap.add_argument('names', nargs='*')
    a = ap.parse_args()
    ep = load(os.path.join(a.data, 'epeteirida.json'))
    reg = load(os.path.join(a.data, 'member_registry.json'))
    ml = load(os.path.join(a.data, 'member_lodges.json'))
    officers = load(os.path.join(CORFU, 'active-officers.json'))['officers']
    names = a.names or [x['name'] for x in load(os.path.join(CORFU, 'attendees.json'))['attendees']]
    lodges = {}
    for x in ml:
        lodges.setdefault(x['member_id'], []).append(f"{x['lodge_name']} {x['lodge_number']} ({x['member_status']})")

    def is_steward(r):
        return r.get('active') == 1 and str(r.get('title', '')).startswith('Μέγας Επιμελητής')

    for n in names:
        print(f'\n━━ {n}')
        off = [o for o in officers if any(match(n, *split_full(x)) == 'full' for x in [o['name'], *o.get('aliases', [])])]
        print('  Κατάλογος 31 ΜΑΞ :', '; '.join(f"{o['title']} (Δ. {o['decree']})" for o in off) or '—')
        alt = [n] + [x for o in off for x in [o['name'], *o.get('aliases', [])]]  # και με το επίσημο όνομα/παραλλαγές
        regs = []
        for m in reg:
            sur = [m['surname'], *str(m.get('surname_variants') or '').replace(';', ',').split(',')]
            fst = ' '.join([m['first_name'], str(m.get('first_name_variants') or '').replace(';', ' ').replace(',', ' ')])
            if any(match(q, s, fst) == 'full' for s in sur if s.strip() for q in alt):
                regs.append(m)
        ids = {m['id'] for m in regs}
        rows = [r for r in ep if (r.get('member_id') in ids) or any(match(q, *split_full(r['full_name'])) == 'full' for q in alt)]
        st = [r for r in rows if is_steward(r)]
        print('  Λίστα Επιμελητών :', '; '.join(f"Μέγας Επιμελητής — Στ. {r['province']} ({r['current']})" for r in st) or '—')
        print('  Επετηρίδα        :', '; '.join(f"{r['title']}{' [Ενεργός]' if r.get('active') == 1 else ''}"
                                             f"{' — ' + r['province'] if r.get('province') else ''}"
                                             f"{' — ' + r['current'] if r.get('current') else ''}" for r in rows) or '—')
        if not regs:
            print('  Γενικό Μητρώο    : — (δεν βρέθηκε· ελέγξτε ορθογραφία/παραλλαγές)')
        for m in regs:
            print(f"  Γενικό Μητρώο    : #{m['registry_no']} {m['surname']} {m['first_name']} — {m.get('degree') or ''}"
                  f"{'' if m.get('active') == 1 else ' [ανενεργός]'} — Στοές: {', '.join(lodges.get(m['id'], [])) or '—'}")
        if not rows and not regs:
            cand = sorted({f"{r['full_name']} ({r['title']}{', ' + r['province'] if r.get('province') else ''})" for r in ep
                           if r.get('active') == 1 and match(n, *split_full(r['full_name'])) == 'surname'})
            print('  Πιθανά (επώνυμο) :', '; '.join(cand) or '—')
        verdict = (off[0]['title'] if off else 'Μέγας Επιμελητής — Στ. ' + st[0]['province'] if st
                   else next((r['title'] for r in rows if r.get('active') == 1), '') or 'ΟΧΙ εν ενεργεία ΜΑΞ — να επαληθευθεί')
        print('  ⇒ Ιδιότητα       :', verdict)


if __name__ == '__main__':
    sys.exit(main())
