"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const app=fs.readFileSync("app.js","utf8");
const css=fs.readFileSync("style.css","utf8");
const html=fs.readFileSync("index.html","utf8");
const sw=fs.readFileSync("sw.js","utf8");
const pos=app.indexOf("function matchRow(");
const end=app.indexOf("\nfunction ",pos+12);
assert.ok(pos>=0&&end>pos,"matchRow esiste");
const teams={
 home:{id:"home",name:"VIRTUS CASERTA ACADEMY"},
 away:{id:"away",name:"HIDROS"},
 other:{id:"other",name:"VOLALTO S.NICOLA L.S"}
};
const run=vm.runInNewContext("("+app.slice(pos,end)+")",{
 competition:()=>({short:"U19 F · Gir. B"}),
 team:id=>teams[id],
 iconTeam:id=>'<img alt="" src="logo-'+id+'.png">',
 route:(type,id)=>"#"+type+"/"+id,
 esc:v=>String(v),
 day:()=> "19 nov",
 time:()=> "20:15",
 isPlayed:m=>m.status==="played"&&Array.isArray(m.score)
});
const fixture={id:"gara-academy",homeId:"home",awayId:"away",competitionId:"test",datetime:"2026-11-19T20:15:00+01:00",status:"played",score:[0,3]};
test("Nome completo Academy, classe mirata per squadra in casa",()=>{
 const card=run(fixture,true,true);
 assert.match(card,/<div class="match-team match-team-academy"><img[^>]+><span>VIRTUS CASERTA ACADEMY<\/span>/);
 assert.match(card,/home-match-played/);
 assert.match(card,/DISPUTATA/);
 assert.match(card,/0 – 3/);
});
test("Academy in trasferta usa la stessa regola; gli avversari non cambiano",()=>{
 const card=run({...fixture,homeId:"other",awayId:"home",score:[3,0]});
 assert.equal((card.match(/class="match-team match-team-academy"/g)||[]).length,1);
 assert.match(card,/<div class="match-team"><img[^>]+><span>VOLALTO S.NICOLA L.S<\/span>/);
 assert.match(card,/VIRTUS CASERTA ACADEMY/);
});
test("Altre squadre mantengono classi e layout correnti",()=>{
 const card=run({...fixture,homeId:"other",awayId:"away",status:"scheduled",score:null});
 assert.doesNotMatch(card,/match-team-academy|home-match-played|DISPUTATA/);
 assert.match(card,/20:15/);
});
test("Regole responsive Academy fino a 410px; versioni PWA coerenti",()=>{
 assert.match(css,/@media\(max-width:425px\)\{\s*\.match-team-academy\{font-size:12px/);
 assert.match(css,/@media\(max-width:410px\)\{\s*\.match-team-academy\{font-size:11\.5px;gap:4px/);
 assert.match(css,/@media\(max-width:330px\)\{\s*\.match-team-academy\{font-size:10px/);
 assert.match(html,/app\.js\?v=14/);
 assert.match(html,/style\.css\?v=14/);
 assert.match(sw,/virtus-volley-info-academy-v14/);
});
