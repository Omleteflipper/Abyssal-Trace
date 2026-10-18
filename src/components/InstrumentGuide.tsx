import type { ToolId } from '../game/content';
const guides:{id:ToolId;title:string;purpose:string;steps:string[]}[]=[
  {id:'recovery',title:'Recovery Cradle',purpose:'Bring pictures back from a damaged recorder.',steps:['Receive a recorder at the airlock.','Place it in the cradle and press Recover.','Look through the recovered pictures.']},
  {id:'signal',title:'Signal Scope',purpose:'Listen for a message hidden inside a picture.',steps:['Recover a picture first.','Open the scope and press Tune signal.','Read the message, if one is present.']},
  {id:'compare',title:'Trace Comparator',purpose:'Check a picture against the station’s copy.',steps:['Choose a recovered picture.','Press Compare beside the archive copy.','Consider the match alongside the visitor’s claim.']},
];
export function InstrumentGuide({onTry,onBack}:{onTry:(tool:ToolId)=>void;onBack:()=>void}) {
  return <section className="workspace-screen instrument-guide"><h1>Instrument Guide</h1><p>Three ways to examine what a visitor brings you.</p>
    <div className="guide-cards">{guides.map(g=><article key={g.id}><div className={`instrument-drawing drawing-${g.id}`} aria-hidden="true">{g.id==='recovery'?'▤':g.id==='signal'?'∿':'≡'}</div><h2>{g.title}</h2><p>{g.purpose}</p><ol>{g.steps.map(step=><li key={step}>{step}</li>)}</ol><button onClick={()=>onTry(g.id)} aria-label={`Try ${g.title}`}>Try it →</button></article>)}</div>
    <button className="text-button" onClick={onBack}>← Return to main menu</button>
  </section>;
}
