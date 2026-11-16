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
