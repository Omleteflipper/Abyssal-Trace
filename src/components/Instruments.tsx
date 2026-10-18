import { useEffect, useRef, useState } from 'react';
import type { Artifact } from '../app/state';
import { archives, encounters, records, toolInfo, type Observation, type ToolId, type VisitorId } from '../game/content';
import { analyze, download, fetchBytes, readLocal } from '../tools/client';
import type { Candidate, Scheme, compareHashes, decodePng, decodeStationLsb } from '../tools/forensics';
import { audio } from '../audio/mixer';
import { Modal } from './Shared';

type Comparison=Awaited<ReturnType<typeof compareHashes>>;
type Signal=ReturnType<typeof decodeStationLsb>;
function Preview({bytes}:{bytes:Uint8Array}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const object=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'image/png'}));setUrl(object);return()=>URL.revokeObjectURL(object);},[bytes]);
  return <img className="evidence-preview" src={url||undefined} alt="Recovered image, decoded from the selected file bytes"/>;
}
function PixelView({bytes,scheme,lowest}:{bytes:Uint8Array;scheme:Scheme;lowest:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null);const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;setError('');
    analyze<ReturnType<typeof decodePng>>('pixels',bytes).then(png=>{
      if(cancelled||!canvas.current)return;
      const ctx=canvas.current.getContext('2d');if(!ctx)return;
      canvas.current.width=png.width;canvas.current.height=png.height;
      const rgba=new Uint8ClampedArray(png.width*png.height*4);
      for(let i=0;i<png.width*png.height;i++){
        for(let c=0;c<3;c++){const v=png.data[i*png.channels+c];rgba[i*4+c]=scheme==='RGB'||c==={R:0,G:1,B:2}[scheme]?lowest?(v&1)*255:v:0;}
        rgba[i*4+3]=255;
      }
      ctx.putImageData(new ImageData(rgba,png.width,png.height),0,0);
    }).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[bytes,scheme,lowest]);
  return <>{error?<p className="status error">{error}</p>:<canvas ref={canvas} className="evidence-preview pixel-view" aria-label={`${scheme} ${lowest?'lowest-bit':'normal'} image view`}/>}</>;
}
interface Props { tool:ToolId;caseId:VisitorId|'lab';received:boolean;artifacts:Artifact[];selectedId?:string;onSelect:(id:string)=>void;onArtifacts:(a:Artifact[])=>void;onObservation:(o:Observation)=>void;onClose:()=>void;onNotebook:()=>void;onTool:(tool:ToolId)=>void }
export function Instruments(props:Props) {
  const {tool,caseId,received,artifacts,selectedId,onSelect,onArtifacts,onObservation,onClose,onNotebook,onTool}=props;
  const info=toolInfo[tool];const current=encounters.find(c=>c.id===caseId);
  const [module,setModule]=useState<{name:string;bytes:Uint8Array;origin:Artifact['origin']}|null>(null);
  const [candidates,setCandidates]=useState<Candidate[]>([]),[status,setStatus]=useState('Choose a source to begin.'),[busy,setBusy]=useState(false);
  const [scheme,setScheme]=useState<Scheme>('RGB'),[lowest,setLowest]=useState(false),[signal,setSignal]=useState<Signal|null>(null);
  const [reference,setReference]=useState(archives[0].id),[customRef,setCustomRef]=useState<{name:string;bytes:Uint8Array}|null>(null),[comparison,setComparison]=useState<Comparison|null>(null);
  const [recorded,setRecorded]=useState(false);
  const selected=artifacts.find(a=>a.id===selectedId)??artifacts[0];
  const live=useRef(true);useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{setComparison(null);setSignal(null);setRecorded(false);setStatus('Ready. Analysis runs on the selected bytes.');},[selected?.id,scheme,reference,customRef]);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setRecorded(false);try{await action();}catch(e){if(live.current){setStatus(e instanceof Error?e.message:'Analysis failed.');void audio.play('error');}}finally{if(live.current)setBusy(false);}};
  const loadModule=async(id:string)=>run(async()=>{const bytes=await fetchBytes(`evidence/${id}.bin`);if(!live.current)return;setModule({name:`${id}.bin`,bytes,origin:caseId==='lab'?'sample':'story'});setCandidates([]);setStatus('Recorder loaded. Scan to locate complete PNG candidates.');});
  const upload=async(file:File|undefined,referenceSlot=false)=>{if(!file)return;await run(async()=>{
    const bytes=await readLocal(file);if(!live.current)return;
    if(referenceSlot){setCustomRef({name:file.name,bytes});setStatus('Local reference loaded.');return;}
    if(tool==='recovery'){setModule({name:file.name,bytes,origin:'local'});setCandidates([]);setStatus('Local binary loaded. Ready to scan.');}
    else {if(tool==='signal')await analyze('pixels',bytes);if(!live.current)return;const id=`local-${crypto.randomUUID()}`;onArtifacts([{id,name:file.name,bytes,offset:0,caseId,origin:'local'}]);onSelect(id);setStatus('Local file loaded.');}
  });};
  const sample=async(path:string)=>run(async()=>{const bytes=await fetchBytes(`evidence/${path}`);if(!live.current)return;const id=`sample-${path}`;onArtifacts([{id,name:path,bytes,offset:0,caseId,origin:'sample'}]);onSelect(id);});
  const scan=()=>run(async()=>{
    if(!module)return;void audio.play('scan');setStatus('Scanning signatures and validating chunk boundaries + CRCs…');
    const result=await analyze<Candidate[]>('scan',module.bytes);if(!live.current)return;setCandidates(result);
    const recovered:Artifact[]=result.filter(c=>c.valid&&c.bytes).map(c=>({id:`${caseId}-${module.name}-${c.offset}-${c.length}`,name:`${module.name.replace(/\.[^.]+$/,'')}-${c.offset}.png`,bytes:c.bytes!,offset:c.offset,caseId,origin:module.origin,recovered:true}));
    onArtifacts(recovered);if(recovered.length)onSelect(recovered[0].id);
    setStatus(result.length?`${recovered.length} complete PNG${recovered.length===1?'':'s'} recovered · ${result.length-recovered.length} rejected candidate${result.length-recovered.length===1?'':'s'}.`:'No PNG signatures found in this input.');void audio.play(recovered.length?'found':'empty');
  });
  const doSignal=()=>run(async()=>{if(!selected)return;const result=await analyze<Signal>('signal',selected.bytes,{scheme});if(!live.current)return;setSignal(result);setStatus(result.status);void audio.play(result.found?'decode':'empty');});
  const doCompare=()=>run(async()=>{if(!selected)return;const ref=customRef?.bytes??await fetchBytes(archives.find(a=>a.id===reference)!.path);const result=await analyze<Comparison>('compare',selected.bytes,{reference:ref});if(!live.current)return;setComparison(result);setStatus(result.identical?'Identical bytes. Interpret the match in the context of the claim.':'Different bytes. This alone does not show a different visual scene.');void audio.play('comparison');});
  const record=()=>{
    if(!selected)return;
    let text='',unlock=selected.origin==='story';
    if(tool==='recovery'){text=`Recovered ${selected.name}: complete PNG at byte ${selected.offset.toLocaleString()}, ${selected.bytes.length.toLocaleString()} bytes; chunk CRCs verified.`;}
    if(tool==='signal'&&signal){text=signal.found?`Decoded ${scheme} P9LSB1 payload from ${selected.name}: “${signal.message}”`:signal.status;unlock=unlock&&signal.found;}
    if(tool==='compare'&&comparison){text=`${selected.name} and ${customRef?.name??archives.find(a=>a.id===reference)!.label}: ${comparison.identical?'identical bytes':'different bytes'} (SHA-256). Examined digest: ${comparison.hashA}.`;unlock=unlock&&!customRef&&(caseId==='mira'?reference==='j4'&&!comparison.identical:reference==='c7'&&comparison.identical);}
    onObservation({id:`${caseId}-${tool}-${selected.id}-${tool==='signal'?scheme:tool==='compare'?customRef?.name??reference:''}`,caseId,kind:tool,text,fileName:selected.name,fingerprint:comparison?.hashA,unlock});setRecorded(true);void audio.play('record');
  };
  const candidateInfo=candidates.find(c=>c.valid&&c.offset===selected?.offset&&c.bytes?.length===selected?.bytes.length);
  const canRecord=!!selected&&(tool==='recovery'?!!selected.recovered:tool==='signal'?!!signal:!!comparison);
  return <Modal title={info.title} eyebrow={`INSTRUMENT ${info.number} / ${current?`${current.name.toUpperCase()} CASE`:'INDEPENDENT WORKSPACE'}`} onClose={onClose} wide>
    <nav className="tool-tabs" aria-label="Instruments">{(Object.keys(toolInfo) as ToolId[]).map(t=><button key={t} disabled={busy} aria-current={t===tool?'page':undefined} onClick={()=>onTool(t)}>{toolInfo[t].number} / {toolInfo[t].title}</button>)}</nav>
    <div className="instrument-grid">
      <aside className="instrument-source">
        <span className="eyebrow">{tool==='recovery'?'01 / SOURCE':'01 / EXAMINED FILE'}</span>
        {tool==='recovery'?<>
          <h3>Recorder input</h3><p className="muted">Recover complete PNGs from a raw recorder dump.</p>
          {current?<button className="full" disabled={!received||busy} onClick={()=>loadModule(current.id)}>{received?`Load ${current.name}’s recorder`:'Receive recorder outside first'}</button>:<label>Bundled recorder<select defaultValue="" disabled={busy} onChange={e=>{if(e.target.value)void loadModule(e.target.value);}}><option value="" disabled>Choose sample…</option>{encounters.map(c=><option key={c.id} value={c.id}>{c.name} / {c.id}.bin</option>)}</select></label>}
          {module&&<div className="file-card"><span className="file-icon">▤</span><strong>{module.name}</strong><small>{module.bytes.length.toLocaleString()} bytes</small><div className="byte-map" aria-label="Sample byte map">{Array.from(module.bytes.slice(0,96)).map((b,i)=><i key={i} style={{opacity:0.15+b/300}}/>)}</div></div>}
          <button className="primary full" disabled={!module||busy} onClick={scan}>{busy?'Scanning…':'Scan recorder'} <span>→</span></button>
        </>:<>
          <h3>Selected evidence</h3><label className="sr-only" htmlFor="selected-file">Examined file</label><select id="selected-file" disabled={busy} value={selected?.id??''} onChange={e=>onSelect(e.target.value)}><option value="" disabled>No recovered files</option>{artifacts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
          {selected&&<div className="file-card"><span className="file-icon">▤</span><strong>{selected.name}</strong><small>{selected.bytes.length.toLocaleString()} original bytes</small>{tool==='signal'&&<Preview bytes={selected.bytes}/>}</div>}
          {!selected&&<p className="muted">Use Recovery Cradle first, or load a local file below.</p>}
          {caseId==='lab'&&<><button className="full small" disabled={busy} onClick={()=>sample('sample-signal.png')}>Load encoded PNG sample</button><button className="full small" disabled={busy} onClick={()=>sample('sample-empty.png')}>Load empty PNG sample</button></>}
        </>}
        <label className={`upload-button ${busy?'disabled':''}`}>↑ Load local {tool==='recovery'?'binary':tool==='signal'?'PNG':'file'}<input aria-label={`Upload ${tool==='recovery'?'binary':tool==='signal'?'PNG':'examined file'}`} type="file" disabled={busy} accept={tool==='signal'?'.png,image/png':undefined} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
        <p className="tiny muted">Files stay in this browser. 8 MB maximum. PNG analysis: 8-bit RGB/RGBA, non-interlaced, up to 4 million pixels.</p>
      </aside>
      <section className="instrument-main">
        <span className="eyebrow">{tool==='recovery'?'02 / RECOVERED CANDIDATES':tool==='signal'?'02 / CHANNEL VIEW':'02 / STATION REFERENCE'}</span>
        {tool==='recovery'?<>
          <h3>What remains in the bytes</h3>
          {candidates.length>0?<div className="candidate-list">{candidates.map((candidate,i)=><button key={candidate.offset} className={`candidate ${selected?.offset===candidate.offset?'chosen':''}`} disabled={!candidate.valid||busy} onClick={()=>{const a=artifacts.find(a=>a.offset===candidate.offset&&a.bytes.length===candidate.length&&a.name.startsWith(module?.name.replace(/\.[^.]+$/,'')??''));if(a)onSelect(a.id);setRecorded(false);}}>
            <span>{candidate.valid?'▧':'╱'} <strong>Candidate {String(i+1).padStart(2,'0')}</strong></span><span className="mono">0x{candidate.offset.toString(16).toUpperCase().padStart(6,'0')}</span><small>{candidate.valid?`${candidate.width} × ${candidate.height} · ${candidate.length.toLocaleString()} bytes`:candidate.status}</small>
          </button>)}</div>:<div className="empty-state"><div className="reticle">⌁</div><p>Load a recorder.<br/>Look beneath the index.</p></div>}
          {selected?.recovered&&<><Preview bytes={selected.bytes}/><p className="tiny muted">Original recovered PNG. Select each candidate; older images can be present alongside recent ones.</p></>}
        </>:tool==='signal'?<>
          <h3>A quieter channel</h3><div className="segmented" role="group" aria-label="Channel scheme">{(['RGB','R','G','B'] as Scheme[]).map(s=><button disabled={busy} key={s} aria-pressed={scheme===s} onClick={()=>{setScheme(s);void audio.play('channel');}}>{s}</button>)}</div>
          <label className="toggle"><input type="checkbox" checked={lowest} onChange={e=>setLowest(e.target.checked)}/>Show lowest bit plane</label>
          {selected?<PixelView bytes={selected.bytes} scheme={scheme} lowest={lowest}/>:<div className="empty-state"><span className="reticle">∿</span><p>No image selected.</p></div>}
          <p className="tiny muted">Pixels in row order · alpha ignored · one low bit per selected component · most-significant bit first.</p><button className="primary full" disabled={!selected||busy} onClick={doSignal}>{busy?'Reading…':`Decode ${scheme} signal`} <span>→</span></button>
        </>:<>
          <h3>The station remembers</h3><label htmlFor="archive">Reference archive</label><select id="archive" value={customRef?'custom':reference} disabled={busy} onChange={e=>{setCustomRef(null);setReference(e.target.value);}}>{archives.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}{customRef&&<option value="custom">{customRef.name} (local)</option>}</select>
          <div className="file-card"><span className="file-icon">▥</span><strong>{customRef?.name??archives.find(a=>a.id===reference)!.label}</strong><small>{customRef?'User-supplied reference; no station receipt':`Archive receipt: ${archives.find(a=>a.id===reference)!.receipt}`}</small><p className="tiny muted">Receipt is an independently stored fictional station record, not a timestamp inferred from the examined file.</p></div>
          <label className="upload-button">↑ Use local reference<input type="file" aria-label="Upload reference file" disabled={busy} onChange={e=>{void upload(e.target.files?.[0],true);e.target.value='';}}/></label>
          <button className="primary full" disabled={!selected||busy} onClick={doCompare}>{busy?'Hashing original bytes…':'Calculate & compare SHA-256'} <span>→</span></button>
          <div className="station-record"><span className="eyebrow">INDEPENDENT STATION RECORD</span><strong>{records.find(r=>r.id===(reference==='j4'?'junction':caseId==='rook'?'backup':'camera'))!.label}</strong><small>{records.find(r=>r.id===(reference==='j4'?'junction':caseId==='rook'?'backup':'camera'))!.time}</small><p>{records.find(r=>r.id===(reference==='j4'?'junction':caseId==='rook'?'backup':'camera'))!.text}</p></div>
        </>}
      </section>
      <aside className="instrument-result"><span className="eyebrow">03 / OBSERVATION</span>
        <h3>{tool==='recovery'?'Recovered record':tool==='signal'?'Extracted message':'Byte comparison'}</h3>
        {tool==='recovery'&&selected?.recovered?<><p className="result-label">Complete PNG</p><dl><dt>Byte offset</dt><dd className="mono">{selected.offset.toLocaleString()}</dd><dt>Original length</dt><dd className="mono">{selected.bytes.length.toLocaleString()} bytes</dd></dl>{candidateInfo?.text&&Object.entries(candidateInfo.text).map(([key,value])=><div className="metadata" key={key}><small>{key}</small><p>{value}</p></div>)}<p className="tiny muted">PNG text fields are self-reported metadata. They do not certify identity.</p></>:tool==='recovery'?<p className="muted">Run a scan to validate and recover PNG candidates.</p>:null}
        {tool==='signal'&&(signal?<><p className="result-label">{signal.found?'Supported payload recovered':'No supported message'}</p><p className="signal-message">{signal.message||signal.status}</p></>:<p className="muted">Choose a scheme and decode. The station uses RGB.</p>)}
        {tool==='compare'&&(comparison?<><p className="result-label">{comparison.identical?'Identical bytes':'Different bytes'}</p><small>Examined SHA-256 / {comparison.sizeA.toLocaleString()} bytes</small><code className="hash">{comparison.hashA}</code><small>Reference SHA-256 / {comparison.sizeB.toLocaleString()} bytes</small><code className="hash">{comparison.hashB}</code><p className="muted">What does this result support about the visitor’s actual claim?</p></>:<p className="muted">SHA-256 is calculated at runtime from both original files.</p>)}
        <div className="result-actions"><button className="full" disabled={!canRecord||busy||recorded} onClick={record}>{recorded?'✓ Finding recorded':'＋ Record finding'}</button>
          {selected&&tool!=='signal'&&<button className="full small" disabled={busy} onClick={()=>download(selected.bytes,selected.name,'image/png')}>↓ Export original {selected.name.endsWith('.png')?'PNG':'file'}</button>}
          {tool==='signal'&&<button className="full small" disabled={!signal?.found||busy} onClick={()=>download(new TextEncoder().encode(signal!.message),'station-message.txt','text/plain')}>↓ Export text</button>}
          <button className="text-button full" onClick={onNotebook}>Open evidence notebook ↗</button>
        </div>
      </aside>
    </div>
    <footer className="instrument-footer"><p role="status" aria-live="polite">{busy&&<i className="busy-dot"/>}{status}</p><span>{info.limit}</span></footer>
  </Modal>;
}
