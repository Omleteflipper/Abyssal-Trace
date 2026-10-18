import { useEffect, useRef, useState } from 'react';
import type { Artifact, InstrumentResult } from '../app/state';
import { archives, encounters, records, toolInfo, type Observation, type ToolId, type VisitorId } from '../game/content';
import { analyze, fetchBytes } from '../tools/client';
import type { Candidate, compareHashes, decodeStationLsb } from '../tools/forensics';
import { audio } from '../audio/mixer';
import { Modal, SafeImage } from './Shared';

function Preview({bytes}:{bytes:Uint8Array}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const object=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'image/png'}));setUrl(object);return()=>URL.revokeObjectURL(object);},[bytes]);
  return <img className="evidence-preview" src={url||undefined} alt="Recovered recorder image"/>;
}
const label=(file:Artifact)=>file.metadata?.Scene??'Recovered image';
const instructions:Record<ToolId,string>={
  recovery:'A recorder can lose its file list while the image data remains. This instrument searches for recognizable PNG file boundaries.',
  signal:'Steganography hides information inside ordinary files. This instrument reads messages stored in the smallest bits of image colors.',
  compare:'A hash is a fingerprint calculated from a file’s bytes. Comparing hashes helps identify an exact copy.',
};
const noMessage='No message found using the station’s supported encoding.';
function HowItWorks({tool}:{tool:ToolId}) {
  return <details className="tool-learning"><summary>How does it work?</summary>
    {tool==='recovery'?<p>The tool locates a PNG signature, checks the file’s structure, and extracts an intact embedded image. It cannot recreate missing image data.</p>:tool==='signal'?<>
      <p className="bit-example">Example: <code>1001011<mark>0</mark> → 1001011<mark>1</mark></code></p>
      <div className="color-bit-labels" aria-label="Red, green, and blue color channels"><span>R</span><span>G</span><span>B</span></div>
      <p>Changing the highlighted lowest bit changes a color value by only one while storing one message bit. Many such bits form text. Hiding information is different from encrypting it.</p>
    </>:<p>The same file produces the same hash; changing its bytes changes the hash. A match supports identical file content, not the visitor’s identity. Different hashes do not necessarily mean the pictures look different.</p>}
  </details>;
}
const factText:Record<VisitorId,string>={
  mira:'J4’s broken lower cable needed a copper-colored bridge. The old archive shows no bridge. Mira was assigned to the repair.',
  vela:'The P2 alarm reported rising water at 22:06. The open communications channel was compromised.',
  rook:'C7-004 was kept for bypass repairs. Salvage technicians may carry unchanged backup copies.',
  nacre:'Camera C7 was disconnected at 21:40 today. Its power and recording lines were removed.',
};
interface Props {
  visitorName?:string;tool:ToolId;caseId:VisitorId|'lab';received:boolean;artifacts:Artifact[];selectedId?:string;
  results:Record<string,InstrumentResult>;onResult:(key:string,result:InstrumentResult)=>void;
  onSelect:(id:string)=>void;onArtifacts:(a:Artifact[])=>void;onObservation:(o:Observation)=>void;
  onClose:()=>void;onTool:(tool:ToolId)=>void;onReturnVisitor:()=>void;
}
export function Instruments({tool,visitorName,caseId,received,artifacts,selectedId,results,onResult,onSelect,onArtifacts,onObservation,onClose,onTool,onReturnVisitor}:Props) {
  const practice=caseId==='lab',current=encounters.find(c=>c.id===caseId);
  const images=artifacts.filter(a=>a.recovered);
  const selected=images.find(a=>a.id===selectedId)??images[0];
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=useRef(false),mounted=useRef(true);
  const record=records.find(r=>r.id===current?.recordId);
  const reference=practice?{id:'practice',label:'Training archive',path:'evidence/practice-archive.png',receipt:'Stored before this exercise'}:caseId==='vela'?null:archives.find(a=>a.id===(caseId==='mira'?'j4':'c7'))!;
  const resultKey=(kind:ToolId,file=selected)=>`${caseId}:${kind}${kind==='recovery'?'':`:${file?.id??''}`}`;
  const result=results[resultKey(tool)],recovery=results[resultKey('recovery')];
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;audio.stopLoop('working');};},[]);
  const observeRecovery=(file:Artifact)=>onObservation({id:`${caseId}-recovery-${file.id}`,caseId,kind:'recovery',fileName:file.name,
    text:`Recovered image: ${label(file)}.`,unlock:file.origin==='story'&&(caseId!=='mira'||file.metadata?.Scene==='J4 service image / copper bridge fitted')});
  const choose=(file:Artifact)=>{onSelect(file.id);setError('');if(tool==='recovery')observeRecovery(file);};
  const run=async(action:()=>Promise<void>)=>{
    if(active.current)return;active.current=true;setBusy(true);setError('');void audio.startLoop('working');
    try{await action();}catch(e){if(mounted.current){setError(e instanceof Error?e.message:'The instrument could not finish. Try again.');void audio.play('error');}}
    finally{active.current=false;audio.stopLoop('working');if(mounted.current)setBusy(false);}
  };
  const recover=()=>run(async()=>{
    const bytes=await fetchBytes(`evidence/${practice?'practice':caseId}.bin`);
    const candidates=await analyze<Candidate[]>('scan',bytes);
    const files:Artifact[]=candidates.filter(c=>c.valid&&c.bytes).map(c=>({id:`${caseId}-recorder-${c.offset}`,name:`${practice?'practice':caseId}-${c.offset}.png`,bytes:c.bytes!,offset:c.offset,caseId,origin:practice?'sample':'story',recovered:true,metadata:c.text}));
    // Case state outlives the panel; closing during analysis does not discard a result.
    onArtifacts(files);onResult(resultKey('recovery'),{kind:'recovery',count:files.length,rejected:candidates.length-files.length});
    if(files.length){const first=files.find(f=>f.id===selectedId)??files[0];onSelect(first.id);observeRecovery(first);}
    if(mounted.current)void audio.play(files.length?'found':'empty');
  });
  // Guide practice prepares its image using the same real recovery worker.
  useEffect(()=>{if(practice&&tool!=='recovery'&&!images.length)void recover();},[]);
  const tune=()=>run(async()=>{
    if(!selected)return;
    const decoded=await analyze<ReturnType<typeof decodeStationLsb>>('signal',selected.bytes,{scheme:'RGB'});
    const message=decoded.found?decoded.message:noMessage;
    onResult(resultKey('signal'),{kind:'signal',found:decoded.found,message});
    onObservation({id:`${caseId}-signal-${selected.id}`,caseId,kind:'signal',fileName:selected.name,text:message,unlock:selected.origin==='story'&&decoded.found});
    if(mounted.current)void audio.play(decoded.found?'decode':'empty');
  });
  const compare=()=>run(async()=>{
    if(!selected||!reference)return;
    const compared=await analyze<Awaited<ReturnType<typeof compareHashes>>>('compare',selected.bytes,{reference:await fetchBytes(reference.path)});
    onResult(resultKey('compare'),{kind:'compare',identical:compared.identical,referenceId:reference.id});
    onObservation({id:`${caseId}-compare-${selected.id}`,caseId,kind:'compare',fileName:selected.name,fingerprint:compared.hashA,
      text:`${label(selected)} and ${reference.label}: ${compared.identical?'same file':'different files'}. Archive received ${reference.receipt}.`,
      unlock:selected.origin==='story'&&(caseId==='mira'?!compared.identical:compared.identical)});
    if(mounted.current)void audio.play('comparison');
  });
  const showFact=!!result&&tool!=='recovery';
  let interpretation='';
  if(result?.kind==='signal'&&result.found) {
    interpretation=caseId==='vela'&&selected?.origin==='story'&&result.message.includes('P2')&&result.message.includes('22:06')
      ?'The hidden message names pump P2 and 22:06. Compare that with the station alarm.'
      :'A message was recovered from this image. Consider what it says alongside the available records.';
  }
  if(result?.kind==='compare') {
    if(selected?.origin==='story'&&result.referenceId==='c7'&&result.identical&&caseId==='rook')interpretation='This matches the archive copy Rook described as an old backup, consistent with the repair record.';
    else if(selected?.origin==='story'&&result.referenceId==='c7'&&result.identical&&caseId==='nacre')interpretation='Nacre described a new recording, but this file matches the older archive. Compare that claim with the camera’s disconnection time.';
    else if(selected?.origin==='story'&&caseId==='mira'&&result.referenceId==='j4')interpretation=result.identical?'This is the same file as the old junction archive. Check the other recovered image against the repair Mira described.':'This file differs from the old junction archive. Compare the visible repair with Mira’s account and the maintenance notice.';
    else interpretation=result.identical?'The files match exactly. What that supports depends on the claim being made.':'The files differ in their bytes. Their pictures may still look alike.';
  }
  return <Modal title={toolInfo[tool].title} eyebrow="" onClose={onClose} wide>
    <nav className="tool-tabs" aria-label="Instruments">{(Object.keys(toolInfo) as ToolId[]).map(id=><button key={id} disabled={busy} aria-current={tool===id?'page':undefined} onClick={()=>onTool(id)}>{toolInfo[id].title}</button>)}</nav>
    {!practice&&!received?<div className="simple-tool-empty"><p>Return to {visitorName??current?.name} at the airlock and receive their recorder.</p><button className="primary" onClick={onReturnVisitor}>Return to visitor →</button></div>:<div className={`simple-tool tool-${tool}`} aria-busy={busy}>
      <div className="machine-console">
        <p className="tool-instruction">{instructions[tool]}</p>
        <HowItWorks tool={tool}/>
        {tool==='recovery'?<>
          <div className={`recorder-dock ${busy?'working':''}`} aria-label={`${practice?'Practice':current?.name+'’s'} recorder docked`}>
            <svg viewBox="0 0 320 150" aria-hidden="true"><rect x="15" y="104" width="290" height="30" rx="5"/><path d="M40 104V40l12-15h216l12 15v64"/><rect x="73" y="48" width="174" height="36" rx="3"/><path d="M85 60h90m-90 11h130M47 118h226"/><circle cx="260" cy="65" r="5"/></svg>
            <span>{practice?'Practice recorder':`${current?.name}’s recorder`}</span><i className="scan-light"/>
          </div>
          <button className="primary machine-action" disabled={busy} onClick={()=>void recover()}>{busy?'Recovering…':'Recover'}</button>
        </>:<>
          {selected?<div className={`image-monitor ${busy?'working':''}`}><Preview bytes={selected.bytes}/><i className="signal-pulse" aria-hidden="true"/></div>:<div className="machine-empty"><p>{busy?'Preparing the practice image…':'Recover a picture from the recorder first.'}</p>{!busy&&<button onClick={()=>onTool('recovery')}>Open Recovery Cradle</button>}</div>}
          {selected&&images.length>1&&<div className="image-choices" aria-label="Recovered images">{images.map((f,i)=><button key={f.id} aria-pressed={f.id===selected.id} disabled={busy} onClick={()=>choose(f)}>Image {i+1}</button>)}</div>}
          {tool==='compare'&&selected&&(reference?<figure className="archive-card"><SafeImage path={reference.path} alt="Station archive image"/><figcaption><strong>{reference.label}</strong><span>{practice?reference.receipt:`Received ${reference.receipt}`}</span></figcaption></figure>:<p>No station archive image is available for this location. Try the Signal Scope.</p>)}
          {selected&&(tool==='signal'||reference)&&<button className="primary machine-action" disabled={busy} onClick={()=>void (tool==='signal'?tune():compare())}>{busy?(tool==='signal'?'Tuning…':'Comparing…'):tool==='signal'?'Tune signal':'Compare'}</button>}
          {selected&&tool==='compare'&&!reference&&<button onClick={()=>onTool('signal')}>Open Signal Scope</button>}
        </>}
        {error&&<p className="tool-error" role="alert">{error}</p>}
      </div>
      <section className="machine-reading" aria-label="Instrument result" aria-live="polite">
        {tool==='recovery'?<>
          <h3>{recovery?.kind==='recovery'?recovery.count?`${recovery.count} image${recovery.count===1?'':'s'} recovered`:'No complete images found':'Waiting for recovery'}</h3>
          {!!images.length&&<div className="recovered-cards">{images.map((file,i)=><button className={selected?.id===file.id?'chosen':''} key={file.id} aria-label={`Image ${i+1}`} aria-pressed={selected?.id===file.id} onClick={()=>choose(file)} disabled={busy}><Preview bytes={file.bytes}/><span>Image {i+1}</span></button>)}</div>}
          {selected&&<p className="recorder-caption"><strong>Recorder label:</strong> {label(selected)}</p>}
          {recovery?.kind==='recovery'&&recovery.count>0&&selected&&<p className="result-interpretation">{caseId==='mira'&&selected.origin==='story'?'You recovered an image. Compare what it shows with the repair they described.':practice?'An intact image was recovered even though it was embedded inside the recorder file.':'You recovered an image. Compare what it shows with the visitor’s account.'}</p>}
          {recovery?.kind==='recovery'&&recovery.rejected>0&&<p>{recovery.rejected===1?'One damaged fragment could not be recovered.':`${recovery.rejected} damaged fragments could not be recovered.`}</p>}
          {selected&&current&&<div className="claim-fact"><p><strong>{current.name}’s claim</strong>{current.claim}</p>{caseId==='mira'&&<p><strong>{record?.label} · {record?.time}</strong>{factText.mira}</p>}</div>}
        </>:<>
          <h3>{result?.kind==='signal'?result.found?'Message received':noMessage:result?.kind==='compare'?result.identical?'Same file':'Different files':tool==='signal'?'Waiting for a signal':'Waiting for comparison'}</h3>
          {result?.kind==='signal'&&result.found&&<p className="decoded-message">{result.message}</p>}
          {result?.kind==='compare'&&reference&&<p>{reference.label} · {practice?reference.receipt:`Received ${reference.receipt}`}</p>}
          {interpretation&&<p className="result-interpretation">{interpretation}</p>}
          {showFact&&current&&<div className="claim-fact"><p><strong>{current.name}’s claim</strong>{current.claim}</p><p><strong>{record?.label} · {record?.time}</strong>{factText[current.id]}</p></div>}
          {showFact&&practice&&<p className="practice-note">Practice only. These results do not affect a shift.</p>}
        </>}
      </section>
    </div>}
  </Modal>;
}
