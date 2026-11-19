"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const week=require("../week.js");

test("Settimana corrente italiana da lunedi a domenica",()=>{
  assert.deepEqual(week.currentWeek("2026-11-16T06:39:00Z"),{
    start:"2026-11-16",end:"2026-11-22",endExclusive:"2026-11-23"
  });
  assert.equal(week.dateKey("2026-11-22T22:59:59Z"),"2026-11-22");
  assert.deepEqual(week.currentWeek("2026-11-22T23:00:00Z"),{
    start:"2026-11-23",end:"2026-11-29",endExclusive:"2026-11-30"
  });
});
test("Passaggio a ora legale: giorni italiani corretti",()=>{
  assert.equal(week.dateKey("2026-03-29T21:59:00Z"),"2026-03-29");
  assert.equal(week.dateKey("2026-03-29T22:00:00Z"),"2026-03-30");
  assert.deepEqual(week.currentWeek("2026-03-29T21:00:00Z"),{
    start:"2026-03-23",end:"2026-03-29",endExclusive:"2026-03-30"
  });
});
const data={
 teams:[{id:"v1",isVirtus:true},{id:"v2",isVirtus:true},{id:"v3",isVirtus:true},{id:"opp",isVirtus:false}],
 matches:[
  {id:"f1",homeId:"v1",awayId:"opp",datetime:"2026-11-24T18:00:00+01:00",status:"scheduled",score:null},
  {id:"f2",homeId:"v1",awayId:"opp",datetime:"2026-11-22T11:00:00+01:00",status:"scheduled",score:null},
  {id:"v2s",homeId:"v2",awayId:"opp",datetime:"2026-11-16T00:00:00+01:00",status:"played",score:[3,1]},
  {id:"v3s",homeId:"v3",awayId:"opp",datetime:"2026-11-22T23:59:00+01:00",status:"scheduled",score:null},
  {id:"non-virtus",homeId:"opp",awayId:"opp",datetime:"2026-11-20T14:00:00+01:00",status:"scheduled",score:null},
  {id:"two-virtus",homeId:"v2",awayId:"v3",datetime:"2026-11-18T20:00:00+01:00",status:"scheduled",score:null},
  {id:"fav-involved",homeId:"v2",awayId:"v1",datetime:"2026-11-19T20:00:00+01:00",status:"scheduled",score:null},
  {id:"next-week",homeId:"v2",awayId:"opp",datetime:"2026-11-23T00:00:00+01:00",status:"scheduled",score:null},
  {id:"unfixed",homeId:"v3",awayId:"opp",datetime:null,status:"scheduled",score:null}
 ]
};
test("Home tutte e solo le partite delle altre Virtus nella settimana, una volta ciascuna",()=>{
 const result=week.otherVirtusMatches(data,"v1",week.currentWeek("2026-11-18T08:00:00Z"));
 assert.deepEqual(result.map(g=>g.id),["v2s","two-virtus","v3s"]);
});
test("Prossima gara preferita e sempre futura, anche la settimana dopo",()=>{
 assert.equal(week.nextFavoriteMatch(data,"v1","2026-11-22T11:00:00Z").id,"f1");
 assert.equal(week.nextFavoriteMatch(data,"v1","2026-11-18T11:00:00Z").id,"fav-involved");
 assert.equal(week.nextFavoriteMatch(data,"v1","2026-11-25T11:00:00Z"),null);
});

test("Home mostra tutte le partite Virtus, inclusa la preferita, anche quelle giocate",()=>{
 const result=week.allVirtusMatches(data,week.currentWeek("2026-11-18T08:00:00Z"));
 assert.deepEqual(result.map(g=>g.id),["v2s","two-virtus","fav-involved","f2","v3s"]);
 assert.deepEqual(result.find(g=>g.id==="v2s").score,[3,1]);
 assert.equal(result.some(g=>g.id==="non-virtus"),false);
 assert.equal(result.some(g=>g.id==="next-week"),false);
});
test("La stessa gara tra due squadre Virtus compare una sola volta",()=>{
 const repeated={...data,matches:[...data.matches,{...data.matches.find(m=>m.id==="two-virtus")}]};
 const result=week.allVirtusMatches(repeated,week.currentWeek("2026-11-18T08:00:00Z"));
 assert.equal(result.filter(g=>g.id==="two-virtus").length,1);
});

test("Oggi in campo: include tutte le Virtus, la favorita e gare gia disputate; le altre restano in settimana",()=>{
 const now="2026-11-19T13:00:00Z";
 const games=week.allVirtusMatches(data,week.currentWeek(now));
 const result=week.partitionTodayMatches(games,now);
 assert.deepEqual(result.today.map(x=>x.id),["fav-involved"]);
 assert.deepEqual(result.other.map(x=>x.id),["v2s","two-virtus","f2","v3s"]);
 assert.equal(result.today.some(x=>x.id==="non-virtus"),false);
 assert.equal(result.today.length+result.other.length,games.length);
});
test("Oggi in campo: tutte le gare giocate conservano risultati e nessuna viene duplicata",()=>{
 const today="2026-11-19T12:00:00Z";
 const augmented={...data,matches:[...data.matches,
  {id:"finished",homeId:"v3",awayId:"opp",datetime:"2026-11-19T15:30:00+01:00",status:"played",score:[3,2],sets:[[25,18],[25,27],[25,20],[23,25],[15,12]]},
  {id:"finished",homeId:"v3",awayId:"opp",datetime:"2026-11-19T15:30:00+01:00",status:"played",score:[3,2]}
 ]};
 const games=week.allVirtusMatches(augmented,week.currentWeek(today));
 const {today:now,other}=week.partitionTodayMatches(games,today);
 assert.deepEqual(now.map(x=>x.id),["finished","fav-involved"]);
 assert.deepEqual(now[0].score,[3,2]);
 assert.equal(now[0].sets.length,5);
 assert.equal(new Set([...now,...other].map(x=>x.id)).size,games.length);
});
test("Europe/Rome, giorno dopo mezzanotte e passaggio ora legale",()=>{
 const games=[
  {id:"yesterday",datetime:"2026-11-19T22:59:59Z"},
  {id:"today",datetime:"2026-11-19T23:00:00Z"},
  {id:"later",datetime:"2026-11-20T23:00:00Z"}
 ];
 const result=week.partitionTodayMatches(games,"2026-11-19T23:30:00Z");
 assert.deepEqual(result.today.map(x=>x.id),["today"]);
 assert.deepEqual(result.other.map(x=>x.id),["yesterday","later"]);
 const dst=week.partitionTodayMatches([
  {id:"sun",datetime:"2026-03-29T21:59:59Z"},
  {id:"mon",datetime:"2026-03-29T22:00:00Z"}
 ],"2026-03-29T22:00:01Z");
 assert.deepEqual(dst.today.map(x=>x.id),["mon"]);
});
test("Senza partite odierne non altera le partite della settimana",()=>{
 const games=week.allVirtusMatches(data,week.currentWeek("2026-11-20T12:00:00Z"));
 const {today,other}=week.partitionTodayMatches(games,"2026-11-20T12:00:00Z");
 assert.deepEqual(today,[]);
 assert.deepEqual(other.map(x=>x.id),games.map(x=>x.id));
 assert.deepEqual(week.partitionTodayMatches(null).today,[]);
});
