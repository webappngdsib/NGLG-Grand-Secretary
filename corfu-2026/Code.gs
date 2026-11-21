/**
 * Corfu 2026 · Google Apps Script / standalone project.
 * Run setupCorfuSync() while signed in as grand.secretary@nglgreece.gr.
 * Set Script Property GITHUB_TOKEN to a fine-grained GitHub token with Contents: read/write
 * ONLY for repository webappngdsib/NGLG-Grand-Secretary. Never put the token in GitHub Pages.
 *
 * Scans incoming, original messages with subject ΜΕΤΑΚΙΝΗΣΗ ΚΕΡΚΥΡΑ ΟΝΟΜΑΤΕΠΩΝΥΜΟ.
 * Replies, forwards, cancellation-only messages and dinner-only confirmations are excluded.
 * Names + accommodation notes are publicly visible: obtain office approval before enabling.
 */
const YEARBOOK_2026 = [
  {name:'ΦΙΛΙΠΠΟΣ ΔΗΜΗΤΡΙΟΥ',title:'Μέγας Νομοφύλαξ',aliases:['ΔΗΜΗΤΡΙΟΥ ΦΙΛΙΠΠΟΣ']},
  {name:'ΤΑΣΟΣ ΑΛΜΠΑΝΗΣ',title:'Αναπληρωτής Μέγας Διδάσκαλος',aliases:['ΑΝΑΣΤΑΣΙΟΣ ΑΛΜΠΑΝΗΣ','ΑΛΜΠΑΝΗΣ ΑΝΑΣΤΑΣΙΟΣ']}
];
// Προσοχή: συμπληρώνετε τον κατάλογο από την τρέχουσα επίσημη Επετηρίδα πριν νέα επαλήθευση.
const CFG = {
  repo:'webappngdsib/NGLG-Grand-Secretary',
  path:'corfu-2026/attendees.json',
  mailbox:'grand.secretary@nglgreece.gr',
  // Θέματα «ΜΕΤΑΚΙΝΗΣΗ ΚΕΡΚΥΡΑ …», «Μετακίνηση και διαμονή – Όνομα», «ΔΙΑΜΟΝΗ …» — με ή χωρίς τόνους.
  query:'after:2026/11/01 subject:(ΜΕΤΑΚΙΝΗΣΗ OR Μετακίνηση OR μετακινηση OR ΚΕΡΚΥΡΑ OR Κέρκυρα OR ΔΙΑΜΟΝΗ OR Διαμονή OR διαμονη) -in:trash -in:spam'
};

