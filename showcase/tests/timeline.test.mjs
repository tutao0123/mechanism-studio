import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimeline,locateTime} from '../timeline.mjs';
test('one timeline wraps, seeks, and resolves chapter boundaries deterministically',()=>{
  const t=createTimeline([{id:'intake'},{id:'power'}],{intake:3,power:7});
  assert.equal(t.total,10);assert.equal(locateTime(t,3).chapter.id,'power');
  assert.equal(locateTime(t,10).chapter.id,'intake');assert.equal(locateTime(t,-1).chapter.id,'power');
  assert.deepEqual(locateTime(t,5),locateTime(t,25));assert.equal(locateTime(t,5).localTime,2);
  assert.throws(()=>createTimeline([{id:'x'},{id:'x'}]));assert.throws(()=>createTimeline([{id:'x'}],{x:NaN}));
});
