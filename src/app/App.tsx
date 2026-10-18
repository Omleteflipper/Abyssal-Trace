import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { initialState, reducer, type Screen } from './state';
import { archives, encounters, records, resolveEnding, toolInfo, type Decision, type ToolId } from '../game/content';
import { assets, assetUrl } from '../game/assets';
import { audio, defaultSettings, type Settings } from '../audio/mixer';
import { Dialogue, Modal, SafeImage, SettingsPanel } from '../components/Shared';
import { Instruments } from '../components/Instruments';

const rectangle = (rect:{left:number;top:number;width:number;height:number}):CSSProperties=>({left:`${rect.left}%`,top:`${rect.top}%`,width:`${rect.width}%`,height:`${rect.height}%`});
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export default function App() {
  const [state,dispatch]=useReducer(reducer,initialState);
  const [settings,setSettings]=useState<Settings>(()=>({...defaultSettings,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}));
  const [tool,setTool]=useState<ToolId|null>(null),[hoveredTool,setHoveredTool]=useState<ToolId|null>(null),[notebook,setNotebook]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[credits,setCredits]=useState(false),[deviceList,setDeviceList]=useState(false);
  const [confirm,setConfirm]=useState<boolean|null>(null),[reason,setReason]=useState(''),[exitConfirm,setExitConfirm]=useState(false);
  const [line,setLine]=useState(''),[page,setPage]=useState(0),[fade,setFade]=useState(false),[transitioning,setTransitioning]=useState(false),[beat,setBeat]=useState<{admit:boolean;name:string;line:string}|null>(null);
  const busy=useRef(false),beatTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastArrival=useRef<string|null>(null);
  const current=encounters[state.index],caseId=state.screen==='lab'?'lab':current.id;
  const observations=state.observations.filter(o=>o.caseId===caseId),artifacts=state.artifacts.filter(a=>a.caseId===caseId);
  const isPlaying=state.screen==='office'||state.screen==='exterior';const ending=resolveEnding(state.decisions);
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
  const navigate=(screen:Screen)=>void transition(()=>dispatch({type:'screen',screen}),screen);
  const start=(mode:'full'|'demo')=>{
    audio.init();lastArrival.current=null;setTool(null);setNotebook(false);setReason('');setConfirm(null);setLine(encounters[mode==='demo'?3:0].intro);
    if(mode==='demo')setSettings(s=>({...s,instant:true}));
    void transition(()=>dispatch({type:'start',mode}),mode==='demo'?'office':'briefing');
  };
  const openTool=(id:ToolId)=>{setDeviceList(false);setTool(id);void audio.play(`${id}Hover`);};
  const openNotebook=()=>{setNotebook(true);void audio.play('notebookOpen');};
  const returnMenu=()=>{
    setExitConfirm(false);setTool(null);setNotebook(false);void transition(()=>dispatch({type:'reset'}),'menu');
  };
  const decide=()=>{
    if(confirm===null||beat)return;
    const admit=confirm;dispatch({type:'decide',decision:{caseId:current.id,admit,reason}});setConfirm(null);setBeat({admit,name:current.name,line:admit?current.admit:current.deny});void audio.play(admit?'admit':'deny');
    beatTimer.current=setTimeout(()=>{
      setBeat(null);setReason('');if(admit)void audio.play('occupancy');
      if(state.mode==='demo')navigate('debrief');
      else if(state.index===3)navigate('ending');
      else void transition(()=>{dispatch({type:'next'});dispatch({type:'screen',screen:'office'});},'office');
    },2800);
  };
  const available=current.questions.filter(q=>!q.requires||observations.some(o=>o.kind===q.requires&&o.unlock));
  const shown=available.slice(page*4,page*4+4);
  const reviewed=state.mode==='demo'?[encounters[3]]:encounters;
  const darkOffice=['menu','briefing','ending'].includes(state.screen);

  return <main className={`app ${settings.reduced?'reduced-motion':''} ${state.screen==='ending'&&!ending.secure?'ending-failure':''}`} onClick={e=>{if((e.target as HTMLElement).closest('button'))void audio.play('click');}}>
    <div className="app-content" inert={transitioning||!!beat}>
    <header className="topbar">
      <button className="station-brand text-button" aria-label="Main menu" onClick={()=>state.started&&isPlaying?setExitConfirm(true):navigate('menu')}><span className="station-symbol">◈</span> PELAGIC—9 <span className="brand-divider">/</span><span className="brand-sub">ABYSSAL TRACE</span></button>
      <div className="topbar-status"><i className="status-dot"/><span>{state.mode==='demo'&&state.started?'EXPO DEMO':state.screen==='lab'?'INDEPENDENT WORKSPACE':'NIGHT OPERATIONS'}</span><span className="depth">3,800 M BELOW</span></div>
      <div className="hud-actions">{state.started&&isPlaying&&<span className="arrival-count">ARRIVAL {state.mode==='demo'?'01 / 01':`0${state.index+1} / 04`}</span>}{(isPlaying||state.screen==='lab')&&<button onClick={openNotebook}>Notebook <span>{observations.length.toString().padStart(2,'0')}</span></button>}<button onClick={()=>setSettingsOpen(true)} aria-label="Open settings">Settings</button></div>
    </header>

    <div className={`game-stage screen-${state.screen}`}>
      {(darkOffice||state.screen==='office')&&<SafeImage path={assets.office} alt="" className="scene-background"/>}
      {state.screen==='exterior'&&<SafeImage path={assets.exterior} alt="" className="scene-background"/>}
      <div className="vignette" aria-hidden="true"/>
      {darkOffice&&<div className="scene-scrim"/>}
      {state.screen==='menu'&&<section className="menu-screen">
        <div className="menu-corner mono"><span>STATION RECORD / 184</span><span>EXTERNAL COMMS UNRELIABLE</span></div>
        <div className="menu-center"><div className="menu-title"><SafeImage path={assets.logo} alt="Abyssal Trace"/><h1 className="sr-only">Abyssal Trace</h1><span className="content-note">Unsettling imagery<br/>underwater tension ↙</span></div>
          <p className="menu-tagline">Something is waiting outside.</p>
          <nav className="menu-actions" aria-label="Main menu"><button className="rough-button primary" onClick={()=>start('full')}>New Shift <span>→</span></button><button className="rough-button" onClick={()=>{audio.init();navigate('lab');}}>Open Instruments <span>↗</span></button><div className="menu-small"><button onClick={()=>setSettingsOpen(true)}>Settings</button><button onClick={()=>setCredits(true)}>Credits</button></div></nav>
          <button className="demo-link" onClick={()=>start('demo')}><span className="demo-icon">▷</span><span>Expo Demo<small>One encounter. Real evidence.</small></span><span>→</span></button>
        </div>
        <div className="menu-bottom"><span>FOUR ARRIVALS. ONE NIGHT.</span><span>PLAYABLE INITIAL BUILD / PROVISIONAL ART</span></div>
      </section>}

      {state.screen==='briefing'&&<section className="briefing-paper"><span className="eyebrow">SHIFT HANDOVER / READ BEFORE OPENING THE LOCK</span><h1>You are the last<br/>operator on duty.</h1><p>Pelagic-9 is damaged. Four arrivals may seek refuge before dawn. Some can help us. One may be an Echo.</p><p>Receive their recorders. Question their claims. Compare the recovered evidence with independent station records.</p><blockquote>Echoes repeat borrowed observations.<br/>Appearance, hidden messages, and duplicates alone prove nothing.</blockquote><div className="briefing-tools">{Object.entries(toolInfo).map(([id,t])=><div key={id}><span className="mono">{t.number}</span><strong>{t.title}</strong><small>{t.purpose}</small></div>)}</div><p className="tiny muted">Door → visitor · Desks → instruments · Notebook → records<br/>No countdown. No saves. Reloading starts again. Plan for about 8–12 minutes; first-player timing is still to be measured.</p><button className="primary" onClick={()=>navigate('office')}>Start Shift <span>→</span></button></section>}

      {state.screen==='office'&&<section className="office-screen" aria-label="Office">
        <div className="office-heading"><span className="eyebrow">THE OPERATOR’S OFFICE</span><h1>The next knock.</h1><p>{current.name} is waiting at the airlock.</p></div>
        <button className="door-hotspot" style={rectangle(assets.door)} onMouseEnter={()=>void audio.play('doorHover')} onFocus={()=>void audio.play('doorHover')} onClick={()=>navigate('exterior')} aria-label={`Open airlock view — speak to ${current.name}`}><span className="door-indicator"/><span className="hotspot-label"><small>VISITOR AT THE LOCK</small>{current.name} <b>↗</b></span></button>
        {hoveredTool&&assets.hotspots[hoveredTool].overlay&&<img className="full-hover-overlay" src={assetUrl(assets.hotspots[hoveredTool].overlay!)} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}
        {(Object.entries(assets.hotspots) as [ToolId,typeof assets.hotspots.recovery][]).map(([id,rect])=><button key={id} className={`device-hotspot device-${id}`} style={rectangle(rect)} onClick={()=>openTool(id)} onMouseEnter={()=>{setHoveredTool(id);void audio.play(`${id}Hover`);}} onMouseLeave={()=>setHoveredTool(null)} onFocus={()=>{setHoveredTool(id);void audio.play(`${id}Hover`);}} onBlur={()=>setHoveredTool(null)} aria-label={`Open ${toolInfo[id].title}`}>
          <span className="device-crosshair">＋</span><span className="hotspot-label"><small>INSTRUMENT {toolInfo[id].number}</small>{toolInfo[id].title}<em>{toolInfo[id].purpose}</em></span>
        </button>)}
        <div className="office-bottom"><div className="occupancy"><small>REFUGE OCCUPANCY</small><span aria-label={`${admitted} visitors admitted`}>{Array.from({length:4},(_,i)=><i key={i} className={i<admitted?'lit':''}/>)}</span><p>{admitted===0?'Only you, for now.':`${admitted} visitor${admitted===1?'':'s'} inside.`}</p></div><p className="office-hint">{state.received.includes(current.id)?'Recorder received. Use the illuminated instruments.':'Approach the airlock to receive the recorder.'}</p><button onClick={()=>setDeviceList(true)}>Instrument directory ↗</button></div>
      </section>}

      {state.screen==='exterior'&&<section className="exterior-screen" aria-label={`Exterior — ${current.name}`}>
        <div className="exterior-label mono">EXTERNAL INTAKE / SEALED CHANNEL<br/><span>VISUAL IDENTITY UNVERIFIED</span></div>
        <SafeImage path={assets.portraits[current.id].path} alt={`Provisional illustration of ${current.name}, a ${current.species.toLowerCase()}`} className="visitor-portrait" style={{...rectangle(assets.portraits[current.id]),objectFit:assets.portraits[current.id].fit,objectPosition:assets.portraits[current.id].origin}}/>
        <div className="visitor-caption"><span className="eyebrow">{current.species.toUpperCase()}</span><span>DEPTH UNKNOWN / SIGNAL LOCAL</span></div>
        <div className="dialogue-panel"><div className="dialogue-heading"><div><span className="eyebrow">{current.role}</span><h1>{current.name}<span> / 0{state.mode==='demo'?1:state.index+1}</span></h1></div><span className="signal-bars" aria-label="Weak radio signal">▂▄▆</span></div>
          <Dialogue text={line||current.intro} instant={settings.instant||settings.reduced}/>
          {!state.received.includes(current.id)?<button className="receive-button" onClick={()=>{dispatch({type:'receive',id:current.id});setLine('The sealed recorder passes through the intake. The file index is unreadable. Its raw bytes are now available in the Recovery Cradle.');void audio.play('intake');}}>↓ Receive recorder through intake</button>:<div className="received-note"><i className="status-dot"/> RECORDER RECEIVED · {current.id.toUpperCase()}.BIN</div>}
          <div className="question-label"><span className="eyebrow">QUESTION THE CLAIM</span>{available.length>4&&<button className="text-button" onClick={()=>setPage(p=>p===0?1:0)}>{page===0?'More questions':'Previous questions'} <span>↔</span></button>}</div>
          <div className="dialogue-choices">{shown.map(q=><button key={q.id} className={q.requires?'evidence-question':''} onClick={()=>{setLine(q.reply);dispatch({type:'ask',id:`${current.id}-${q.id}`});void audio.play('dialogue');void audio.play(current.id);}}><span>{q.requires?'◇ ':''}{q.label}</span><small>{state.asked.includes(`${current.id}-${q.id}`)?'ASKED':q.requires?'EVIDENCE':'↗'}</small></button>)}</div>
          {available.length===4&&<p className="tiny muted">Record findings to open evidence questions.</p>}
          <button className="return-office" onClick={()=>{void audio.play('return');navigate('office');}}>← Return to Office <small>Inspect the recorder</small></button>
          <div className="decision-row"><span>YOUR DECISION<br/><small>Confirmation required</small></span><button onClick={()=>{setConfirm(false);setReason('');}}>Deny <span>↙</span></button><button className="admit-button" onClick={()=>{setConfirm(true);setReason('');}}>Admit <span>↗</span></button></div>
        </div>
      </section>}

      {state.screen==='ending'&&<section className="ending-screen"><span className="eyebrow">PELAGIC-9 / SHIFT RESOLUTION</span><div className="ending-symbol">{ending.secure?'◉':'◌'}</div><h1 aria-label={ending.secure?'Secure Until Dawn.':'The Refuge Falls.'}>{ending.secure?<>Secure<br/><em>Until Dawn.</em></>:<>The Refuge<br/><em>Falls.</em></>}</h1><p>{ending.secure?'The pressure holds. Beyond the glass, the first pale light returns. You did not have to keep everyone outside. You needed help—and a reason to trust it.':ending.echoInside?'The final pressure cycle starts. Someone inside repeats the alarm before it sounds. The lock held against the ocean. It did not hold against the Echo.':'The last visitor disappears. When the final pressure cycle starts, the manual valves need more hands than yours. The refuge is empty. The ocean is not.'}</p><button className="primary" onClick={()=>navigate('debrief')}>Review the evidence <span>→</span></button></section>}

      {state.screen==='debrief'&&<section className="debrief-screen"><header><span className="eyebrow">{state.mode==='demo'?'EXPO DEMO / ONE SELF-CONTAINED CASE':'PELAGIC-9 / AFTER-ACTION RECORD'}</span><h1>{state.mode==='demo'?'Encounter Review':'What the traces told you.'}</h1><p>{state.mode==='demo'?'This was a demonstration encounter, not a resumed shift or a full-game ending.':'The story has a ground truth. Your instruments reveal observations—not identities.'}</p></header>
        <div className="case-reviews">{reviewed.map(c=>{
          const decision=state.decisions.find(d=>d.caseId===c.id),found=state.observations.filter(o=>o.caseId===c.id);
          return <details className="case-review" key={c.id} open={state.mode==='demo'||undefined}><summary><span className="case-number">0{encounters.indexOf(c)+1}</span><strong>{c.name}<small>{c.species}</small></strong><span>{decision?.admit?'Admitted':'Denied'}<small>Story truth: {c.truth}</small></span><span>＋</span></summary><div className="review-body"><div><h3>The claim</h3><p>{c.claim}</p><h3>Your observations</h3>{found.length?found.map(o=><p className="review-observation" key={o.id}>{o.text}</p>):<p className="missed">No findings recorded. This decision was not supported by recorded tool observations.</p>}{(['recovery','signal','compare'] as ToolId[]).filter(t=>(t==='recovery'||(c.id==='vela'?t==='signal':t==='compare'))&&!found.some(o=>o.kind===t&&o.unlock)).map(t=><p className="missed" key={t}>Not established in your notebook: relevant {toolInfo[t].title} finding.</p>)}{decision?.reason&&<p><strong>Your reason:</strong> {decision.reason}</p>}</div><div><h3>Independent context & story truth</h3><p>{c.expected}</p><p>{c.name} is {c.truth==='Echo'?'the Echo in this authored scenario':'a genuine arrival in this authored scenario'}.</p><blockquote>{c.lesson}</blockquote></div></div></details>;
        })}</div><div className="debrief-actions"><button className="primary" onClick={()=>start('full')}>{state.mode==='demo'?'Begin the full four-arrival shift':'Try another shift'} <span>→</span></button><button onClick={()=>navigate('lab')}>Open Instruments ↗</button><button className="text-button" onClick={returnMenu}>Main menu</button></div>
      </section>}

      {state.screen==='lab'&&<section className="workspace-screen"><span className="eyebrow">PELAGIC-9 / INDEPENDENT INSTRUMENT WORKSPACE</span><h1>Follow the evidence.</h1><p className="workspace-intro">Three working instruments. Your files, your observations.<br/>Use a bundled recorder or bring a supported local file.</p><div className="workspace-tools">{(Object.entries(toolInfo) as [ToolId,typeof toolInfo.recovery][]).map(([id,t])=><button key={id} onClick={()=>openTool(id)}><span className="eyebrow">INSTRUMENT {t.number}</span><span className={`instrument-drawing drawing-${id}`} aria-hidden="true">{id==='recovery'?'▤':id==='signal'?'∿':'≡'}</span><h2>{t.title}</h2><p>{t.purpose}</p><span className="open-label">Open instrument <b>↗</b></span></button>)}</div><div className="lab-note"><span>i</span><p>All analysis happens locally in your browser. Try Vela’s recorder for a supported hidden message, or compare Rook’s recovered PNG with C7-004. Uploads and findings reset on reload.</p></div><button className="text-button" onClick={returnMenu}>← Return to main menu</button></section>}
    </div>
    <footer className="app-footer"><span><i className="status-dot"/> {isPlaying?'AIRLOCK SEALED':'PELAGIC-9 SYSTEMS ONLINE'}</span><span>{state.log.at(-1)??'A quiet game about what remains.'}</span><span>NO SAVES / LOCAL ANALYSIS</span></footer>
    </div>

    {tool&&<Instruments key={`${caseId}-${tool}`} tool={tool} caseId={caseId} received={state.received.includes(current.id)} artifacts={artifacts} selectedId={state.selected[caseId]} onSelect={id=>dispatch({type:'select',caseId,id})} onArtifacts={files=>dispatch({type:'artifacts',artifacts:files})} onObservation={observation=>dispatch({type:'observe',observation})} onClose={()=>setTool(null)} onNotebook={openNotebook} onTool={setTool}/>}
    {notebook&&<Modal title="Evidence notebook" eyebrow={caseId==='lab'?'INDEPENDENT WORKSPACE':`${current.name.toUpperCase()} / CASE RECORD`} onClose={()=>{setNotebook(false);void audio.play('notebookClose');}} wide><div className="notebook-body"><section>{caseId!=='lab'&&<><span className="eyebrow">CURRENT CLAIM</span><blockquote>{current.claim}</blockquote></>}<h3>Collected files <span className="mono">/ {artifacts.length}</span></h3>{artifacts.length?artifacts.map(a=><p className="notebook-file" key={a.id}>▤ {a.name}<small>{a.bytes.length.toLocaleString()} bytes · offset {a.offset.toLocaleString()}</small></p>):<p className="muted">No recovered files yet. Receive a recorder, then scan it.</p>}<h3>Recorded observations</h3>{observations.length?observations.map(o=><div className="notebook-observation" key={o.id}><span className="eyebrow">{toolInfo[o.kind].title}</span><p>{o.text}</p></div>):<p className="muted">Use “Record finding” in an instrument. Observations open new questions.</p>}</section><section><span className="eyebrow">INDEPENDENT STATION RECORDS</span><p className="tiny muted">Available regardless of earlier decisions. These are authored station records, separate from uploaded file metadata.</p>{records.map(r=><article className="station-record" key={r.id}><strong>{r.label}</strong><small>{r.time}</small><p>{r.text}</p></article>)}<h3>Archive receipts</h3>{archives.map(a=><p key={a.id} className="tiny">{a.label} — {a.receipt}</p>)}</section></div></Modal>}
    {settingsOpen&&<SettingsPanel settings={settings} onChange={setSettings} onClose={()=>setSettingsOpen(false)}/>}
    {credits&&<Modal title="Credits & limitations" onClose={()=>setCredits(false)}><div className="modal-body credits-body"><h3>Abyssal Trace</h3><p>Created for Chris’s Technica 2026 project. Game implementation, original provisional SVG art, procedural evidence illustrations, and dialogue prepared with OpenAI Codex. No runtime AI is used.</p><p>This is a playable initial build. Final approved illustrations, logo, aligned hover art, and supplied sound assets remain an integration pass.</p><h3>Open-source components</h3><p>React & React DOM (MIT), fast-png and its dependencies (MIT), Vite and Vitest (MIT), TypeScript (Apache-2.0). IBM Plex Sans and IBM Plex Mono (SIL Open Font License 1.1), bundled locally.</p><p>Original procedural tones use browser Web Audio. No third-party character art, game dialogue, stock images, or sound recordings are included.</p><h3>About the forensics</h3><p>Complete PNG carving, a specifically framed LSB decoder, and Web Crypto SHA-256 comparison. The story’s identities are fictional. No instrument determines whether a person is trustworthy.</p><a href={assetUrl('THIRD_PARTY_NOTICES.txt')} target="_blank" rel="noreferrer">Dependency licenses & notices ↗</a></div></Modal>}
    {deviceList&&<Modal title="Instrument directory" onClose={()=>setDeviceList(false)}><div className="modal-body directory">{(Object.entries(toolInfo) as [ToolId,typeof toolInfo.recovery][]).map(([id,t])=><button key={id} onClick={()=>openTool(id)}><span>{t.number} / {t.title}</span><small>{t.purpose}</small></button>)}<button onClick={()=>{setDeviceList(false);navigate('exterior');}}>Airlock / speak to {current.name} ↗</button></div></Modal>}
    {confirm!==null&&<Modal title={`${confirm?'Admit':'Deny'} ${current.name}?`} eyebrow="FINAL AIRLOCK DECISION" onClose={()=>setConfirm(null)}><div className="modal-body"><p>{confirm?'Cycle the lock and allow this visitor into Pelagic-9.':'Keep the airlock sealed and send this visitor back into the water.'} This decision cannot be reversed during the shift.</p><label htmlFor="decision-reason">Optional evidence reason</label><select id="decision-reason" value={reason} onChange={e=>setReason(e.target.value)}><option value="">No reason selected</option>{observations.map(o=><option key={o.id} value={o.text}>{o.text.slice(0,150)}</option>)}</select><p className="tiny muted">You may decide without examining every instrument. The station will not reveal identity immediately.</p><div className="confirmation-actions"><button onClick={()=>setConfirm(null)}>Keep investigating</button><button className="primary" onClick={decide}>Confirm {confirm?'admission':'denial'} →</button></div></div></Modal>}
    {exitConfirm&&<Modal title="End this shift?" onClose={()=>setExitConfirm(false)}><div className="modal-body"><p>Returning to the main menu discards this shift. There are no saves or checkpoints.</p><div className="confirmation-actions"><button onClick={()=>setExitConfirm(false)}>Keep playing</button><button onClick={returnMenu}>End shift</button></div></div></Modal>}
    {beat&&<div className={`consequence ${beat.admit?'admitted':'denied'}`} role="status"><span className="pressure-ring"/><span className="eyebrow">{beat.admit?'PRESSURE CYCLE / INNER LOCK RELEASED':'INTAKE CLOSED / SIGNAL FADING'}</span><h2>{beat.name} {beat.admit?'admitted.':'denied.'}</h2><p>“{beat.line}”</p><span className="mono">{beat.admit?'OCCUPANCY UPDATED':'THE WATER IS QUIET AGAIN'}</span></div>}
    <div className={`fade-overlay ${fade?'opaque':''}`} style={{pointerEvents:transitioning?'all':'none'}} aria-hidden="true"/>
  </main>;
}