function setupCorfuSync(){
  if (!PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')) {
    throw Error('Add Script Property GITHUB_TOKEN first.');
  }
  ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()==='syncCorfu2026').forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('syncCorfu2026').timeBased().everyHours(2).create();
  syncCorfu2026();
}
function testCorfuSync(){ const prev=JSON.parse(githubFile_().content||'{"attendees":[]}'); const rows = extractDeclarations_(knownByEmail_(prev.attendees)); console.log(JSON.stringify(rows,null,2)); }
// email → ονοματεπώνυμο από όσους έχουν ήδη δηλώσει (για συμπληρωματικά email χωρίς όνομα, π.χ. «ΔΙΑΜΟΝΗ ΚΕΡΚΥΡΑ»)
// Χειροκίνητο σχόλιο + νέες αυτόματες σημειώσεις (κάθε πρόταση μία φορά)
function mergeNotes_(manual,auto){ const m=String(manual||'').trim(); const add=String(auto||'').split(/(?<=\.)\s+/).map(x=>x.trim()).filter(x=>x&&!m.includes(x)); return [m,...add].filter(Boolean).join(' '); }
function knownByEmail_(list){ const m={}; (list||[]).forEach(a=>{ const e=String(a.email||'').toLowerCase(); if(e && e!==CFG.mailbox.toLowerCase()) m[e]=a.name; }); return m; }
function syncCorfu2026(){
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const previous=githubFile_();
    const old=JSON.parse(previous.content || '{"attendees":[]}');
    const existing=new Map((old.attendees||[]).map(x=>[key_(x.name),x]));
    const extracted=extractDeclarations_(knownByEmail_(old.attendees));
    if (!extracted.length && (old.attendees||[]).length) throw Error('No declarations; abort to preserve existing list');
    const attendees=extracted.map(x=>{
      const prior=existing.get(key_(x.name));
      if (!prior) return x;
      // Πεδία «κλειδωμένα» από χειροκίνητη καταχώριση της Γραμματείας δεν αλλάζουν ποτέ αυτόματα.
      const lock={}; (prior.locked||[]).forEach(f=>{lock[f]=prior[f];}); if(prior.locked) lock.locked=prior.locked;
      return {...x,...lock,email:x.email||prior.email||'',comments:mergeNotes_(prior.comments,x.comments),hotel_status:
        prior.hotel_status==='Επιβεβαιωμένη κράτηση'?'Επιβεβαιωμένη κράτηση':x.hotel_status};
    }).sort((a,b)=>a.name.localeCompare(b.name,'el'));
    // Maintain entries previously manually verified if extraction does not find the source yet.
    for(const prev of old.attendees||[]) {
      if (!attendees.some(x=>key_(x.name)===key_(prev.name))) attendees.push(prev);
    }
    attendees.sort((a,b)=>a.name.localeCompare(b.name,'el'));
    const result={
      event:'Τακτική Μεγάλη Συνέλευση Κέρκυρα — 19 Δεκεμβρίου 2026',
      source_mailbox:CFG.mailbox,mode:'automatic',last_sync:new Date().toISOString(),
      refresh_hours:2,attendees
    };
    const token=PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    const req={
      message:'Update Corfu 2026 declarations from secretary Gmail',
      content:Utilities.base64Encode(Utilities.newBlob(JSON.stringify(result,null,2)+'\n').getBytes()),
      sha:previous.sha
    };
    const response=UrlFetchApp.fetch('https://api.github.com/repos/'+CFG.repo+'/contents/'+CFG.path,{
      method:'put',contentType:'application/json',
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28'},
      payload:JSON.stringify(req),muteHttpExceptions:true
    });
    if (response.getResponseCode()<200 || response.getResponseCode()>299) {
      throw Error('GitHub update failed HTTP '+response.getResponseCode()+': '+response.getContentText().slice(0,250));
    }
    console.log('Synced '+attendees.length+' names');
    return {count:attendees.length,last_sync:result.last_sync};
  } finally { lock.releaseLock(); }
}

/**
 * Web app deployment must use:
 *   Execute as: Me (grand.secretary@nglgreece.gr)
 *   Who has access: Only myself — NEVER Anyone or Anyone with Google account.
 * Only the signed-in owner may trigger Gmail reads and GitHub writes.
 */
function doGet(e) {
  if (String((e && e.parameter && e.parameter.action) || '') !== 'sync') {
    return HtmlService.createHtmlOutput('Δεν διατίθεται αυτή η ενέργεια.');
  }
  const owner=String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (owner !== CFG.mailbox.toLowerCase()) {
    return HtmlService.createHtmlOutput('Εκτελέστε την εφαρμογή μόνο από τον λογαριασμό της Μεγάλης Γραμματείας.');
  }
  const page=[
    '<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Συγχρονισμός Gmail — Κέρκυρα</title>',
    '<style>body{font:16px system-ui;background:#f4f7fb;color:#183350;padding:28px;max-width:650px;margin:auto}main{background:#fff;padding:25px;border-radius:14px;box-shadow:0 3px 25px #152b4620}h1{font-size:23px}p{line-height:1.6}a{color:#145078;font-weight:bold}</style></head>',
    '<body><main><h1>Κέρκυρα 2026 · Άμεση ενημέρωση Gmail</h1><p id="status">Γίνεται ανάγνωση δηλώσεων και αποστολή των ενημερωμένων δεδομένων στο GitHub…</p>',
    '<p><a target="_blank" rel="noopener" href="https://webappngdsib.github.io/NGLG-Grand-Secretary/corfu-2026/">Επιστροφή στη λίστα μετακίνησης</a></p></main>',
    '<script>google.script.run.withSuccessHandler(function(r){document.getElementById("status").textContent="Ο συγχρονισμός ολοκληρώθηκε. "+r.count+" εγγραφές στάλθηκαν στο GitHub. Η ενημέρωση του GitHub Pages ακολουθεί μετά τη δημοσίευση.";}).withFailureHandler(function(e){document.getElementById("status").textContent="Αποτυχία: "+(e&&e.message||"Άγνωστο σφάλμα");}).syncCorfu2026();</script></body></html>'
  ].join('');
  return HtmlService.createHtmlOutput(page).setTitle('Άμεση ενημέρωση Κέρκυρα 2026');
}

