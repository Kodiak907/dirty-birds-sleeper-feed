import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=f=>readFileSync(new URL(f,import.meta.url),'utf8');
const html=source('./index.html'),script=source('./demo.js'),css=source('./demo.css');
test('public demo never loads private data, licensed MSF data or commissioner tools',()=>{
 assert.match(html,/PUBLIC SANDBOX/);
 assert.match(html,/demo\.js/);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(script,/fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|\/api\//);
 assert.doesNotMatch(html,/dirtybirdstest|Kodiak907|\/api\/|commissioner-pin|MSF_API_KEY/i);
 assert.doesNotMatch(script,/commissioner|dirty birds|MSF_API_KEY|\/api\//i);
 assert.doesNotMatch(html,/<iframe|<form|src=["']https?:/);
});
test('fake teams support team-specific waivers, trades and project totals',()=>{
 assert.match(script,/const teamNames=\[/);
 assert.match(script,/squad=\(idx=state\.team\)/);
 assert.match(script,/state\.team=Number\(e\.target\.value\)/);
 assert.match(script,/getPartner\(\)\.name/);
 assert.match(script,/state\.claimed\.push\(p\)/);
 assert.match(script,/getTeam\(\)\.name/);
 assert.match(script,/Simulated statistics and projected points are fictional/);
});
test('mobile styles protect horizontal layout',()=>{
 assert.match(css,/@media\(max-width:690px\)/);
 assert.match(css,/#tabs\{display:flex;gap:7px;overflow-x:auto/);
 assert.match(css,/grid-template-columns:1fr/);
});