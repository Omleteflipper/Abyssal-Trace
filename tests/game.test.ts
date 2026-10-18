import { describe, expect, it } from 'vitest';
import { encounters, resolveEnding, type Decision } from '../src/game/content';
import { initialState, reducer } from '../src/app/state';
describe('all sixteen full-shift endings',()=>{
  for(let mask=0;mask<16;mask++)it(`decision combination ${mask.toString(2).padStart(4,'0')}`,()=>{
    const decisions:Decision[]=encounters.map((c,i)=>({caseId:c.id,admit:!!(mask&(1<<i)),reason:''}));
    const result=resolveEnding(decisions);
    expect(result.secure).toBe((mask&8)===0&&(mask&7)!==0);expect(result.echoInside).toBe(!!(mask&8));
  });
});
describe('in-memory shift state',()=>{
  it('demo begins without precomputed observations or artifacts',()=>{
    const demo=reducer(initialState,{type:'start',mode:'demo'});expect(demo.index).toBe(3);expect(demo.screen).toBe('office');expect(demo.artifacts).toEqual([]);expect(demo.observations).toEqual([]);expect(demo.decisions).toEqual([]);
  });
  it('new shift clears all prior progress and demo mode',()=>{
    let state=reducer(initialState,{type:'start',mode:'demo'});state=reducer(state,{type:'receive',id:'nacre'});state=reducer(state,{type:'ask',id:'nacre-time'});state=reducer(state,{type:'decide',decision:{caseId:'nacre',admit:true,reason:'test'}});
    const clean=reducer(state,{type:'start',mode:'full'});expect(clean).toEqual({...initialState,started:true,screen:'briefing'});
  });
  it('receiving a module is idempotent and decisions do not reveal an immediate ending',()=>{
    let state=reducer(initialState,{type:'start',mode:'full'});state=reducer(state,{type:'screen',screen:'exterior'});state=reducer(state,{type:'receive',id:'mira'});state=reducer(state,{type:'receive',id:'mira'});expect(state.received).toEqual(['mira']);
    state=reducer(state,{type:'decide',decision:{caseId:'mira',admit:false,reason:''}});expect(state.screen).toBe('exterior');
  });
});
