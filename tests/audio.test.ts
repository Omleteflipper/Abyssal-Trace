import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, Mixer } from '../src/audio/mixer';
class Gain {
  gain={value:1,setTargetAtTime:(value:number)=>{this.gain.value=value;},setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}};
  connect=vi.fn();disconnect=vi.fn();
}
class Oscillator {
  frequency={value:0,setValueAtTime:vi.fn()};type='sine';connect=vi.fn();disconnect=vi.fn();start=vi.fn();stop=vi.fn();onended?:()=>void;
}
class Context {
  currentTime=0;destination={};oscillators:Oscillator[]=[];
  createGain=()=>new Gain();resume=async()=>{};
  createOscillator=()=>{const source=new Oscillator();this.oscillators.push(source);return source;};
}
afterEach(()=>vi.unstubAllGlobals());
describe('audio routing and lifecycle',()=>{
  it('updates live category and master gains and fades old scene loops',async()=>{
    vi.stubGlobal('AudioContext',Context);const mixer=new Mixer();mixer.init();await mixer.scene('office');
    mixer.update({...defaultSettings,master:80,effects:50});
    expect(mixer.master!.gain.value*mixer.gains.effects.gain.value).toBe(0.4);
    const context=mixer.context as unknown as Context;const first=context.oscillators[0];await mixer.scene('exterior');
    expect(first.stop).toHaveBeenCalledTimes(1);expect(context.oscillators).toHaveLength(2);await mixer.scene(null);expect(context.oscillators[1].stop).toHaveBeenCalledTimes(1);
    mixer.update({...defaultSettings,master:0});expect(mixer.master!.gain.value).toBe(0);
  });
  it('does not block a shift when audio is unavailable',()=>{
    vi.stubGlobal('AudioContext',undefined);expect(()=>new Mixer().init()).not.toThrow();
    vi.stubGlobal('AudioContext',class{constructor(){throw new Error('Device unavailable');}});expect(()=>new Mixer().init()).not.toThrow();
  });
});
