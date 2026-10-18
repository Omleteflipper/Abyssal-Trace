export interface Settings { master: number; ambience: number; effects: number; voice: number; instant: boolean; reduced: boolean }
export const defaultSettings: Settings = { master: 65, ambience: 40, effects: 55, voice: 60, instant: false, reduced: false };
type Category = 'ambience' | 'effects' | 'voice';
// Replace null paths with bundled licensed sounds. Silent hooks remain intentional.
export const audioManifest = {
  office: { category: 'ambience', path: null }, exterior: { category: 'ambience', path: null }, music: { category: 'ambience', path: null }, radio: { category: 'effects', path: null },
  arrival: { category: 'effects', path: null }, doorHover: { category: 'effects', path: null }, transition: { category: 'effects', path: null }, intake: { category: 'effects', path: null }, return: { category: 'effects', path: null },
  hover: { category: 'effects', path: null }, click: { category: 'effects', path: null }, back: { category: 'effects', path: null }, preview: { category: 'effects', path: null }, dialogue: { category: 'effects', path: null },
  recoveryHover: { category: 'effects', path: null }, signalHover: { category: 'effects', path: null }, compareHover: { category: 'effects', path: null },
  scan: { category: 'effects', path: null }, working: { category: 'effects', path: null }, found: { category: 'effects', path: null }, channel: { category: 'effects', path: null }, decode: { category: 'effects', path: null }, comparison: { category: 'effects', path: null }, empty: { category: 'effects', path: null }, error: { category: 'effects', path: null },
  record: { category: 'effects', path: null }, notebookOpen: { category: 'effects', path: null }, notebookClose: { category: 'effects', path: null },
  mira: { category: 'voice', path: null }, vela: { category: 'voice', path: null }, rook: { category: 'voice', path: null }, nacre: { category: 'voice', path: null },
  confirm: { category: 'effects', path: null }, admit: { category: 'effects', path: null }, deny: { category: 'effects', path: null }, occupancy: { category: 'effects', path: null }, secure: { category: 'effects', path: null }, failure: { category: 'effects', path: null },
} satisfies Record<string,{category:Category;path:string|null}>;
export type AudioEvent = keyof typeof audioManifest;
const tones: Partial<Record<AudioEvent, number>> = { click:220,arrival:390,recoveryHover:160,signalHover:330,compareHover:250,found:520,record:440,decode:310,comparison:280,confirm:170,admit:110,deny:95,secure:440,failure:75,intake:300,channel:350,notebookOpen:200,back:180 };
export class Mixer {
  context?: AudioContext; master?: GainNode; gains = {} as Record<Category,GainNode>; settings = defaultSettings;
  sceneNodes: Array<{ source: AudioScheduledSourceNode; gain: GainNode }> = []; lastHover=0; sceneToken=0;
  cache = new Map<string,AudioBuffer | null>(); voiceNode?:AudioBufferSourceNode; voiceToken=0;
  init() {
    try {
      if(!this.context) {
        if(typeof AudioContext==='undefined')return;
        this.context=new AudioContext();this.master=this.context.createGain();this.master.connect(this.context.destination);
        for(const category of ['ambience','effects','voice'] as Category[]) { const gain=this.context.createGain();gain.connect(this.master);this.gains[category]=gain; }
        this.update(this.settings);
      }
      void this.context.resume().catch(()=>{});
    } catch { /* Audio is optional. An unavailable device must never block gameplay. */ }
  }
  update(settings: Settings) {
    this.settings=settings;
    if(!this.context || !this.master) return;
    const at=this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.master/100,at,0.02);
    for(const c of ['ambience','effects','voice'] as Category[])this.gains[c].gain.setTargetAtTime(settings[c]/100,at,0.02);
  }
  async buffer(path:string) {
    if(this.cache.has(path)) return this.cache.get(path);
    try { const response=await fetch(import.meta.env.BASE_URL+path);if(!response.ok)throw new Error();const buffer=await this.context!.decodeAudioData(await response.arrayBuffer());this.cache.set(path,buffer);return buffer; }
    catch { this.cache.set(path,null);return null; }
  }
  async play(event: AudioEvent) {
    if(!this.context)return;
    if(/Hover|hover/.test(event)) { if(performance.now()-this.lastHover<180)return;this.lastHover=performance.now(); }
    const entry=audioManifest[event] as {category:Category;path:string|null};
    const voice=entry.category==='voice',voiceToken=voice?++this.voiceToken:0;
    if(voice&&this.voiceNode){this.voiceNode.stop();this.voiceNode=undefined;}
    if(entry.path) {
      const buffer=await this.buffer(entry.path);
      if(buffer&&(!voice||voiceToken===this.voiceToken)) {
        const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gains[entry.category]);source.start();
        if(voice)this.voiceNode=source;
        source.onended=()=>{source.disconnect();if(this.voiceNode===source)this.voiceNode=undefined;};
      }
      return;
    }
    if(tones[event])this.tone(tones[event]!,entry.category,event==='arrival'?0.5:0.12);
  }
  tone(frequency:number,category:Category,duration=0.25) {
    if(!this.context)return;const o=this.context.createOscillator(),g=this.context.createGain(),t=this.context.currentTime;
    o.type='sine';o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.09,t+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t+duration);
    o.connect(g);g.connect(this.gains[category]);o.start(t);o.stop(t+duration+0.03);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  async scene(scene:'office'|'exterior'|null) {
    const token=++this.sceneToken;
    this.voiceToken++;if(this.voiceNode){this.voiceNode.stop();this.voiceNode=undefined;}
    if(!this.context)return;
    const ctx=this.context;
    for(const {source,gain} of this.sceneNodes) { gain.gain.setTargetAtTime(0,ctx.currentTime,0.06);source.stop(ctx.currentTime+0.25); }
    this.sceneNodes=[];
    if(!scene)return;
    const gain=ctx.createGain();gain.gain.value=0;gain.connect(this.gains.ambience);
    const entry=audioManifest[scene] as {path:string|null};
    let source: AudioScheduledSourceNode;
    if(entry.path) { const buffer=await this.buffer(entry.path);if(!buffer||token!==this.sceneToken){gain.disconnect();return;}const node=ctx.createBufferSource();node.buffer=buffer;node.loop=true;source=node;gain.gain.setTargetAtTime(0.5,ctx.currentTime,0.2); }
    else { const node=ctx.createOscillator();node.frequency.value=scene==='office'?49:38;node.type='sine';source=node;gain.gain.setTargetAtTime(0.045,ctx.currentTime,0.2); }
    source.connect(gain);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};this.sceneNodes.push({source,gain});
  }
}
export const audio = new Mixer();
