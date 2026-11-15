/* Fonte pubblica indipendente: risultati ufficiali pubblicati sui portali FIPAV.
   Una classifica è sempre presa dalla fonte, mai ricalcolata dalle gare parziali. */
"use strict";
const SOURCE_FEED_URL="https://kushnirandriy-droid.github.io/app-pallavolo/data.json";
const SOURCE_ASSET_BASE="https://kushnirandriy-droid.github.io/app-pallavolo/";
function adaptFipavFeed(src){
  if(!src||src.stagione!=="2026/27"||!Array.isArray(src.campionati)||!Array.isArray(src.gare)||!src.squadre||!src.palestre||!src.aggiornato)throw Error("Sorgente FIPAV non compatibile");
  if(src.gare.length<40||src.campionati.length<4)throw Error("Sorgente FIPAV incompleta");
  const competitions=src.campionati.filter(c=>c.virtus).map(c=>{
    const short=c.nome.replace("Femminile","F").replace("Maschile","M").replace("Under ","U").replace("1 Divisione","1ª Div.")+(String(c.girone).toLowerCase()==="unico"?"":" · Gir. "+c.girone);
    return {id:c.id,name:c.nome,group:c.girone,gender:/maschil/i.test(c.nome)?"M":"F",short,source:"FIPAV "+(c.fonte==="campania"?"Campania":"Caserta"),coverage:c.tutte_le_gare?"complete":"partial",sourceUrl:c.url||null,standings:[]};
  });
  const byCompetition=new Map(competitions.map(c=>[c.id,c]));
  const tids=new Set();
  for(const g of src.gare){if(!byCompetition.has(g.campionato))continue;tids.add(g.casa+"__"+g.campionato);tids.add(g.ospite+"__"+g.campionato)}
  for(const c of src.campionati.filter(c=>c.virtus))for(const r of c.classifica||[])tids.add(r.squadra+"__"+c.id);
  const teams=[];
  for(const key of tids){
    let sep=key.lastIndexOf("__"),sid=key.slice(0,sep),cid=key.slice(sep+2),s=src.squadre[sid];
    if(!s||!byCompetition.has(cid))continue;
    let logo=s.virtus?"logos/virtus_caserta_original.png":(s.logo?(s.logo.startsWith("https://")?s.logo:SOURCE_ASSET_BASE+s.logo):null);
    teams.push({id:key,name:s.nome||"?",competitionIds:[cid],isVirtus:!!s.virtus,sourceTeamId:sid,logo});
  }
  const tset=new Set(teams.map(t=>t.id));
  const venues=Object.entries(src.palestre).map(([id,p])=>({id,name:p.nome||"Impianto sportivo",city:p.citta||"",address:[p.via,p.citta,p.prov].filter(Boolean).join(", "),lat:p.lat??null,lon:p.lon??null,maps:p.maps||null}));
  for(const c of src.campionati.filter(c=>c.virtus)){const target=byCompetition.get(c.id);target.standings=(c.classifica||[]).filter(r=>tset.has(r.squadra+"__"+c.id)).map(r=>({teamId:r.squadra+"__"+c.id,position:r.pos??null,points:r.punti??0,played:r.g??0,wins:r.v??0,losses:r.p??0,sf:r.sf??0,sa:r.ss??0,pf:r.pf??0,pa:r.ps??0,penalty:r.pen??0}))}
  const matches=src.gare.filter(g=>byCompetition.has(g.campionato)&&tset.has(g.casa+"__"+g.campionato)&&tset.has(g.ospite+"__"+g.campionato)).map(g=>{
    const played=Array.isArray(g.set)&&g.set.length===2&&g.set[0]!==null&&g.set[0]!==undefined;
    return {id:g.id,competitionId:g.campionato,round:g.giornata||0,datetime:g.data||null,homeId:g.casa+"__"+g.campionato,awayId:g.ospite+"__"+g.campionato,venueId:g.palestra||null,status:played?"played":"scheduled",statusLabel:g.stato_testo||g.stato||"",score:played?g.set:null,sets:played?(g.parziali||[]):[],sourceUrl:g.url||byCompetition.get(g.campionato).sourceUrl};
  }).sort((a,b)=>(a.datetime||"9999").localeCompare(b.datetime||"9999")||a.id.localeCompare(b.id));
  if(matches.length<40||!teams.some(t=>t.isVirtus))throw Error("Dati non coerenti");
  return {version:2,mode:"official",season:src.stagione,updatedAt:src.aggiornato,club:{name:"VIRTUS CASERTA",shortName:"Virtus Caserta",city:"Caserta",logo:"logos/virtus_caserta_original.png"},competitions,teams,venues,matches,provenance:{source:"FIPAV Caserta e Campania via app-pallavolo",url:SOURCE_FEED_URL,retrievedAt:new Date().toISOString(),method:"browser-fallback",note:"Alcuni gironi hanno solo gli incontri Virtus: il calendario delle avversarie potrebbe essere parziale."}};
}