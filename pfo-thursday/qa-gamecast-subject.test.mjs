import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPlaySubject} from './ffo-gamecast-stadium.mjs';
const rows=[
 {name:'Casey Quarterback',position:'QB',team:'GB'},
 {name:'Robin Receiver',position:'WR',team:'GB'},
 {name:'Taylor Tightend',position:'TE',team:'GB'},
 {name:'Devon Defender',position:'CB',team:'CAR'},
 {name:'Riley Runner',position:'RB',team:'CAR'},
 {name:'Kyle Kicker',position:'K',team:'CAR'}
];
const subject=text=>selectPlaySubject({text},rows)?.name||null;
test('completed pass selects receiver instead of QB',()=>{
 assert.equal(subject('Casey Quarterback pass to Robin Receiver for 19 yards'), 'Robin Receiver');
});
test('incomplete pass and sack select quarterback, not intended receiver',()=>{
 assert.equal(subject('Casey Quarterback pass intended for Robin Receiver incomplete'),'Casey Quarterback');
 assert.equal(subject('Casey Quarterback sacked by Devon Defender'),'Casey Quarterback');
});
test('interception selects defender who picked it',()=>{
 assert.equal(subject('Casey Quarterback intercepted by Devon Defender'), 'Devon Defender');
});
test('rushing and kicking selects the action player',()=>{
 assert.equal(subject('Riley Runner rushes for 8 yards'),'Riley Runner');
 assert.equal(subject('Kyle Kicker field goal 41 yards is good'),'Kyle Kicker');
});
test('ambiguous play and unknown name never borrow a random portrait',()=>{
 assert.equal(subject('Casey Quarterback pass complete involving Robin Receiver and Taylor Tightend'),null);
 assert.equal(subject('unidentified passer throws deep ball'),null);
});
