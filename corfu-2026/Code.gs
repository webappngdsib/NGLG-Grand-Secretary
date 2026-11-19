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
  query:'after:2026/11/01 {subject:ΜΕΤΑΚΙΝΗΣΗ subject:ΚΕΡΚΥΡΑ} -in:trash -in:spam'
};

function setupCorfuSync(){
  if (!PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')) {
    throw Error('Add Script Property GITHUB_TOKEN first.');
  }
  ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()==='syncCorfu2026').forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('syncCorfu2026').timeBased().everyHours(2).create();
  syncCorfu2026();
}
function testCorfuSync(){ const rows = extractDeclarations_(); console.log(JSON.stringify(rows,null,2)); }
function syncCorfu2026(){
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const previous=githubFile_();
    const old=JSON.parse(previous.content || '{"attendees":[]}');
    const existing=new Map((old.attendees||[]).map(x=>[key_(x.name),x]));
    const extracted=extractDeclarations_();
    if (!extracted.length && (old.attendees||[]).length) throw Error('No declarations; abort to preserve existing list');
    const attendees=extracted.map(x=>{
      const prior=existing.get(key_(x.name));
      if (!prior) return x;
      return {...x,comments:prior.comments||'',hotel_status:
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
function extractDeclarations_(){
  const found=new Map();let start=0;
  while(true){
    const threads=GmailApp.search(CFG.query,start,100);
    if(!threads.length)break;
    for(const thread of threads){
      for(const msg of thread.getMessages()){
        const subject=String(msg.getSubject()||'').trim();
        // Do not use replies, even if the original subject is quoted.
        if (/^(re|fw|fwd)\s*:/i.test(subject)) continue;
        const match=subject.match(/^ΜΕΤΑΚΙΝΗΣΗ\s+ΚΕΡΚΥΡΑ(?:\s+(.+))?$/i)
          || subject.match(/^ΚΕΡΚΥΡΑ\s+ΜΕΤΑΚΙΝΗΣΗ(?:\s+(.+))?$/i);
        if(!match)continue;
        const first=String(msg.getPlainBody()||'').split(/\n\s*(?:On .+wrote:|Στις .+έγραψε:|From:|Από:|[-]{3,}\s*Forwarded)/i)[0].slice(0,2500);
        // Subject may be exactly "ΜΕΤΑΚΙΝΗΣΗ ΚΕΡΚΥΡΑ" with name only in a signed body.
        // Require explicit title ("Σεβ. Αδ." etc.) to avoid treating ordinary prose as a name.
        const signature=first.match(/(?:^|\n)\s*(?:(?:Πσεβ\.|Λ\.Σεβ\.|Σεβ\.|Αδ\.)\s*){1,4}([\p{L}΄'’-]+\s+[\p{L}΄'’-]+)\s*(?=\r?\n|$)/iu);
        const rawName=String(match[1] || (signature&&signature[1]) || '').replace(/[\s.,;:]+$/g,'').trim();
        const names=rawName.split(/\s+/);
        if(names.length<2 || names.length>5 || !names.every(k=>/^[\p{L}΄'’-]+$/u.test(k)))continue;
        const name=key_(rawName);
        const body=key_(first);
        if (/(ΔΕΝ ΘΑ (ΠΑΡΑΣΤ|ΜΕΤΑΒ|ΣΥΜΜΕΤ|ΕΡΘ)|ΑΚΥΡΩΝ|ΑΔΥΝΑΤ|ΔΕΝ ΜΠΟΡ)/.test(body))continue;
        if (!/(ΔΗΛΩΝΩ|ΘΑ ΕΙΜΑΙ ΠΑΡΩΝ|ΘΑ ΜΕΤΑΣΧ|ΘΑ ΣΥΜΜΕΤ|ΘΑ ΕΡΘ|ΘΑ ΤΑΞΙΔΕΨ|ΕΠΙΒΕΒΑΙΩΝΩ|ΕΠΙΘΥΜΩ|ΣΥΜΜΕΤΟΧΗ ΜΟΥ)/.test(body)) continue;
        const room=/ΔΙΚΛΙΝ/.test(body)?'Δίκλινο':/ΜΟΝΟΚΛΙΝ/.test(body)?'Μονόκλινο':'Δεν δηλώθηκε';
        const sourceEmail = (String(msg.getFrom()||'').match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,})>?/i)||[])[1] || '';
        const officer = YEARBOOK_2026.find(o => [o.name,...o.aliases].some(a=>key_(a)===key_(name)));
        const item={name,email:sourceEmail,title:officer?officer.title:'Προς επαλήθευση',
          officer_status:officer?'Εν ενεργεία — Επετηρίδα 2026':'Δεν έχει επαληθευθεί',travel:'18–20/12/2026',room,
          hotel_status:'Εκκρεμεί',
          declaration_date:Utilities.formatDate(msg.getDate(),'Europe/Athens','yyyy-MM-dd'),
          comments:'',_time:msg.getDate().getTime()};
        const k=key_(name);
        if(!found.has(k)||found.get(k)._time<item._time)found.set(k,item);
      }
    }
    if(threads.length<100)break;
    start+=100;
  }
  return [...found.values()].map(({_time,...v})=>v);
}