function githubFile_(){
  const token=PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  const resp=UrlFetchApp.fetch('https://api.github.com/repos/'+CFG.repo+'/contents/'+CFG.path,{
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'},
    muteHttpExceptions:true
  });
  if(resp.getResponseCode()!==200)throw Error('Cannot retrieve attendee file: '+resp.getResponseCode());
  const f=JSON.parse(resp.getContentText());
  return {sha:f.sha,content:Utilities.newBlob(Utilities.base64Decode(f.content.replace(/\s/g,''))).getDataAsString('UTF-8')};
}
function key_(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('el-GR').replace(/\s+/g,' ').trim();}
// Καθαρίζει υποψήφιο ονοματεπώνυμο: αφαιρεί παύλες/άνω-κάτω τελεία στην αρχή και (παρενθέσεις).
function cleanName_(s){
  return String(s||'').replace(/\([^)]*\)/g,' ').replace(/^[\s\-–—:,.]+/,'').replace(/[\s\-–—.,;:]+$/,'').replace(/\s+/g,' ').trim();
}
function isName_(s){
  const w=String(s||'').split(/\s+/).filter(Boolean);
  return w.length>=2 && w.length<=5 && w.every(k=>/^[\p{L}΄'’-]+$/u.test(k));
}
// Όνομα από τις πρώτες γραμμές του σώματος, όταν είναι γραμμένο ΚΕΦΑΛΑΙΑ (π.χ. «ΛΑΓΙΟΣ ΦΩΤΗΣ (Μεγ. Επιμελητής)»).
function bodyHeaderName_(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,3);
  for(const line of lines){
    const c=cleanName_(line);
    if(!isName_(c) || c.split(/\s+/).length>4) continue;
    if(c!==c.toLocaleUpperCase('el-GR')) continue;
    if(/ΜΕΤΑΚΙΝΗΣΗ|ΚΕΡΚΥΡΑ/.test(key_(c))) continue;
    return c;
  }
  return '';
}
function extractDeclarations_(known){
  known=known||{};
  const found=new Map();let start=0;
  while(true){
    const threads=GmailApp.search(CFG.query,start,100);
    if(!threads.length)break;
    for(const thread of threads){
      for(const msg of thread.getMessages()){
        const subject=String(msg.getSubject()||'').trim();
        // Do not use replies, even if the original subject is quoted.
        if (/^(re|fw|fwd|απ|σχετ)\s*:/i.test(subject)) continue;
        const fromEmail = (String(msg.getFrom()||'').match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,})>?/i)||[])[1] || '';
        // Μηνύματα από τον λογαριασμό της Γραμματείας: δεκτά μόνο ως δήλωση σε πρώτο πρόσωπο (έλεγχος πιο κάτω).
        const own = fromEmail.toLowerCase()===CFG.mailbox.toLowerCase();
        // Θέμα (χωρίς τόνους, κεφαλαία): «ΜΕΤΑΚΙΝΗΣΗ [ΚΑΙ ΔΙΑΜΟΝΗ] [ΚΕΡΚΥΡΑ] [– Όνομα]», «ΔΙΑΜΟΝΗ …», «ΚΕΡΚΥΡΑ ΜΕΤΑΚΙΝΗΣΗ [Όνομα]»
        const subjKey=key_(subject);
        const match=subjKey.match(/^(?:ΜΕΤΑΚΙΝΗΣΗ|ΔΙΑΜΟΝΗ)(?:\s*(?:ΚΑΙ|&|[-–—\/,])\s*(?:ΔΙΑΜΟΝΗ|ΜΕΤΑΚΙΝΗΣΗ))?(?:\s+ΚΕΡΚΥΡΑΣ?)?(?:\s*[-–—:]?\s*(.+))?$/)
          || subjKey.match(/^ΚΕΡΚΥΡΑ\s+(?:ΜΕΤΑΚΙΝΗΣΗ|ΔΙΑΜΟΝΗ)(?:\s*(?:ΚΑΙ|&|[-–—\/,])\s*(?:ΔΙΑΜΟΝΗ|ΜΕΤΑΚΙΝΗΣΗ))?(?:\s*[-–—:]?\s*(.+))?$/);
        if(!match)continue;
        // Email δηλούντος: ο αποστολέας· αν την καταχώρισε η Γραμματεία, ο μοναδικός παραλήπτης σε κοινοποίηση (cc).
        const ccs=String(msg.getCc()||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}/gi)||[];
        const sourceEmail = own && ccs.length===1 ? ccs[0] : fromEmail;
        const first=String(msg.getPlainBody()||'').split(/\n\s*(?:On .+wrote:|Στις .+έγραψε:|From:|Από:|[-]{3,}\s*Forwarded)/i)[0].slice(0,2500);
        // Το όνομα: (1) από το θέμα, (2) από ρητή υπογραφή με τίτλο («Σεβ. Αδ. …»),
        // (3) από γραμμή με ΚΕΦΑΛΑΙΑ στην αρχή του σώματος.
        const signature=first.match(/(?:^|\n)\s*(?:(?:Πσεβ\.|Λ\.Σεβ\.|Σεβ\.|Αδ\.)\s*){1,4}([\p{L}΄'’-]+\s+[\p{L}΄'’-]+)\s*(?=\r?\n|$)/iu);
        // (4) από το όνομα κάτω από την αποφώνηση («Με αδελφικούς χαιρετισμούς,» → «Γεώργιος Γκρίλλας»).
        const closing=first.match(/(?:χαιρετισμούς|χαιρετισμοί|αγάπη|εκτίμηση|αφοσίωση|ΜτΤΑΑ)[^\n]*\n(?:\s*\r?\n)*\s*([\p{L}΄'’-]+\s+[\p{L}΄'’-]+(?:\s+[\p{L}΄'’-]+)?)\s*(?:\r?\n|$)/iu);
        const candidates=[cleanName_(match[1]), cleanName_(signature&&signature[1]), bodyHeaderName_(first), cleanName_(closing&&closing[1])];
        // (5) αλλιώς: ο αποστολέας έχει ήδη δηλώσει → συμπληρωματικό email (διαμονή κ.λπ.) για τον ίδιο
        const rawName=candidates.find(isName_)||(!own && known[fromEmail.toLowerCase()])||'';
        if(!rawName)continue;
        const name=key_(rawName);
        const body=key_(first);
        if (/(ΔΕΝ ΘΑ (ΠΑΡΑΣΤ|ΜΕΤΑΒ|ΣΥΜΜΕΤ|ΕΡΘ|ΜΠΟΡ)|ΑΚΥΡΩΝ|ΑΔΥΝΑΤ|ΔΕΝ ΜΠΟΡ|ΔΥΣΤΥΧΩΣ)/.test(body))continue;
        // Από τη Γραμματεία: μόνο δήλωση σε πρώτο πρόσωπο, όχι απαντήσεις («Σας έχω συμπεριλάβει…», «Αγαπητέ Αδελφέ…»).
        if (own && (/ΣΑΣ (ΕΧΩ|ΕΧΟΥΜΕ)|ΣΑΣ ΣΥΜΠΕΡΙΛΑΒ|ΑΓΑΠΗΤΕ ΑΔΕΛΦΕ/.test(body)
          || !/(ΔΗΛΩΝΩ|ΕΠΙΘΥΜΩ|ΘΑ ΕΙΜΑΙ ΠΑΡΩΝ|ΘΑ ΜΕΤΑΒΩ|ΔΗΛΩΣΗ ΣΥΜΜΕΤΟΧΗΣ ΜΟΥ|ΘΑ ΣΥΜΜΕΤΑΣΧΩ|ΘΑ ΜΕΤΑΣΧΩ)/.test(body))) continue;
        const positive=/(ΔΗΛΩΝΩ|ΘΑ ΕΙΜΑΙ ΠΑΡΩΝ|ΘΑ ΜΕΤΑΣΧ|ΘΑ ΣΥΜΜΕΤ|ΘΑ ΕΡΘ|ΘΑ ΤΑΞΙΔΕΨ|ΕΠΙΒΕΒΑΙΩ|ΕΠΙΘΥΜΩ|ΣΥΜΜΕΤΟΧΗ ΜΟΥ|ΣΥΜΠΕΡΙΛΑΒ|ΘΑ ΜΕΤΑΚΙΝΗΘ|ΘΑ ΜΕΤΑΒΩ|ΚΡΑΤΗΣΤΕ|ΚΡΑΤΗΣΗ ΘΕΣΗΣ|ΔΗΛΩΣΗ ΣΥΜΜΕΤΟΧΗΣ ΜΟΥ)/.test(body);
        // Σύντομη δήλωση: θέμα «ΜΕΤΑΚΙΝΗΣΗ ΚΕΡΚΥΡΑ» και σώμα μόνο με το όνομα (π.χ. «Sent from my iPhone»).
        const residual=body.replace(/ΜΕΤΑΚΙΝΗΣΗ|ΚΕΡΚΥΡΑ/g,' ').split(key_(rawName)).join(' ')
          .replace(/SENT FROM MY \S+|ΣΤΑΛΘΗΚΕ ΑΠΟ \S+( \S+)?|GET OUTLOOK FOR \S+/g,' ').replace(/[^\p{L}]+/gu,'');
        if (!positive && residual.length>40) continue;
        const room=/ΔΙΚΛΙΝ/.test(body)?'Δίκλινο':/ΜΟΝΟΚΛΙΝ/.test(body)?'Μονόκλινο':'Δεν δηλώθηκε';
        const ownTransport=/(ΙΔΙΩΤΙΚΟ ΟΧΗΜΑ|ΙΔΙΩΤΙΚΟ ΜΕΣΟ|ΔΙΚΟ ΜΟΥ (ΑΥΤΟΚΙΝΗΤΟ|ΜΕΣΟ|ΟΧΗΜΑ)|ΙΔΙΟ ΜΕΣΟ|ΔΕΝ ΘΑ ΧΡΕΙΑΣΤΩ ΤΗΝ .{0,40}ΜΕΤΑΦΟΡΑ|ΔΕΝ ΘΑ (ΚΑΝΩ ΧΡΗΣΗ|ΧΡΗΣΙΜΟΠΟΙΗΣΩ) (ΤΟΥ |ΤΟ )?(ΛΕΩΦΟΡΕΙ|ΠΟΥΛΜΑΝ))/.test(body);
        const singleInDouble=/ΔΙΚΛΙΝ/.test(body) && /(ΜΟΝΟΣ ΜΟΥ|ΜΕΙΝΩ ΜΟΝΟΣ|ΑΠΟΚΛΕΙΣΤΙΚΑ ΓΙΑ ΕΜΕΝΑ|ΧΩΡΙΣ ΔΕΥΤΕΡΟ|ΗΜΙΣΥ|ΜΙΣΟ ΚΟΣΤΟΣ|ΤΑ ΜΙΣΑ|ΤΗ?Ν? ΔΙΑΦΟΡΑ)/.test(body);
        // Αυτόματη σημείωση (μένει μόνο αν δεν υπάρχει ήδη χειροκίνητο σχόλιο).
        const autoNote=[ownTransport?'Δεν θα χρησιμοποιήσει το λεωφορείο (ίδιο μέσο).':'',
          singleInDouble?'Μόνος σε δίκλινο, με το ήμισυ του κόστους δίκλινου.':'',
          own?'Καταχωρίστηκε από τη Μεγάλη Γραμματεία.':''].filter(String).join(' ');
        const officer = YEARBOOK_2026.find(o => [o.name,...o.aliases].some(a=>key_(a)===key_(name)));
        const item={name,email:sourceEmail,title:officer?officer.title:'Προς επαλήθευση',
          officer_status:officer?'Εν ενεργεία — Επετηρίδα 2026':'Δεν έχει επαληθευθεί',
          travel:ownTransport?'Ιδιωτικό όχημα (όχι πούλμαν) — 18–20/12/2026':'18–20/12/2026',room,
          hotel_status:'Εκκρεμεί',
          declaration_date:Utilities.formatDate(msg.getDate(),'Europe/Athens','yyyy-MM-dd'),
          comments:autoNote,_time:msg.getDate().getTime()};
        const k=key_(name);
        // Πολλά email του ίδιου: συνδυάζονται (το νεότερο υπερισχύει, αλλά δεν χάνονται δωμάτιο/μετακίνηση/σημειώσεις)
        const prev=found.get(k);
        if(!prev){ found.set(k,item); }
        else {
          const [older,newer]=prev._time<=item._time?[prev,item]:[item,prev];
          const notes=[...new Set([older.comments,newer.comments].join(' ').split(/(?<=\.)\s+/).map(x=>x.trim()).filter(Boolean))].join(' ');
          found.set(k,{...older,...newer,
            name:older.name, email:older.email||newer.email,
            room:newer.room!=='Δεν δηλώθηκε'?newer.room:older.room,
            travel:/Ιδιωτικό/.test(newer.travel+older.travel)?'Ιδιωτικό όχημα (όχι πούλμαν) — 18–20/12/2026':newer.travel,
            declaration_date:older.declaration_date, comments:notes});
        }
      }
    }
    if(threads.length<100)break;
    start+=100;
  }
  return [...found.values()].map(({_time,...v})=>v);
}
