import { useEffect, useRef, useState, type ReactNode } from 'react';
import { audio, type Settings } from '../audio/mixer';
import { assetUrl } from '../game/assets';

export function Modal({ title, eyebrow, children, onClose, wide = false }: { title:string; eyebrow?:string; children:ReactNode;onClose:()=>void;wide?:boolean }) {
  const ref=useRef<HTMLDivElement>(null), closeRef=useRef(onClose);closeRef.current=()=>{void audio.play('back');onClose();};
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement;
    ref.current?.focus();
    const handler=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.stopPropagation();closeRef.current();}
      if(event.key==='Tab'){
        const elements=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')??[]).filter(el=>el.offsetParent!==null);
        const first=elements[0],last=elements.at(-1);
        if(!first){event.preventDefault();return;}
        if(event.shiftKey && (document.activeElement===first || document.activeElement===ref.current)){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && (document.activeElement===last||document.activeElement===ref.current)){event.preventDefault();first.focus();}
      }
    };
    const element=ref.current;element?.addEventListener('keydown',handler);
    return()=>{element?.removeEventListener('keydown',handler);if(previous?.isConnected)previous.focus();};
  },[]);
  return <div className="modal-backdrop"><section ref={ref} className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
    <header className="modal-header"><div>{eyebrow!==''&&<span className="eyebrow">{eyebrow??'PELAGIC-9 / OPERATOR TERMINAL'}</span>}<h2>{title}</h2></div><button className="icon-button" aria-label={`Close ${title}`} onClick={()=>closeRef.current()}>✕</button></header>
    {children}
  </section></div>;
}
export function SafeImage({path,alt,className,style}:{path:string;alt:string;className?:string;style?:React.CSSProperties}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[path]);
  return failed?<div className={`asset-fallback ${className??''}`} style={style}>{alt}</div>:<img className={className} style={style} src={assetUrl(path)} alt={alt} onError={()=>setFailed(true)}/>;
}
export function Dialogue({text,instant,onComplete}:{text:string;instant:boolean;onComplete?:()=>void}) {
  const [visible,setVisible]=useState(instant?text.length:0);
  const completed=useRef(false),completeRef=useRef(onComplete);completeRef.current=onComplete;
  useEffect(()=>{if(visible===text.length&&!completed.current){completed.current=true;completeRef.current?.();}},[visible,text]);
  useEffect(()=>{
    setVisible(instant?text.length:0);
    if(instant)return;
    const timer=setInterval(()=>setVisible(n=>{if(n>=text.length)clearInterval(timer);return Math.min(text.length,n+2);}),24);
    return()=>clearInterval(timer);
  },[text,instant]);
  return <button className="dialogue-text" onClick={()=>setVisible(text.length)} aria-label={text} title="Click to reveal the whole transmission"><span aria-hidden="true">“{text.slice(0,visible)}{visible===text.length?'”':'▎'}</span></button>;
}
export function SettingsPanel({settings,onChange,onClose}:{settings:Settings;onChange:(s:Settings)=>void;onClose:()=>void}) {
  return <Modal title="Station settings" eyebrow="" onClose={onClose}>
    <div className="modal-body settings-body">
      <p className="muted">Apply immediately. Settings reset when the page reloads.</p>
      {(['master','ambience','effects','voice'] as const).map(key=><div className="setting" key={key}>
        <label htmlFor={`volume-${key}`}>{key==='ambience'?'Music / ambience':key[0].toUpperCase()+key.slice(1)}<span className="mono">{settings[key]}%</span></label>
        <div className="range-row"><input id={`volume-${key}`} type="range" min="0" max="100" value={settings[key]} onChange={e=>onChange({...settings,[key]:+e.target.value})}/><button className="small" aria-label={`Preview ${key} volume`} onClick={()=>{audio.init();void audio.play('preview',key==='master'?'effects':key);}}>Preview</button></div>
      </div>)}
      <label className="toggle"><input type="checkbox" checked={settings.instant} onChange={e=>onChange({...settings,instant:e.target.checked})}/><span>Instant dialogue text</span></label>
      <label className="toggle"><input type="checkbox" checked={settings.reduced} onChange={e=>onChange({...settings,reduced:e.target.checked})}/><span>Reduced motion</span></label>
      <button className="primary full" onClick={onClose}>Done</button>
    </div>
  </Modal>;
}
