import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { initialState, reducer, type Screen } from './state';
import { encounters, resolveEnding, toolInfo, type ToolId } from '../game/content';
import { assets, assetUrl } from '../game/assets';
import { audio, defaultSettings, type Settings } from '../audio/mixer';
import { Dialogue, Modal, SafeImage, SettingsPanel } from '../components/Shared';
import { Instruments } from '../components/Instruments';
import { InstrumentGuide } from '../components/InstrumentGuide';

const rectangle = (rect:{left:number;top:number;width:number;height:number}):CSSProperties=>({left:`${rect.left}%`,top:`${rect.top}%`,width:`${rect.width}%`,height:`${rect.height}%`});
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const briefingCards = [
  'You are the last operator on duty.',
  'Pelagic-9 is damaged. Four arrivals may seek refuge before dawn.',
  'Some can help you keep the station running.',
  'Not everything outside is what it claims to be.',
];
export default function App() {
  const [state,dispatch]=useReducer(reducer,initialState);
  const [briefingCard,setBriefingCard]=useState(0);
  const briefingButton=useRef<HTMLButtonElement>(null);
  const [settings,setSettings]=useState<Settings>(()=>({...defaultSettings,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}));
  const [tool,setTool]=useState<ToolId|null>(null),[hoveredTool,setHoveredTool]=useState<ToolId|null>(null),[notebook,setNotebook]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[credits,setCredits]=useState(false);
  const [confirm,setConfirm]=useState<boolean|null>(null),[exitConfirm,setExitConfirm]=useState(false);
  const [line,setLine]=useState(''),[page,setPage]=useState(0),[fade,setFade]=useState(false),[transitioning,setTransitioning]=useState(false),[beat,setBeat]=useState<{admit:boolean;name:string;line:string}|null>(null);
  const busy=useRef(false),beatTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastArrival=useRef<string|null>(null);
  const current=encounters[state.index],caseId=state.screen==='lab'?'lab':current.id;
  const introduced=state.introduced.includes(current.id),visitorName=introduced?current.name:'Visitor';
  const observations=state.observations.filter(o=>o.caseId===caseId),artifacts=state.artifacts.filter(a=>a.caseId===caseId);
  const ending=resolveEnding(state.decisions);
  const admitted=state.decisions.filter(d=>d.admit).length;
  useEffect(()=>{audio.update(settings);},[settings]);
  useEffect(()=>{
    void audio.scene(state.screen==='exterior'?'exterior':['office','briefing','ending'].includes(state.screen)?'office':null);
    if(state.screen==='office'&&lastArrival.current!==current.id){lastArrival.current=current.id;void audio.play('arrival');}
    if(state.screen==='exterior')void audio.play('radio');
    if(state.screen==='ending')void audio.play(ending.secure?'secure':'failure');
  },[state.screen,state.index]);
  useEffect(()=>{setLine(current.intro);setPage(0);},[current.id,state.mode]);
  useEffect(()=>{if(confirm!==null)void audio.play('confirm');},[confirm]);
  useEffect(()=>()=>{if(beatTimer.current)clearTimeout(beatTimer.current);void audio.scene(null);},[]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||busy.current||beat)return;
      if((event.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"],[role="dialog"]'))return;
      if(tool||notebook||settingsOpen||credits||confirm!==null||exitConfirm)return;
      if(event.key==='Escape'){event.preventDefault();setSettingsOpen(true);}
      if(event.key.toLowerCase()==='n'&&state.screen==='office'){event.preventDefault();setNotebook(true);void audio.play('notebookOpen');}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[tool,notebook,settingsOpen,credits,confirm,exitConfirm,beat,state.screen]);
  useEffect(()=>{
    if(state.screen==='briefing'&&!transitioning&&!settingsOpen)briefingButton.current?.focus();
  },[state.screen,briefingCard,transitioning,settingsOpen]);
  const transition=async(action:()=>void,destination:Screen)=>{
    if(busy.current)return;busy.current=true;setTransitioning(true);setFade(true);void audio.play('transition');
    try{
      const path=destination==='exterior'?assets.exterior:assets.office;
      const preload=new Image();preload.src=assetUrl(path);
      await Promise.race([preload.decode().catch(()=>{}),wait(180)]);
      if(!settings.reduced)await wait(180);
      action();await wait(settings.reduced?0:40);setFade(false);if(!settings.reduced)await wait(180);
    }finally{setFade(false);setTransitioning(false);busy.current=false;}
  };
  const navigate=(screen:Screen)=>void transition(()=>{if(screen==='exterior'&&!introduced)setLine(current.intro);dispatch({type:'screen',screen});},screen);
  const start=()=>{
    audio.init();lastArrival.current=null;setTool(null);setNotebook(false);setConfirm(null);setLine(encounters[0].intro);setBriefingCard(0);

    void transition(()=>dispatch({type:'start',mode:'full'}),'briefing');
  };
  const openTool=(id:ToolId)=>{setTool(id);void audio.play(`${id}Hover`);};
  const openNotebook=()=>{setNotebook(true);void audio.play('notebookOpen');};
  const returnMenu=()=>{
    setExitConfirm(false);setTool(null);setNotebook(false);void transition(()=>dispatch({type:'reset'}),'menu');
  };
  const decide=()=>{
    if(confirm===null||beat)return;
    const admit=confirm;dispatch({type:'heard',id:current.id,text:admit?current.admit:current.deny});dispatch({type:'decide',decision:{caseId:current.id,admit,reason:''}});setConfirm(null);setBeat({admit,name:visitorName,line:admit?current.admit:current.deny});void audio.play(admit?'admit':'deny');
    beatTimer.current=setTimeout(()=>{
      setBeat(null);if(admit)void audio.play('occupancy');
      if(state.mode==='demo')navigate('debrief');
      else if(state.index===3)navigate('ending');
      else void transition(()=>{dispatch({type:'next'});dispatch({type:'screen',screen:'office'});},'office');
    },2800);
  };
  const available=current.questions.filter(q=>!q.requires||observations.some(o=>o.kind===q.requires&&o.unlock));
  const shown=available.slice(page*4,page*4+4);
  const reviewed=state.mode==='demo'?[encounters[3]]:encounters;
  const darkOffice=['menu','ending'].includes(state.screen);

  return <main className={`app ${settings.reduced?'reduced-motion':''} ${state.screen==='ending'&&!ending.secure?'ending-failure':''}`} onClick={e=>{if((e.target as HTMLElement).closest('button'))void audio.play('click');}}>
    <div className="app-content" inert={transitioning||!!beat}>

    <div className={`game-stage screen-${state.screen}`}>
      {(darkOffice||state.screen==='office')&&<SafeImage path={assets.office} alt="" className="scene-background"/>}
      {state.screen==='exterior'&&<SafeImage path={assets.exterior} alt="" className="scene-background"/>}
      <div className="vignette" aria-hidden="true"/>
      {darkOffice&&<div className="scene-scrim"/>}
      {state.screen==='menu'&&<section className="menu-screen">
        <div className="menu-center"><div className="menu-title"><SafeImage path={assets.logo} alt="Abyssal Trace"/><h1 className="sr-only">Abyssal Trace</h1></div>
          <p className="menu-tagline">Something is waiting outside.</p>
          <nav className="menu-actions" aria-label="Main menu"><button className="rough-button primary" onClick={()=>start()}>New Shift <span>→</span></button><button className="rough-button" onClick={()=>{audio.init();navigate('lab');}}>Instrument Guide <span>↗</span></button><div className="menu-small"><button onClick={()=>setSettingsOpen(true)}>Settings</button><button onClick={()=>setCredits(true)}>Credits</button></div></nav>
        </div>
      </section>}

      {state.screen==='briefing'&&<section className="briefing-cards"><button ref={briefingButton} className="briefing-card" onKeyDown={e=>{if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();}} onClick={()=>{if(briefingCard<briefingCards.length-1)void transition(()=>setBriefingCard(n=>n+1),'briefing');else navigate('office');}}><span>{briefingCards[briefingCard]}</span><small>Click or press Enter / Space</small></button></section>}

      {state.screen==='office'&&<section className="office-screen" aria-label="Office">
        <div className="office-heading"><span className="eyebrow">THE OPERATOR’S OFFICE</span><h1>The next knock.</h1><p>{introduced?`${current.name} is waiting at the airlock.`:'Someone is waiting at the airlock.'}</p></div>
        <button className="door-hotspot" style={rectangle(assets.door)} onMouseEnter={()=>void audio.play('doorHover')} onFocus={()=>void audio.play('doorHover')} onClick={()=>navigate('exterior')} aria-label={`Open airlock view: speak to ${visitorName}`}><span className="door-indicator"/><span className="hotspot-label"><small>VISITOR AT THE LOCK</small>{visitorName} <b>↗</b></span></button>
        {hoveredTool&&assets.hotspots[hoveredTool].overlay&&<img className="full-hover-overlay" src={assetUrl(assets.hotspots[hoveredTool].overlay!)} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}
        {(Object.entries(assets.hotspots) as [ToolId,typeof assets.hotspots.recovery][]).map(([id,rect])=><button key={id} className={`device-hotspot device-${id}`} style={rectangle(rect)} onClick={()=>openTool(id)} onMouseEnter={()=>{setHoveredTool(id);void audio.play(`${id}Hover`);}} onMouseLeave={()=>setHoveredTool(null)} onFocus={()=>{setHoveredTool(id);void audio.play(`${id}Hover`);}} onBlur={()=>setHoveredTool(null)} aria-label={`Open ${toolInfo[id].title}`}>
          <span className="device-crosshair">＋</span><span className="hotspot-label"><small>INSTRUMENT {toolInfo[id].number}</small>{toolInfo[id].title}<em>{toolInfo[id].purpose}</em></span>
        </button>)}
        <button className="desk-notebook" aria-label="Open notebook" title="Notebook (N)" onClick={openNotebook}><svg viewBox="0 0 120 90" aria-hidden="true"><path d="M14 16 93 9l15 61-79 11z" fill="#263e39" stroke="#acc8b9" strokeWidth="2"/><path d="m25 15 15 63M43 29l39-4m-36 15 39-4m-36 15 27-3" fill="none" stroke="#adc9b9" strokeWidth="2"/><path d="m14 26 15-2m-12 14 15-2m-12 14 15-2m-12 14 15-2" stroke="#d7d8b4" strokeWidth="3"/></svg><span>Notebook</span></button>
        <div className="office-bottom"><div className="occupancy"><small>REFUGE OCCUPANCY</small><span aria-label={`${admitted} visitors admitted`}>{Array.from({length:4},(_,i)=><i key={i} className={i<admitted?'lit':''}/>)}</span><p>{admitted===0?'Only you, for now.':`${admitted} visitor${admitted===1?'':'s'} inside.`}</p></div><p className="office-hint">{state.received.includes(current.id)?'Recorder received. Recover its pictures at the desk.':'Go to the airlock and speak to the visitor.'}</p></div>
      </section>}

      {state.screen==='exterior'&&<section className="exterior-screen" aria-label={`Exterior: ${visitorName}`}>
        <SafeImage path={assets.portraits[current.id].path} alt={visitorName} className="visitor-portrait" style={{...rectangle(assets.portraits[current.id]),objectFit:assets.portraits[current.id].fit,objectPosition:assets.portraits[current.id].origin}}/>
        <div className="dialogue-panel"><div className="dialogue-heading"><h1>{visitorName}</h1></div>
          <Dialogue key={`${current.id}-${line||current.intro}`} text={line||current.intro} instant={settings.instant||settings.reduced} onComplete={()=>dispatch({type:'heard',id:current.id,text:line||current.intro,introduction:(line||current.intro)===current.intro})}/>
          {!state.received.includes(current.id)?<button className="receive-button" disabled={!introduced} onClick={()=>{dispatch({type:'receive',id:current.id});void audio.play('intake');}}>↓ Receive recorder</button>:<p className="received-note">Recorder received. Take it to the office to investigate.</p>}
          <div className="question-label">{available.length>4&&<button className="text-button" onClick={()=>setPage(p=>p===0?1:0)}>{page===0?'More questions':'Previous questions'} <span>↔</span></button>}</div>
          <div className="dialogue-choices">{shown.map(q=><button key={q.id} disabled={!introduced} className={q.requires?'evidence-question':''} onClick={()=>{setLine(q.reply);dispatch({type:'ask',id:`${current.id}-${q.id}`});void audio.play('dialogue');void audio.play(current.id);}}><span>{q.label}</span></button>)}</div>
          <button className="return-office" onClick={()=>{void audio.play('return');navigate('office');}}>← Return to Office</button>
          <div className="decision-row"><button onClick={()=>{setConfirm(false);}}>Deny <span>↙</span></button><button className="admit-button" onClick={()=>{setConfirm(true);}}>Admit <span>↗</span></button></div>
        </div>
      </section>}

      {state.screen==='ending'&&<section className="ending-screen"><span className="eyebrow">PELAGIC-9 / SHIFT RESOLUTION</span><div className="ending-symbol">{ending.secure?'◉':'◌'}</div><h1 aria-label={ending.secure?'Secure Until Dawn.':'The Refuge Falls.'}>{ending.secure?<>Secure<br/><em>Until Dawn.</em></>:<>The Refuge<br/><em>Falls.</em></>}</h1><p>{ending.secure?'The pressure holds. Beyond the glass, the first pale light returns. You did not have to keep everyone outside. You needed help, and a reason to trust it.':ending.echoInside?'The final pressure cycle starts. Someone inside repeats the alarm before it sounds. The lock held against the ocean. It did not hold against the Echo.':'The last visitor disappears. When the final pressure cycle starts, the manual valves need more hands than yours. The refuge is empty. The ocean is not.'}</p><button className="primary" onClick={()=>navigate('debrief')}>Review the evidence <span>→</span></button></section>}

      {state.screen==='debrief'&&<section className="debrief-screen"><header><span className="eyebrow">{state.mode==='demo'?'EXPO DEMO / ONE SELF-CONTAINED CASE':'PELAGIC-9 / AFTER-ACTION RECORD'}</span><h1>{state.mode==='demo'?'Encounter Review':'What the traces told you.'}</h1><p>{state.mode==='demo'?'This was a demonstration encounter, not a resumed shift or a full-game ending.':'The story has a ground truth. Your instruments reveal observations, not identities.'}</p></header>
        <div className="case-reviews">{reviewed.map(c=>{
          const decision=state.decisions.find(d=>d.caseId===c.id),found=state.observations.filter(o=>o.caseId===c.id);
          return <details className="case-review" key={c.id} open={state.mode==='demo'||undefined}><summary><span className="case-number">0{encounters.indexOf(c)+1}</span><strong>{state.introduced.includes(c.id)?c.name:'Visitor'}<small>{c.species}</small></strong><span>{decision?.admit?'Admitted':'Denied'}<small>Story truth: {c.truth}</small></span><span>＋</span></summary><div className="review-body"><div><h3>The claim</h3><p>{c.claim}</p><h3>Your observations</h3>{found.length?found.map(o=><p className="review-observation" key={o.id}>{o.text}</p>):<p className="missed">No findings recorded. This decision was not supported by recorded tool observations.</p>}{(['recovery','signal','compare'] as ToolId[]).filter(t=>(t==='recovery'||(c.id==='vela'?t==='signal':t==='compare'))&&!found.some(o=>o.kind===t&&o.unlock)).map(t=><p className="missed" key={t}>Not established in your notebook: relevant {toolInfo[t].title} finding.</p>)}{decision?.reason&&<p><strong>Your reason:</strong> {decision.reason}</p>}</div><div><h3>Independent context & story truth</h3><p>{c.expected}</p><p>{state.introduced.includes(c.id)?c.name:'This visitor'} is {c.truth==='Echo'?'the Echo in this authored scenario':'a genuine arrival in this authored scenario'}.</p><blockquote>{c.lesson}</blockquote></div></div></details>;
        })}</div><div className="debrief-actions"><button className="primary" onClick={()=>start()}>{state.mode==='demo'?'Begin the full four-arrival shift':'Try another shift'} <span>→</span></button><button onClick={()=>navigate('lab')}>Instrument Guide ↗</button><button className="text-button" onClick={returnMenu}>Main menu</button></div>
      </section>}

      {state.screen==='lab'&&<InstrumentGuide onTry={openTool} onBack={returnMenu}/>}
    </div>
    </div>

    {tool&&<Instruments key={`${caseId}-${tool}`} tool={tool} visitorName={visitorName} caseId={caseId} received={state.received.includes(current.id)} artifacts={artifacts} selectedId={state.selected[caseId]} onSelect={id=>dispatch({type:'select',caseId,id})} onArtifacts={files=>dispatch({type:'artifacts',artifacts:files})} onObservation={observation=>dispatch({type:'observe',observation})} results={state.results} onResult={(key,result)=>dispatch({type:'result',key,result})} onClose={()=>setTool(null)} onReturnVisitor={()=>{setTool(null);navigate('exterior');}} onTool={setTool}/>}
    {notebook&&state.screen==='office'&&<Modal title="Notebook" eyebrow="" onClose={()=>{setNotebook(false);void audio.play('notebookClose');}}><div className="modal-body spoken-notebook">{encounters.filter(c=>state.heard[c.id]?.length).map(c=><section key={c.id}><h3>{state.introduced.includes(c.id)?c.name:'Visitor'}</h3>{state.heard[c.id]!.map((text,i)=><p key={i}>“{text}”</p>)}</section>)}{!Object.values(state.heard).some(lines=>lines?.length)&&<p>You have not spoken with a visitor yet.</p>}</div></Modal>}
    {settingsOpen&&<SettingsPanel settings={settings} onChange={setSettings} onClose={()=>setSettingsOpen(false)}/>}
    {credits&&<Modal title="Credits" eyebrow="" onClose={()=>setCredits(false)}><div className="modal-body credits-body"><h3>Abyssal Trace</h3><p>Design, code, story, and art: Chris Wang</p><p>Inspired by No, I'm Not a Human and Shift by Midnight.</p><p>Built with React, TypeScript, Vite, and fast-png.</p></div></Modal>}
    {confirm!==null&&<Modal title={`${confirm?'Admit':'Deny'} ${visitorName}?`} eyebrow="" onClose={()=>setConfirm(null)}><div className="modal-body"><p>This decision cannot be undone.</p><div className="confirmation-actions"><button onClick={()=>setConfirm(null)}>Cancel</button><button className="primary" onClick={decide}>Confirm</button></div></div></Modal>}
    {exitConfirm&&<Modal title="End this shift?" onClose={()=>setExitConfirm(false)}><div className="modal-body"><p>Returning to the main menu discards this shift. There are no saves or checkpoints.</p><div className="confirmation-actions"><button onClick={()=>setExitConfirm(false)}>Keep playing</button><button onClick={returnMenu}>End shift</button></div></div></Modal>}
    {beat&&<div className={`consequence ${beat.admit?'admitted':'denied'}`} role="status"><span className="pressure-ring"/><span className="eyebrow">{beat.admit?'PRESSURE CYCLE / INNER LOCK RELEASED':'INTAKE CLOSED / SIGNAL FADING'}</span><h2>{beat.name} {beat.admit?'admitted.':'denied.'}</h2><p>“{beat.line}”</p><span className="mono">{beat.admit?'OCCUPANCY UPDATED':'THE WATER IS QUIET AGAIN'}</span></div>}
    <div className={`fade-overlay ${fade?'opaque':''}`} style={{pointerEvents:transitioning?'all':'none'}} aria-hidden="true"/>
  </main>;
}
