"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const app=fs.readFileSync("app.js","utf8");
const css=fs.readFileSync("style.css","utf8");
const week=fs.readFileSync("week.js","utf8");
test("Home presenta il pannello OGGI IN CAMPO prima delle altre gare",()=>{
 const home=app.slice(app.indexOf("function home(){"),app.indexOf("\nfunction ",app.indexOf("function home(){")+1));
 assert.ok(home.includes("OGGI IN CAMPO"));
 assert.ok(home.includes("today-match-panel"));
 assert.ok(home.includes("Altre partite della settimana"));
 assert.ok(home.indexOf("today-match-panel")<home.indexOf("Altre partite della settimana"));
 assert.ok(home.includes("for(const game of todayGames)out+=matchRow(game)"));
 assert.ok(home.includes("for(const game of remainingGames)"));
 assert.ok(home.includes("VirtusWeek.partitionTodayMatches(games,now)"));
});
test("La presentazione dei risultati resta quella gia usata in tutte le pagine",()=>{
 assert.match(app,/function matchRow\(m,tag=true\)/);
 assert.match(app,/isPlayed\(m\)\?esc\(m.score.join\(" – "\)\)/);
 assert.match(css,/\.today-match-panel \.match-row\{/);
 assert.match(week,/function partitionTodayMatches\(games,now=new Date\(\)\)/);
});
