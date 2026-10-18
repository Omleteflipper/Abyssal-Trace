import type { Decision, Observation, VisitorId } from '../game/content';
export type Screen = 'menu' | 'briefing' | 'office' | 'exterior' | 'ending' | 'debrief' | 'lab';
export interface Artifact { id: string; name: string; bytes: Uint8Array; offset: number; caseId: VisitorId | 'lab'; origin: 'story' | 'local' | 'sample'; recovered?: boolean }
export interface GameState { screen: Screen; mode: 'full' | 'demo'; index: number; received: VisitorId[]; artifacts: Artifact[]; observations: Observation[]; decisions: Decision[]; asked: string[]; log: string[]; selected: Record<string,string>; started: boolean }
export const initialState: GameState = { screen:'menu',mode:'full',index:0,received:[],artifacts:[],observations:[],decisions:[],asked:[],log:[],selected:{},started:false };
type Action = { type:'start'; mode:'full'|'demo' } | { type:'screen'; screen:Screen } | { type:'receive'; id:VisitorId } | {type:'artifacts'; artifacts:Artifact[]} | {type:'observe'; observation:Observation} | {type:'ask'; id:string} | {type:'decide'; decision:Decision} | {type:'next'} | {type:'select'; caseId:string; id:string} | {type:'reset'};
export function reducer(state:GameState,action:Action):GameState {
  switch(action.type) {
    case 'start':return {...initialState,started:true,mode:action.mode,index:action.mode==='demo'?3:0,screen:action.mode==='demo'?'office':'briefing'};
    case 'screen':return {...state,screen:action.screen};
    case 'receive':return {...state,received:[...new Set([...state.received,action.id])],log:[...state.log,'Recorder received through sealed intake.']};
    case 'artifacts':return {...state,artifacts:[...state.artifacts.filter(a=>!action.artifacts.some(b=>b.id===a.id)),...action.artifacts]};
    case 'observe':return {...state,observations:[...state.observations.filter(o=>o.id!==action.observation.id),action.observation]};
    case 'ask':return {...state,asked:[...new Set([...state.asked,action.id])]};
    case 'select':return {...state,selected:{...state.selected,[action.caseId]:action.id}};
    case 'decide':return {...state,decisions:[...state.decisions,action.decision],log:[...state.log,`${action.decision.caseId[0].toUpperCase()+action.decision.caseId.slice(1)} ${action.decision.admit?'admitted':'denied'}.`]};
    case 'next':return {...state,index:Math.min(3,state.index+1)};
    case 'reset':return initialState;
  }
}
