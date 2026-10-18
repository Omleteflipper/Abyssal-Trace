// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { Blob as NodeBlob } from 'node:buffer';
import { setImmediate as realImmediate } from 'node:timers';
import { carvePng, compareHashes, decodePng, decodeStationLsb } from '../src/tools/forensics';
import App from '../src/app/App';

vi.mock('../src/audio/mixer',async original=>{
  const source=await original<typeof import('../src/audio/mixer')>();
  return {...source,audio:{init:vi.fn(),update:vi.fn(),scene:vi.fn(),play:vi.fn(),tone:vi.fn(),startLoop:vi.fn(),stopLoop:vi.fn()}};
});
// Browser adapters only: analysis returns the actual pure engine's results on fixture bytes.
class AnalysisWorker {
  onmessage?: (event:{data:unknown})=>void;
  onerror?:()=>void;
  terminated=false;
  async postMessage(data: {operation:string;bytes:Uint8Array;scheme:'RGB'|'R'|'G'|'B';reference:Uint8Array}) {
    try {
      const result=data.operation==='scan'?carvePng(data.bytes):data.operation==='pixels'?decodePng(data.bytes):data.operation==='signal'?decodeStationLsb(data.bytes,data.scheme):await compareHashes(data.bytes,data.reference);
      if(!this.terminated)this.onmessage?.({data:{result}});
    }catch(error){this.onmessage?.({data:{error:(error as Error).message}});}
  }
  terminate(){this.terminated=true;}
}
const blobs:NodeBlob[]=[];
const user={
  click:async(element:Element)=>{fireEvent.click(element);},
  selectOptions:async(element:Element,value:string)=>{fireEvent.change(element,{target:{value}});},
  upload:async(element:Element,file:File)=>{fireEvent.change(element,{target:{files:[file]}});},
  keyboard:async(_keys:string)=>{fireEvent.keyDown(document.activeElement??document.body,{key:'Escape'});},
};
const tick=async(ms=500)=>{await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});};
const click=async(name:string|RegExp)=>{await user.click(screen.getByRole('button',{name}));await tick();};
const finishAnalysis=async()=>{
  // Web Crypto completes outside fake timers.
  await act(async()=>{await new Promise<void>(resolve=>realImmediate(resolve));});await tick(1);
};
const closeTool=async(name:string)=>click(`Close ${name}`);
const enterExterior=async(name:string)=>click(`Open airlock view — speak to ${name}`);
const receive=async()=>click('↓ Receive recorder through intake');
const recover=async(_name:string,candidate=1)=>{
  await click(/Return to Office/);await click('Open Recovery Cradle');await click('Recover');
  const buttons=screen.getAllByRole('button',{name:/^Image [12]$/});await user.click(buttons[candidate-1]);await tick();
};
beforeEach(()=>{
  vi.useFakeTimers();vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('Worker',AnalysisWorker);vi.stubGlobal('Blob',NodeBlob);
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
  vi.stubGlobal('fetch',async(path:string)=>{const name=path.slice(path.indexOf('evidence/'));const bytes=readFileSync(`public/${name}`);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};});
  Object.defineProperty(HTMLImageElement.prototype,'decode',{configurable:true,value:vi.fn().mockResolvedValue(undefined)});
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn((blob:NodeBlob)=>{blobs.push(blob);return `blob:test-${blobs.length}`;})});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({putImageData:vi.fn()} as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('ImageData',class{constructor(public data:Uint8ClampedArray,public width:number,public height:number){}});
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  blobs.length=0;
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('connected playable interface with real analysis',()=>{
  it('retains recovered metadata after reopening and does not mistake Mira’s old image for the repair',async()=>{
    render(<App/>);await click(/New Shift/);await click(/Start Shift/);await enterExterior('Mira');await receive();await recover('Mira',1);
    expect(screen.getByText(/J4 junction before repair/)).toBeTruthy();await closeTool('Recovery Cradle');await enterExterior('Mira');
    expect(screen.queryByRole('button',{name:/More questions/})).toBeNull();
    await click(/Return to Office/);await click('Open Recovery Cradle');expect(screen.getByText(/J4 junction before repair/)).toBeTruthy();
    await user.click(screen.getAllByRole('button',{name:/^Image [12]$/})[1]);await tick();await closeTool('Recovery Cradle');await enterExterior('Mira');await click(/More questions/);
    expect(screen.getByRole('button',{name:/I recovered the service image./})).toBeTruthy();
  });
  it('completes the Expo Demo with actual carving, hash match, contradiction and review',async()=>{
    render(<App/>);await click(/Expo Demo/);await enterExterior('Nacre');await receive();await recover('Nacre');
    expect(screen.getByText('1 image recovered')).toBeTruthy();await click('Trace Comparator');await click('Compare');await finishAnalysis();
    expect(screen.getByText('Same file')).toBeTruthy();expect(screen.getByText(/Camera C7 was disconnected/)).toBeTruthy();await closeTool('Trace Comparator');await enterExterior('Nacre');await click(/More questions/);
    await click(/The archive matches. C7 was disconnected./);expect(screen.getByRole('button',{name:/Open. The. Lock./})).toBeTruthy();
    await click(/^Deny/);await click('Confirm denial →');expect(screen.getByRole('heading',{name:'Nacre denied.'})).toBeTruthy();await tick(3000);
    expect(screen.getByRole('heading',{name:'Encounter Review'})).toBeTruthy();expect(screen.getByText(/Story truth: Echo/)).toBeTruthy();expect(screen.getByRole('button',{name:/Begin the full four-arrival shift/})).toBeTruthy();
  });
  it('plays all four cases, including legitimate LSB and backup, through the secure ending',async()=>{
    render(<App/>);await click(/New Shift/);await click(/Start Shift/);
    for(const [i,name] of ['Mira','Vela','Rook','Nacre'].entries()) {
      await enterExterior(name);await receive();await recover(name,name==='Mira'?2:1);
      if(name==='Vela') {await click('Signal Scope');await click('Tune signal');expect(screen.getByText(/P2 FLOODING. 22:06./)).toBeTruthy();await closeTool('Signal Scope');await click('Open Signal Scope');expect(screen.getByText(/P2 FLOODING. 22:06./)).toBeTruthy();await closeTool('Signal Scope');await enterExterior('Vela');await click(/More questions/);expect(screen.getByRole('button',{name:/I read the hidden report/})).toBeTruthy();await click(/Return to Office/);}
      else {await click('Trace Comparator');await click('Compare');await finishAnalysis();expect(screen.getByText(name==='Mira'?'Different files':'Same file')).toBeTruthy();await closeTool('Trace Comparator');}
      await enterExterior(name);await click(i===3?/^Deny/:/^Admit/);await click(i===3?'Confirm denial →':'Confirm admission →');await tick(3000);
    }
    expect(screen.getByRole('heading',{name:'Secure Until Dawn.'})).toBeTruthy();await click(/Review the evidence/);expect(screen.getAllByText(/Story truth: Genuine/)).toHaveLength(3);
  },15000);
  it('keeps four encounters playable and resolves the Echo-admitted failure',async()=>{
    render(<App/>);await click(/New Shift/);await click(/Start Shift/);
    for(const name of ['Mira','Vela','Rook','Nacre']){await enterExterior(name);await click(/^Admit/);await click('Confirm admission →');await tick(3000);}
    expect(screen.getByRole('heading',{name:'The Refuge Falls.'})).toBeTruthy();expect(screen.getByText(/Someone inside repeats the alarm/)).toBeTruthy();
  });
  it('offers a spoiler-free guide and real neutral practice without file controls',async()=>{
    render(<App/>);await click(/Instrument Guide/);
    expect(screen.queryByText(/Vela|Nacre|C7-004/)).toBeNull();
    await click('Try Signal Scope');await tick();await click('Tune signal');
    expect(screen.getByText('TRAINING CHANNEL CLEAR. REPORT RECEIVED.')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).queryByRole('button',{name:/Record finding|Export|Upload|notebook/i})).toBeNull();
    await closeTool('Signal Scope');await click('Try Signal Scope');
    expect(screen.getByText('TRAINING CHANNEL CLEAR. REPORT RECEIVED.')).toBeTruthy();
  });
  it('supports keyboard settings, immediate sliders, canceling decisions and fresh resets',async()=>{
    render(<App/>);await click('Open settings');const dialog=screen.getByRole('dialog',{name:'Station settings'});
    fireEvent.change(within(dialog).getByLabelText(/Master/),{target:{value:'0'}});expect(within(dialog).getByText('0%')).toBeTruthy();
    await user.click(within(dialog).getByLabelText('Reduced motion'));await user.click(within(dialog).getByLabelText('Instant dialogue text'));await user.keyboard('{Escape}');await tick();expect(screen.queryByRole('dialog')).toBeNull();
    await click(/Expo Demo/);await enterExterior('Nacre');await click(/^Admit/);await click('Keep investigating');expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('heading',{name:/Nacre/})).toBeTruthy();
    cleanup();render(<App/>);expect(screen.getByRole('button',{name:/New Shift/})).toBeTruthy();await click('Open settings');expect(screen.getByLabelText('Instant dialogue text').getAttribute('checked')).toBeNull();
  });
});
