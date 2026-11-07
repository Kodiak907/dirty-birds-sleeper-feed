import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('./ffo-pfo-core.js',import.meta.url),'utf8');
const accuracy=readFileSync(new URL('./ffo-projection-accuracy-audit-637.mjs',import.meta.url),'utf8');
test('historical Matchups labels state recorded Sleeper league scores are not independently certified results',()=>{
 assert.match(core,/Historical league-recorded matchup totals \(Sleeper; NOT MSF-certified final scores\)/);
 assert.match(core,/LEAGUE RECORDED/);
 assert.match(core,/league-scored points · not MSF-certified/);
 assert.match(core,/HINDSIGHT: league-recorded points · not independently certified/);
 assert.doesNotMatch(core,/Historical final recorded FFL scores · using Week/);
});
test('independent accuracy audit continues requiring MSF source-certificates, not historical Sleeper scoreboard',()=>{
 assert.match(accuracy,/c\?\.provider==='MSF'/);
 assert.match(accuracy,/c\?\.fantasyScoreFromSleeper===false/);
 assert.match(accuracy,/f\.fromSleeperActual===true/);
 assert.match(accuracy,/capturedAt/);
});
