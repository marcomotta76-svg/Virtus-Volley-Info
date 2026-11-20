"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const app=fs.readFileSync("app.js","utf8");
const css=fs.readFileSync("style.css","utf8");
const begin=app.indexOf("function matchRow(");
const end=app.indexOf("\nfunction ",begin+12);
assert.ok(begin>=0&&end>begin,"matchRow disponibile");
const run=vm.runInNewContext("("+app.slice(begin,end)+")",{
 competition:()=>({short:"U14 F · Gir. A"}),
 team:id=>({id,name:id==="home"?"VOLALTO S. NICOLA":"VIRTUS CASERTA"}),
 route:(type,id)=>"#"+type+"/"+id,
 iconTeam:()=>"",
 esc:val=>String(val??""),
 day:()=> "19 nov",
 time:()=> "19:30",
 isPlayed:m=>m.status==="played"&&Array.isArray(m.score)
});
const fixture={id:"gara-1",competitionId:"c1",homeId:"home",awayId:"away",datetime:"2026-11-19T19:30:00+01:00",status:"played",score:[0,3]};
test("Solo Home color petrolio per stato played e risultato FIPAV valido",()=>{
 const html=run(fixture,true,true);
 assert.match(html,/class="match-row home-match-played"/);
 assert.match(html,/home-match-badge">DISPUTATA</);
 assert.match(html,/0 – 3/);
 assert.match(html,/href="#match\/gara-1"/);
 assert.match(css,/\.match-row\.home-match-played\{/);
 assert.match(css,/\.today-match-panel \.match-row\.home-match-played\{/);
});
test("Altre pagine invarianti: niente badge ne colore con argomento predefinito",()=>{
 const normal=run(fixture);
 assert.doesNotMatch(normal,/home-match-played|home-match-badge|DISPUTATA/);
 assert.match(normal,/0 – 3/);
 assert.equal(normal,run(fixture,true,false));
});
test("Una gara programmata o passata senza risultato non e disputata",()=>{
 for(const m of [
  {...fixture,status:"scheduled",score:null},
  {...fixture,status:"scheduled",score:[0,3]},
  {...fixture,status:"played",score:null},
  {...fixture,status:"played",score:[]},
  {...fixture,status:"played",score:[3]},
  {...fixture,status:"played",score:[3,"0"]},
  {...fixture,status:"played",score:[-1,3]},
 ]){
  const html=run(m,true,true);
  assert.doesNotMatch(html,/home-match-played|home-match-badge/);
 }
});
test("Home applica lo stile in entrambi gli elenchi senza modificare le altre pagine",()=>{
 const home=app.slice(app.indexOf("function home(){"),app.indexOf("\nfunction ",app.indexOf("function home(){")+12));
 assert.match(home,/for\(const game of todayGames\)out\+=matchRow\(game,true,true\)/);
 assert.match(home,/for\(const game of remainingGames\)\{/);
 assert.match(home,/out\+=matchRow\(game,true,true\)/);
 assert.match(home,/OGGI IN CAMPO/);
 const outside=app.replace(home,"");
 assert.doesNotMatch(outside,/\bmatchRow\([^;\n]*,\s*true,\s*true\)/);
});
test("Partita conclusa del giorno viene evidenziata anche in Oggi in campo senza classificazione LIVE",()=>{
 const html=run({...fixture,id:"oggi-19-nov"},true,true);
 assert.match(html,/DISPUTATA/);
 assert.doesNotMatch(html,/LIVE/);
});
