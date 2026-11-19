"use strict";
const S={data:null,teamMap:new Map(),compMap:new Map(),matchMap:new Map(),venueMap:new Map(),favorite:null,calendar:{team:"all",comp:"all",range:"all"},standings:{comp:null},searchOpen:false,favoritePicker:false,loading:false,selected:null};
const KEY_FAVORITE="virtus-info-favorite-v1",KEY_DATA="virtus-info-valid-data-v1";
const $=q=>document.querySelector(q);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const route=(t,id)=>"#"+t+(id?"/"+encodeURIComponent(id):"");
const parseRoute=()=>{const [name,param]=(location.hash.slice(1)||"home").split("/");return [name,decodeURIComponent(param||"")]};
const fmt=(date,options)=>{try{return new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",...options}).format(new Date(date))}catch{return "Da definire"}};
const time=date=>date?fmt(date,{hour:"2-digit",minute:"2-digit"}):"Da definire";
const day=date=>date?fmt(date,{weekday:"short",day:"numeric",month:"short"}):"Data da definire";
const dayLong=date=>date?fmt(date,{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"Data da definire";
const isPlayed=m=>m.status==="played"&&Array.isArray(m.score);
const team=id=>S.teamMap.get(id)||{id,name:"Squadra non disponibile",isVirtus:false};
const competition=id=>S.compMap.get(id)||{id,name:"Campionato",short:"Campionato"};
const venue=id=>S.venueMap.get(id);
const teamName=id=>team(id).name;
const iconTeam=id=>{const t=team(id);return t.logo?'<img src="'+esc(t.logo)+'" loading="lazy" alt="">':'<span class="small-logo">'+esc((t.name||"?").slice(0,2).toUpperCase())+'</span>'};
const bigIcon=id=>{const t=team(id);return t.logo?'<img src="'+esc(t.logo)+'" loading="lazy" alt="">':'<span class="team-letter">'+esc((t.name||"?").slice(0,2).toUpperCase())+'</span>'};
const hasTeam=(m,id)=>m.homeId===id||m.awayId===id;
const matchesFor=id=>S.data.matches.filter(m=>hasTeam(m,id));
const upcoming=a=>a.filter(m=>!isPlayed(m)&&m.datetime&&new Date(m.datetime).getTime()>=Date.now()-3*3600000).sort((a,b)=>a.datetime.localeCompare(b.datetime));
const previous=a=>a.filter(isPlayed).sort((a,b)=>(b.datetime||"").localeCompare(a.datetime||""));
const foot=()=>S.data?'<p class="detail center">Dati FIPAV · Aggiornati '+esc(fmt(S.data.updatedAt,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))+' · Risultati non in tempo reale</p>':"";
function assignData(d){
 if(!d||d.mode!=="official"||d.provenance?.method!=="direct-fipav"||!Array.isArray(d.matches)||!Array.isArray(d.teams)||!Array.isArray(d.competitions)||d.matches.length<30||!d.teams.some(t=>t.isVirtus))throw Error("Archivio non valido");
 S.data=d;S.teamMap=new Map(d.teams.map(t=>[t.id,t]));S.compMap=new Map(d.competitions.map(c=>[c.id,c]));S.matchMap=new Map(d.matches.map(m=>[m.id,m]));S.venueMap=new Map((d.venues||[]).map(v=>[v.id,v]));
 try{let id=localStorage.getItem(KEY_FAVORITE);if(id&&S.teamMap.get(id)?.isVirtus)S.favorite=id;else if(!S.favorite||!S.teamMap.has(S.favorite))S.favorite=S.data.teams.find(t=>t.isVirtus)?.id||null;localStorage.setItem(KEY_DATA,JSON.stringify(d))}catch{S.favorite=S.favorite||S.data.teams.find(t=>t.isVirtus)?.id||null}
 if(!S.standings.comp||!S.compMap.has(S.standings.comp))S.standings.comp=S.teamMap.get(S.favorite)?.competitionIds?.[0]||d.competitions[0].id;
}
async function loadData(force=false,silent=false){
 if(S.loading)return;
 S.loading=true;
 const button=$("#refresh-button");
 button?.setAttribute("aria-busy","true");
 button?.setAttribute("disabled","true");
 const prior=S.data?.updatedAt||null;
 let fetched=false,changed=false,error=null;
 try{
   const response=await fetch("./data.json"+(force?"?nocache="+Date.now():""),{cache:force?"no-store":"no-cache"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const d=await response.json();
   if(d.mode!=="official"||d.provenance?.method!=="direct-fipav")throw Error("Archivio FIPAV non valido");
   const currentTime=Date.parse(prior||"1970-01-01");
   const incomingTime=Date.parse(d.updatedAt);
   if(!Number.isFinite(incomingTime))throw Error("Data dell'archivio non valida");
   if(prior&&incomingTime<currentTime)throw Error("Archivio remoto meno recente");
   changed=!prior||incomingTime>currentTime;
   assignData(d);fetched=true;
 }catch(ex){error=String(ex.message||ex)}
 if(!fetched&&!S.data){
   try{
     const cached=JSON.parse(localStorage.getItem(KEY_DATA)||"null");
     if(cached?.provenance?.method==="direct-fipav")assignData(cached);
   }catch{}
 }
 S.loading=false;
 button?.removeAttribute("aria-busy");
 button?.removeAttribute("disabled");
 render();
 if(force&&!silent){
   const timestamp=S.data?.updatedAt?fmt(S.data.updatedAt,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"non disponibile";
   if(fetched&&changed)toast("Nuovi dati pubblicati · "+timestamp);
   else if(fetched)toast("Nessun dato più recente · Ultimo aggiornamento: "+timestamp);
   else if(S.data)toast("Verifica non riuscita. Visualizzi i dati salvati del "+timestamp);
   else toast("Dati FIPAV non raggiungibili. Riprova.");
 }
 if(error)console.warn("Volley Info: "+error);
 updateRefreshMeta();
 return {fetched,changed,error,updatedAt:S.data?.updatedAt||null};
}
function toast(message){const e=$("#toast");e.textContent=message;e.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.hidden=true,3600)}
function badgeCoverage(c){return c.coverage==="partial"?'<div class="notice">Calendario parziale: la fonte FIPAV non include ancora tutte le gare delle avversarie per questo girone. La classifica rimane completa.</div>':""}
function matchRow(m,tag=true){
 const c=competition(m.competitionId),a=team(m.homeId),b=team(m.awayId);
 return '<a class="match-row" href="'+route("match",m.id)+'"><div class="row-top"><span>'+esc(tag?c.short:"Giornata "+(m.round||"—"))+'</span><span>'+esc(day(m.datetime))+'</span></div><div class="match-body"><div class="match-team">'+iconTeam(a.id)+'<span>'+esc(a.name)+'</span></div><div class="match-center">'+(isPlayed(m)?esc(m.score.join(" – ")):'<small>'+esc(time(m.datetime))+'</small>')+'</div><div class="match-team">'+iconTeam(b.id)+'<span>'+esc(b.name)+'</span></div></div></a>';
}
function pageSection(title,body,link){return '<div class="section-title"><h2>'+title+'</h2>'+(link?'<a href="'+link+'">Vedi tutti</a>':"")+'</div>'+body}

function home(){
 const favorite=S.favorite&&S.teamMap.has(S.favorite)?S.favorite:null;
 const selected=favorite?team(favorite):null;
 const week=VirtusWeek.currentWeek(new Date());
 const next=VirtusWeek.nextFavoriteMatch(S.data,favorite,new Date());
 const games=VirtusWeek.allVirtusMatches(S.data,week);
 let out='<section class="hero home-feature" aria-label="Squadra preferita e prossima gara">';
 out+='<div class="home-feature-toolbar"><div class="home-feature-meta"><span class="home-feature-kicker">LA MIA SQUADRA</span>'+(selected?'<span class="home-feature-category">'+esc(competition(selected.competitionIds?.[0]).short)+'</span>':'')+'</div><button type="button" class="home-change-button" id="change-favorite" aria-label="Cambia squadra preferita">Cambia squadra</button></div>';
 if(next){
   const a=team(next.homeId),b=team(next.awayId);
   out+='<a class="home-feature-link" href="'+route("match",next.id)+'" aria-label="Apri la prossima gara"><div class="hero-teams"><div class="hero-team">'+bigIcon(a.id)+'<span>'+esc(a.name)+'</span></div><div class="versus">VS</div><div class="hero-team">'+bigIcon(b.id)+'<span>'+esc(b.name)+'</span></div></div><div class="detail center">'+esc(dayLong(next.datetime))+' · '+esc(time(next.datetime))+'</div><div class="detail center">'+esc(venue(next.venueId)?.name||"Palestra da definire")+'</div></a>';
 }else{
   out+='<div class="home-feature-empty">Nessuna prossima gara programmata per la squadra preferita.</div>';
 }
 out+='</section>';
 const period=week?fmt(week.start+"T12:00:00+01:00",{day:"numeric",month:"short"})+" – "+fmt(week.end+"T12:00:00+01:00",{day:"numeric",month:"short"}):"Settimana corrente";
 out+='<div class="section-title home-week-title"><h2>Partite della settimana</h2><a href="#calendar">Calendario</a></div><p class="intro">Lunedì–domenica · '+esc(period)+' · '+esc(games.length)+' '+(games.length===1?"partita":"partite")+'</p>';
 if(!games.length)out+='<div class="empty">Nessuna partita Virtus programmata in questa settimana.</div>';
 else{
   let previousDay="";
   for(const game of games){
     const key=VirtusWeek.dateKey(game.datetime);
     if(key!==previousDay){previousDay=key;out+='<div class="date-line">'+esc(dayLong(game.datetime))+'</div>'}
     out+=matchRow(game);
   }
 }
 return out+foot();
}
function compSelect(selected,id="comp-select"){return '<select id="'+id+'" aria-label="Seleziona campionato">'+S.data.competitions.map(c=>'<option value="'+esc(c.id)+'" '+(selected===c.id?"selected":"")+'>'+esc(c.short)+'</option>').join("")+'</select>'}
function teamSelect(selected,id="team-select",allowAll=true){
 const virtus=S.data.teams.filter(t=>t.isVirtus).sort((a,b)=>a.name.localeCompare(b.name,"it"));
 return '<select id="'+id+'" aria-label="Seleziona squadra">'+(allowAll?'<option value="all" '+(selected==="all"?"selected":"")+'>Tutte le Virtus</option>':"")+virtus.map(t=>'<option value="'+esc(t.id)+'" '+(selected===t.id?"selected":"")+'>'+esc(t.name)+" · "+esc(competition(t.competitionIds?.[0]).short)+'</option>').join("")+"</select>";
}
function calendar(){
 let f=S.calendar;
 let list=S.data.matches.filter(m=>(f.team==="all"?S.teamMap.get(m.homeId)?.isVirtus||S.teamMap.get(m.awayId)?.isVirtus:hasTeam(m,f.team))&&(f.comp==="all"||m.competitionId===f.comp));
 if(f.range==="future")list=list.filter(m=>!isPlayed(m));if(f.range==="results")list=list.filter(isPlayed);
 list.sort((a,b)=>(a.datetime||"9999").localeCompare(b.datetime||"9999"));
 let out='<div class="eyebrow">TUTTE LE PARTITE</div><h1 class="page-title">Calendario</h1><p class="intro">Seleziona squadra e campionato. Tocca una partita per aprire i dettagli.</p><div class="filters">'+teamSelect(f.team)+('<select id="calendar-comp"><option value="all">Tutti i campionati</option>'+S.data.competitions.map(c=>'<option value="'+esc(c.id)+'" '+(f.comp===c.id?"selected":"")+'>'+esc(c.short)+'</option>').join("")+'</select>')+'</div><div class="chips">'+[["all","Tutte"],["future","Da giocare"],["results","Risultati"]].map(([v,label])=>'<button class="chip '+(f.range===v?"active":"")+'" data-calendar-range="'+v+'" aria-pressed="'+(f.range===v)+'">'+label+'</button>').join("")+'</div>';
 if(f.comp!=="all")out+=badgeCoverage(competition(f.comp));
 if(!list.length)return out+'<div class="empty">Nessuna partita disponibile con questi filtri.</div>'+foot();
 let last="",count=0;for(const m of list){const k=m.datetime?fmt(m.datetime,{day:"2-digit",month:"2-digit",year:"numeric"}):"Data da definire";if(k!==last){last=k;out+='<div class="date-line">'+esc(dayLong(m.datetime))+'</div>'}out+=matchRow(m);count++}return out+foot();
}
function rankTable(c){
 if(!c.standings?.length)return '<div class="empty">Classifica non ancora disponibile.</div>';
 return '<table class="rank-table"><colgroup><col class="col-pos"><col class="col-name"><col class="col-points"><col class="col-stat"><col class="col-stat"><col class="col-stat"><col class="col-set"></colgroup><thead><tr><th>#</th><th class="name">Squadra</th><th>Pt</th><th>G</th><th>V</th><th>P</th><th>Set</th></tr></thead><tbody>'+c.standings.map(r=>'<tr class="'+(team(r.teamId).isVirtus?"virtus":"")+'"><td>'+esc(r.position??"—")+'</td><td><a class="rank-team" href="'+route("team",r.teamId)+'"><span class="rank-badge"><span class="rank-initials">'+esc(teamName(r.teamId).slice(0,2))+'</span>'+(team(r.teamId).logo?'<img class="rank-crest" src="'+esc(team(r.teamId).logo)+'" loading="lazy" alt="">':"")+'</span><span class="rank-team-name">'+esc(teamName(r.teamId))+'</span></a></td><td class="pts">'+esc(r.points)+'</td><td>'+esc(r.played)+'</td><td>'+esc(r.wins)+'</td><td>'+esc(r.losses)+'</td><td class="set-score">'+esc(r.sf)+'–'+esc(r.sa)+'</td></tr>').join("")+'</tbody></table>';
}
function standings(){
 const c=competition(S.standings.comp);return '<div class="eyebrow">CAMPIONATI FIPAV</div><h1 class="page-title">Classifiche</h1><p class="intro">Tocca una squadra per consultare calendario e risultati.</p><div class="filters">'+compSelect(S.standings.comp,"standings-comp")+'</div><div class="card"><div class="eyebrow">'+esc(c.short)+'</div><h2 style="margin:8px 0 12px">'+esc(c.name)+'</h2>'+rankTable(c)+'</div>'+badgeCoverage(c)+foot();
}
function teamPage(id){
 const t=S.teamMap.get(id);if(!t)return '<div class="empty">Squadra non trovata.</div>';
 const c=competition(t.competitionIds?.[0]),r=c.standings?.find(x=>x.teamId===id),list=matchesFor(id),future=upcoming(list),old=previous(list);
 let out='<a class="inline-button" href="#home">← Home</a><div class="card"><div class="eyebrow">'+esc(c.short)+'</div><div class="fav-line"><div><h1 class="page-title" style="font-size:24px">'+esc(t.name)+'</h1><p class="intro">'+esc(c.name)+' · '+esc(c.group)+'</p></div><div class="team-profile-logo" style="flex:0 0 104px;width:104px;height:130px;max-width:104px;max-height:130px;overflow:hidden;display:flex;align-items:center;justify-content:center"><span class="team-profile-image-box" style="display:block;width:100%;height:100%;overflow:hidden">'+(t.logo?'<img class="team-profile-image" src="'+esc(t.logo)+'" width="104" height="130" alt="Logo '+esc(t.name)+'" loading="eager" style="display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center">':bigIcon(t.id))+'</span></div></div>'+(t.isVirtus?'<button id="set-favorite" data-team="'+esc(t.id)+'" class="action-button">'+(S.favorite===t.id?"★ Squadra preferita":"☆ Imposta come preferita")+'</button>':"")+'</div>';
 out+='<div class="meta-grid">'+[['Posizione',r?.position??"—"],['Punti',r?.points??"—"],['Gare',r?.played??"—"]].map(([k,v])=>'<div class="meta-stat"><strong>'+esc(v)+'</strong><span>'+esc(k)+'</span></div>').join("")+'</div>';
 out+=badgeCoverage(c);
 out+=pageSection("Prossima partita",future[0]?matchRow(future[0]):'<div class="empty">Nessuna gara futura disponibile.</div>');
 out+=pageSection("Ultimi risultati",old.slice(0,6).map(m=>matchRow(m)).join("")||'<div class="empty">Ancora nessun risultato.</div>');
 out+=pageSection("Calendario stagionale",list.sort((a,b)=>(a.datetime||"9999").localeCompare(b.datetime||"9999")).map(m=>matchRow(m)).join("")||'<div class="empty">Nessuna gara disponibile.</div>');
 out+=pageSection("Classifica completa",'<div class="card">'+rankTable(c)+'</div>');
 return out+foot();
}
function matchPage(id){
 const m=S.matchMap.get(id);if(!m)return '<div class="empty">Gara non trovata.</div>';
 const c=competition(m.competitionId),v=venue(m.venueId),a=team(m.homeId),b=team(m.awayId);
 let out='<a class="inline-button" href="javascript:history.back()">← Indietro</a><div class="hero"><div class="hero-heading"><span>'+esc(c.short)+'</span><span>GIORNATA '+esc(m.round||"—")+'</span></div><div class="hero-teams"><a class="hero-team" href="'+route("team",a.id)+'">'+bigIcon(a.id)+'<span>'+esc(a.name)+'</span></a><div class="versus">'+(isPlayed(m)?esc(m.score.join(" – ")):"VS")+'</div><a class="hero-team" href="'+route("team",b.id)+'">'+bigIcon(b.id)+'<span>'+esc(b.name)+'</span></a></div><div class="detail center">'+esc(m.statusLabel||"")+'</div></div>';
 if(isPlayed(m)&&m.sets?.length)out+='<div class="card center"><div class="eyebrow">PARZIALI</div><p class="detail" style="margin-top:9px">'+esc(m.sets.map((x,i)=>(i+1)+"°: "+x.join("–")).join(" · "))+'</p></div>';
 out+='<div class="card"><div class="eyebrow">DETTAGLI GARA</div><p class="detail">Data: '+esc(dayLong(m.datetime))+'</p><p class="detail">Ora: '+esc(time(m.datetime))+'</p><p class="detail">Stato: '+esc(m.statusLabel||m.status)+'</p><p class="detail">Palestra: '+esc(v?.name||"Da definire")+'</p><p class="detail">'+esc(v?.address||"Indirizzo non disponibile")+'</p>';
 if(v&&(v.maps||v.lat||v.address)){const dest=(v.lat&&v.lon)?v.lat+","+v.lon:(v.address||v.name);out+='<a class="action-button" style="display:block;text-align:center;margin:14px 0" href="https://www.google.com/maps/dir/?api=1&amp;destination='+encodeURIComponent(dest)+'" target="_blank" rel="noopener noreferrer">Apri navigatore</a>'}
 if(m.sourceUrl)out+='<a class="inline-button" href="'+esc(m.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Fonte FIPAV →</a>';
 out+='</div>'+badgeCoverage(c)+foot();return out;
}
function render(){
 const [section,id]=parseRoute();
 document.querySelectorAll(".bottom-nav a").forEach(a=>a.classList.toggle("active",a.dataset.tab===section));
 if(!S.data){$("#view").innerHTML='<div class="eyebrow">VIRTUS CASERTA</div><h1 class="page-title">Volley Info</h1><div class="notice">I dati FIPAV non sono al momento raggiungibili. Nessun risultato viene inventato. Riprova con il pulsante di aggiornamento.</div><button id="retry-data" class="action-button">Riprova</button>';return}
 let html=section==="calendar"?calendar():section==="standings"?standings():section==="team"?teamPage(id):section==="match"?matchPage(id):home();
 $("#view").innerHTML=html;if(S.searchOpen)renderSearch();
}

function openSearch(favorites=false){
 S.searchOpen=true;S.favoritePicker=Boolean(favorites);
 $("#search-overlay").hidden=false;
 $("#search-title").textContent=S.favoritePicker?"Cambia squadra preferita":"Cerca una squadra";
 $("#team-search").value="";
 renderSearch();
 setTimeout(()=>$("#team-search").focus(),50);
}
function closeSearch(){S.searchOpen=false;S.favoritePicker=false;$("#search-overlay").hidden=true}
function renderSearch(){
 if(!S.data){$("#search-results").innerHTML='<div class="empty">Nessun dato disponibile.</div>';return}
 const q=$("#team-search").value.trim().toLocaleLowerCase("it");
 const onlyVirtus=S.favoritePicker;
 let arr=S.data.teams.filter(t=>(!onlyVirtus||t.isVirtus)&&(!q||[t.name,competition(t.competitionIds?.[0]).name,competition(t.competitionIds?.[0]).short].join(" ").toLocaleLowerCase("it").includes(q))).sort((a,b)=>Number(b.isVirtus)-Number(a.isVirtus)||a.name.localeCompare(b.name,"it"));
 $("#search-results").innerHTML=arr.slice(0,100).map(t=>{
   const opening=onlyVirtus?'<button type="button" class="search-result search-choice" data-favorite-target="'+esc(t.id)+'" aria-label="Imposta '+esc(t.name)+' come squadra preferita">':'<a class="search-result" href="'+route("team",t.id)+'">';
   const ending=onlyVirtus?'</button>':'</a>';
   const marker=onlyVirtus&&S.favorite===t.id?'★':'›';
   return opening+'<span class="label"><b>'+esc(t.name)+'</b><small>'+esc(competition(t.competitionIds?.[0]).short)+(t.isVirtus?" · Virtus Caserta":"")+'</small></span><span style="color:var(--gold)">'+marker+'</span>'+ending;
 }).join("")||'<div class="empty">Nessuna squadra trovata.</div>';
}


/* GitHub Pages non può avviare workflow senza autenticazione.
   Il link richiede l'accesso del gestore; la PWA verifica solo l'archivio pubblicato.
   Nessuna credenziale GitHub deve mai essere inserita nel browser pubblico. */
const refreshMonitor={timer:null,active:false,checking:false,baseline:null,startedAt:0};
const REFRESH_INTERVAL_MS=20000;
const REFRESH_MAX_WAIT_MS=12*60*1000;
function refreshStatus(message){
 const el=$("#refresh-status");
 if(el)el.textContent=message;
}
function updateRefreshMeta(){
 const last=$("#refresh-last");
 if(!last)return;
 last.textContent=S.data?.updatedAt
   ?"Ultima raccolta FIPAV pubblicata: "+fmt(S.data.updatedAt,{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})
   :"Nessun archivio FIPAV ancora disponibile.";
}
function stopRefreshMonitor(message){
 if(refreshMonitor.timer)clearInterval(refreshMonitor.timer);
 refreshMonitor.timer=null;
 refreshMonitor.active=false;
 refreshMonitor.checking=false;
 $("#refresh-stop").hidden=true;
 if(message)refreshStatus(message);
}
function closeRefreshPanel(){
 $("#refresh-overlay").hidden=true;
 stopRefreshMonitor();
 $("#refresh-button")?.focus();
}
async function checkPublishedRefresh(){
 if(S.loading)return;
 refreshStatus("Controllo dei dati pubblicati...");
 const status=await loadData(true,true);
 if(!status)return;
 const date=S.data?.updatedAt?fmt(S.data.updatedAt,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"sconosciuta";
 if(status.fetched&&status.changed)refreshStatus("Dati pubblicati più recenti caricati: "+date);
 else if(status.fetched)refreshStatus("Nessun dato più recente. Ultima pubblicazione: "+date);
 else if(S.data)refreshStatus("Connessione non disponibile: restano i dati salvati del "+date);
 else refreshStatus("Impossibile verificare i dati. Riprova.");
}
function openRefreshPanel(){
 if(S.searchOpen)closeSearch();
 $("#refresh-overlay").hidden=false;
 updateRefreshMeta();
 refreshStatus("Controllo la versione dei dati attualmente pubblicata.");
 $("#refresh-check")?.focus();
 checkPublishedRefresh();
}
async function pollRequestedRefresh(){
 if(!refreshMonitor.active||refreshMonitor.checking||S.loading||document.visibilityState==="hidden")return;
 if(Date.now()-refreshMonitor.startedAt>REFRESH_MAX_WAIT_MS){
   stopRefreshMonitor("Nessuna nuova pubblicazione rilevata entro 12 minuti. Verifica l'esito del workflow su GitHub.");
   return;
 }
 refreshMonitor.checking=true;
 try{
   const result=await loadData(true,true);
   if(!refreshMonitor.active||!result)return;
   const updated=Date.parse(result.updatedAt||"");
   const original=Date.parse(refreshMonitor.baseline||"1970-01-01");
   if(result.fetched&&Number.isFinite(updated)&&updated>original){
     stopRefreshMonitor("Nuova raccolta FIPAV pubblicata e caricata nell'app!");
     toast("Nuovi risultati FIPAV disponibili");
   }else if(!result.fetched){
     refreshStatus("Non riesco a controllare la pubblicazione. Riproverò automaticamente.");
   }else{
     refreshStatus("Nessuna nuova pubblicazione rilevata. Se hai avviato Run workflow su GitHub, il controllo continua automaticamente.");
   }
 }finally{refreshMonitor.checking=false}
}
function startRefreshMonitor(){
 stopRefreshMonitor();
 refreshMonitor.baseline=S.data?.updatedAt||null;
 refreshMonitor.startedAt=Date.now();
 refreshMonitor.active=true;
 $("#refresh-stop").hidden=false;
 refreshStatus("Su GitHub premi Run workflow e conferma. Torna nell'app: controllerò la nuova pubblicazione per 12 minuti.");
 refreshMonitor.timer=setInterval(pollRequestedRefresh,REFRESH_INTERVAL_MS);
}
function events(){
 window.addEventListener("hashchange",()=>{closeSearch();render();window.scrollTo({top:0,behavior:"instant"})});
 $("#search-button").addEventListener("click",()=>openSearch());
 $("#close-search").addEventListener("click",closeSearch);
 $("#search-overlay").addEventListener("click",e=>{if(e.target.id==="search-overlay")closeSearch()});
 $("#team-search").addEventListener("input",()=>renderSearch());
 $("#clear-search").addEventListener("click",()=>{$("#team-search").value="";renderSearch()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch()});
 document.addEventListener("error",e=>{if(e.target instanceof HTMLImageElement && e.target.matches(".rank-crest"))e.target.hidden=true},true);
 $("#refresh-button").addEventListener("click",()=>loadData(true));
 $("#view").addEventListener("click",e=>{
  if(e.target.closest("#change-favorite")){openSearch(true);return}
  const fav=e.target.closest("#set-favorite");if(fav){S.favorite=fav.dataset.team;try{localStorage.setItem(KEY_FAVORITE,S.favorite)}catch{};toast("Squadra preferita aggiornata");render();return}
  if(e.target.closest("#retry-data")){loadData(true);return}
  const chip=e.target.closest("[data-calendar-range]");if(chip){S.calendar.range=chip.dataset.calendarRange;render();return}
 });
 $("#view").addEventListener("change",e=>{
  const id=e.target.id,v=e.target.value;
  if(id==="team-select"){S.calendar.team=v;S.calendar.comp="all";render()}
  if(id==="calendar-comp"){S.calendar.comp=v;render()}
  if(id==="standings-comp"){S.standings.comp=v;render()}
 });
 $("#search-results").addEventListener("click",e=>{
  const option=e.target.closest("[data-favorite-target]");
  if(option){
    const id=option.dataset.favoriteTarget;
    if(!S.teamMap.get(id)?.isVirtus)return;
    S.favorite=id;
    try{localStorage.setItem(KEY_FAVORITE,id)}catch{}
    closeSearch();render();toast("Squadra preferita aggiornata");
    return;
  }
  if(e.target.closest("a"))closeSearch();
 });
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.data)loadData()});
 if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
events();loadData();
