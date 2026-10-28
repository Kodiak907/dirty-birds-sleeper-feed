// FFO MSF-only independent scoring regression checks: no Sleeper fantasy-point input.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {fflScore,normalizeStats,plays,resolvePlayer} from './ffo-gamecast-model.mjs';

const base=dirname(fileURLToPath(import.meta.url));
const own=JSON.parse(readFileSync(join(base,'FFO_FFL_SCORING_V1.json'),'utf8'));
const core=readFileSync(join(base,'ffo-gamecast.js'),'utf8');
const worker=readFileSync(join(base,'_worker.js'),'utf8');
test('FFO-owned 2026 rules, independent source and no ESPN scoring board',()=>{
 assert.equal(own.schema,'FFO_SCORING_RULES_V1');
 assert.equal(own.league,'FFL');
 assert.equal(own.season,2026);
 assert.ok(Object.keys(own.scoring).length>=130);
 assert.equal(own.scoring.rec,.5);
 assert.equal(own.scoring.pass_td,4);
 assert.equal(own.scoring.rush_td,6);
 assert.equal(own.scoring.pass_yd,.04);
 assert.equal(own.scoring.fgm_60p,6);
 assert.match(core,/\/FFO_FFL_SCORING_V1\.json/);
 assert.doesNotMatch(core,/gm47Snapshot\?\.league\?\.scoring_settings/);
 assert.match(core,/\/api\/ffo\/gamecast\//);
 assert.doesNotMatch(core,/feed\('espnplays'/);
 assert.doesNotMatch(worker,/function ffoScBuild\(/);
 assert.doesNotMatch(worker,/ffoScEndpoint\(/);
 assert.match(worker,/async function ffoGamecastHandle\(/);
});
test('FFO computes half-PPR receiver independently from MSF stat categories',()=>{
 const stats={receiving:{receptions:5,recYards:100,recTD:1,targets:8},rushing:{rushYards:0,rushTD:0},fumbles:{fumblesLost:0}};
 const out=fflScore(stats,own.scoring,'WR');
 assert.equal(out.points,18.5);
 assert.equal(out.complete,false,'rare scoring events not explicitly covered; never claim certified');
 assert.ok(out.covered.includes('rec_yd')&&out.covered.includes('rec'));
});
test('FFO independently computes QB core stats from MSF fields',()=>{
 const stats={passing:{passYards:300,passTD:2,passInt:1},rushing:{rushYards:20,rushTD:0},fumbles:{fumblesLost:0}};
 const out=fflScore(stats,own.scoring,'QB');
 assert.equal(out.points,20);
 assert.equal(out.complete,false,'unverified bonuses and event categories withheld');
});
test('Missing MySportsFeeds stats are unknown, not zero points',()=>{
 const empty=fflScore({},own.scoring,'RB');
 assert.equal(empty.points,null);
 assert.equal(empty.complete,false);
 assert.ok(empty.missing.length>0);
});
test('Parse MSF play status using actual quarter relative secondsElapsed',()=>{
 const result=plays({gameplaybyplay:{plays:[{id:'msf-1',description:'Test sourced play',playStatus:{quarter:2,secondsElapsed:170}}]}});
 assert.equal(result.length,1);
 assert.equal(result[0].clock,'12:10');
 assert.equal(result[0].period,'2');
 assert.equal(result[0].text,'Test sourced play');
});
test('Player identity: unique team-and-name match, never arbitrary Sleeper ID to MSF',()=>{
 const roster={name:'Christian Watson',team:'GB'};
 const msf=[{name:'Christian Watson',team:'GB',stats:{receiving:{receptions:2}}},{name:'Christian Watson',team:'CAR',stats:{receiving:{receptions:4}}}];
 assert.equal(resolvePlayer(roster,msf).player.team,'GB');
 assert.equal(resolvePlayer({name:'Someone Else',team:'GB'},msf).player,null);
 const doubles=[msf[0],{...msf[0]}];
 assert.equal(resolvePlayer(roster,doubles).status,'ambiguous_player_identity');
});
