"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const app=fs.readFileSync("app.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const css=fs.readFileSync("style.css","utf8");
const workflow=fs.readFileSync(".github/workflows/pages.yml","utf8");
const sw=fs.readFileSync("sw.js","utf8");

test("Il pulsante di aggiornamento apre il pannello dedicato",()=>{
  assert.match(html,/id="refresh-overlay"/);
  assert.match(html,/id="refresh-check"/);
  assert.match(html,/id="refresh-status"/);
  assert.match(app,/\$\("#refresh-button"\)\.addEventListener\("click",openRefreshPanel\)/);
  assert.match(css,/\.refresh-overlay\[hidden\]\{display:none/);
});
test("Avvio straordinario richiede autenticazione su GitHub, nessun token nel frontend",()=>{
  assert.match(html,/https:\/\/github\.com\/marcomotta76-svg\/Virtus-Volley-Info\/actions\/workflows\/pages\.yml/);
  assert.match(html,/id="refresh-open-github"[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(workflow,/^\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(html+app,/api\.github\.com\/repos\/[^" ]+\/dispatches/);
  assert.doesNotMatch(html+app,/(?:Authorization:\s*Bearer|github_pat_[A-Za-z0-9]|ghp_[A-Za-z0-9])/);
});
test("Monitor pubblicazione controlla timestamp senza dichiarare un avvio inesistente",()=>{
  assert.match(app,/function startRefreshMonitor\(\)/);
  assert.match(app,/function pollRequestedRefresh\(\)/);
  assert.match(app,/result\.fetched&&Number\.isFinite\(updated\)&&updated>original/);
  assert.match(app,/REFRESH_MAX_WAIT_MS=12\*60\*1000/);
  assert.match(app,/Su GitHub premi Run workflow e conferma/);
});
test("Aggiornamento PWA include pagina HTML e JS versionati",()=>{
  assert.match(html,/style\.css\?v=13/);
  assert.match(html,/app\.js\?v=13/);
  assert.match(sw,/virtus-volley-info-academy-v13/);
});
