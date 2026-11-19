/* Calendario della Home: la settimana e' sempre lunedi-domenica, fuso Europa/Roma.
   Funzioni pure, disponibili anche ai test Node senza dipendenze. */
(function (root) {
  "use strict";
  const MILLIS_DAY=24*60*60*1000;
  const formatRome=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"
  });
  function dateKey(value){
    if(value===null||value===undefined||value==="")return null;
    const date=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(date.getTime()))return null;
    const fields=Object.fromEntries(formatRome.formatToParts(date).filter(part=>
      ["year","month","day"].includes(part.type)).map(part=>[part.type,part.value]));
    return fields.year+"-"+fields.month+"-"+fields.day;
  }
  function currentWeek(now=new Date()){
    const today=dateKey(now);
    if(!today)return null;
    const [year,month,day]=today.split("-").map(Number);
    const date=Date.UTC(year,month-1,day);
    const daysSinceMonday=(new Date(date).getUTCDay()+6)%7;
    const monday=date-daysSinceMonday*MILLIS_DAY;
    const asKey=ms=>new Date(ms).toISOString().slice(0,10);
    return {start:asKey(monday),end:asKey(monday+6*MILLIS_DAY),
      endExclusive:asKey(monday+7*MILLIS_DAY)};
  }
  function otherVirtusMatches(data,favoriteId,week){
    if(!data||!Array.isArray(data.teams)||!Array.isArray(data.matches)||!week)return [];
    const virtus=new Set(data.teams.filter(t=>t.isVirtus).map(t=>t.id));
    return data.matches.filter(m=>{
      const d=dateKey(m.datetime);
      return d!==null&&d>=week.start&&d<week.endExclusive&&
        (virtus.has(m.homeId)||virtus.has(m.awayId))&&
        m.homeId!==favoriteId&&m.awayId!==favoriteId;
    }).sort((a,b)=>new Date(a.datetime)-new Date(b.datetime)||
      String(a.id).localeCompare(String(b.id)));
  }

  function allVirtusMatches(data,week){
    if(!data||!Array.isArray(data.teams)||!Array.isArray(data.matches)||!week)return [];
    const virtus=new Set(data.teams.filter(t=>t.isVirtus).map(t=>t.id));
    const seen=new Set();
    return data.matches.filter(m=>{
      const day=dateKey(m.datetime);
      if(!day||day<week.start||day>=week.endExclusive||
         (!virtus.has(m.homeId)&&!virtus.has(m.awayId)))return false;
      const key=m.id||[m.competitionId,m.datetime,m.homeId,m.awayId].join("|");
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    }).sort((a,b)=>new Date(a.datetime)-new Date(b.datetime)||
      String(a.id).localeCompare(String(b.id)));
  }
  // Separa le gare gia' selezionate per la settimana senza duplicarle.
  // Il giorno di oggi si calcola in Europe/Rome, mai col fuso del dispositivo.
  function partitionTodayMatches(games,now=new Date()){
    const todayKey=dateKey(now);
    const today=[],other=[];
    for(const game of Array.isArray(games)?games:[]){
      if(todayKey&&dateKey(game.datetime)===todayKey)today.push(game);
      else other.push(game);
    }
    return {today,other};
  }
  function nextFavoriteMatch(data,favoriteId,now=new Date()){
    if(!favoriteId||!data||!Array.isArray(data.matches))return null;
    const cutoff=now instanceof Date?now.getTime():new Date(now).getTime();
    if(!Number.isFinite(cutoff))return null;
    const games=data.matches.filter(m=>
      (m.homeId===favoriteId||m.awayId===favoriteId)&&
      m.status!=="played"&&!Array.isArray(m.score)&&
      m.datetime&&Number.isFinite(new Date(m.datetime).getTime())&&
      new Date(m.datetime).getTime()>=cutoff
    ).sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
    return games[0]||null;
  }
  const api=Object.freeze({dateKey,currentWeek,otherVirtusMatches,allVirtusMatches,partitionTodayMatches,nextFavoriteMatch});
  root.VirtusWeek=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
