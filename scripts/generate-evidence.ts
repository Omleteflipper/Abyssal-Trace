import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { encode, decode } from 'fast-png';
import { encodeStationLsb } from '../src/tools/forensics';

const output = join(process.cwd(), 'public/evidence');
const sources = join(process.cwd(), 'public/assets/evidence-sources');
mkdirSync(output, { recursive: true }); mkdirSync(sources, { recursive: true });
const W = 512, H = 384;
type Color = [number, number, number];
function draw(kind: 'junction' | 'pump' | 'corridor', repaired = false) {
  const data = new Uint8Array(W * H * 3);
  const rect = (x: number, y: number, w: number, h: number, c: Color) => {
    for (let py = Math.max(0, y); py < Math.min(H, y + h); py++) for (let px = Math.max(0, x); px < Math.min(W, x + w); px++) data.set(c, (py * W + px) * 3);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: Color, thickness = 2) => {
    const n = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
    for(let i=0;i<=n;i++) rect(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),thickness,thickness,c);
  };
  const dark: Color = [12, 27, 31], mid: Color = [36, 69, 70], light: Color = [125, 173, 157];
  rect(0,0,W,H,dark);
  for(let y=0;y<H;y+=4) rect(0,y,W,1,[16,33,37]);
  if(kind === 'junction') {
    rect(46,34,420,312,mid); rect(58,46,396,288,[19,38,42]);
    for(let x=90;x<440;x+=70) { rect(x,75,27,185,[51,78,78]); rect(x+7,79,5,175,light); }
    rect(82,253,348,58,[11,25,29]);
    for(let x=94;x<420;x+=32) rect(x,268,10,22,[113,139,125]);
    if(repaired) { rect(160,278,204,14,[178,116,60]); rect(161,278,202,4,[223,174,100]); }
    else { line(160,278,218,268,[94,127,123],7); line(298,298,363,280,[94,127,123],7); }
    [[65,54],[438,54],[65,320],[438,320]].forEach(([x,y])=>rect(x,y,8,8,light));
  } else {
    for(let i=0;i<5;i++) {
      const x=20+i*35,y=25+i*21;
      line(x,y,W-x,y,mid,3); line(x,y,x,H-y,mid,3); line(W-x,y,W-x,H-y,mid,3); line(x,H-y,W-x,H-y,mid,3);
    }
    line(0,0,210,147,mid,3);line(W,0,300,147,mid,3);line(0,H,210,240,mid,3);line(W,H,300,240,mid,3);
    rect(209,145,94,96,[8,19,23]);rect(215,151,82,3,light);
    for(let x=44;x<210;x+=39) { rect(x,54+x/2|0,10,70,[54,92,91]); rect(x,55+x/2|0,3,66,[130,181,163]); }
    if(kind==='pump') {
      rect(315,122,83,135,[51,76,74]);rect(328,134,57,50,[16,35,38]);rect(340,194,27,12,[161,129,67]);
      rect(0,280,W,104,[25,64,70]);
      for(let y=285;y<H;y+=13) { const x=(y*13)%120;rect(x,y,160,2,[75,124,121]);rect(x+210,y+5,100,1,[46,94,99]); }
    } else { line(360,219,510,289,[106,145,127],14);rect(382,226,13,35,[172,156,103]);rect(428,247,13,35,[172,156,103]); }
  }
  return { width: W, height: H, channels: 3 as const, depth: 8 as const, data };
}
function source(kind: 'junction' | 'pump' | 'corridor') {
  const custom = join(sources, `${kind}-approved.png`);
  if(existsSync(custom)) {
    const png = decode(readFileSync(custom), { checkCrc: true });
    if(png.depth !== 8 || ![3,4].includes(png.channels) || png.width*png.height>4_000_000) throw new Error('Approved sources must be 8-bit RGB/RGBA and at most 4M pixels.');
    return { ...png, data: new Uint8Array(png.data), channels: png.channels as 3 | 4, depth: 8 as const };
  }
  const generated = draw(kind);
  writeFileSync(join(sources, `${kind}-provisional.png`), encode(generated));
  return generated;
}
const junction = source('junction'), pump = source('pump'), corridor = source('corridor');
const oldJunction = encode({ ...junction, text: { Scene: 'J4 junction before repair', Source: 'Unverified recorder field' } });
let repaired = draw('junction',true);
// Approved replacement needs a distinct second source so the repair is visually fair.
const repairedPath=join(sources,'junction-repaired-approved.png');
if(existsSync(join(sources,'junction-approved.png'))) {
  if(!existsSync(repairedPath)) throw new Error('An approved junction source also requires junction-repaired-approved.png.');
  const p=decode(readFileSync(repairedPath),{checkCrc:true});
  if(p.depth!==8 || p.channels!==3 || p.width*p.height>4_000_000) throw new Error('Repaired junction must be 8-bit RGB, at most 4M pixels.');
  repaired={width:p.width,height:p.height,channels:3,depth:8,data:new Uint8Array(p.data)};
}
const service = encode({ ...repaired, text: { Scene: 'J4 service image / copper bridge fitted', ClaimedTime: 'Day 184 22:03', Note: 'Recorder metadata is self-reported, not independently verified.' } });
export const emergency = 'P2 FLOODING. 22:06. OPEN CHANNEL COMPROMISED. ISOLATE PUMP TWO. VELA.';
const pumpImage = encode({ ...pump, data: encodeStationLsb(pump.data, pump.channels, emergency), text: { Scene: 'Pump corridor P2', Encoding: 'Station RGB low-bit report' } });
const survey = encode({ ...corridor, text: { Scene: 'East corridor / intake bypass couplings', Camera: 'C7', Note: 'Metadata alone does not prove capture time or authorship.' } });
const noise = (length: number, seed: number) => {
  let n=seed; return Uint8Array.from({length},()=> { n=(Math.imul(n,1664525)+1013904223)>>>0;return n>>>24; });
};
function moduleFile(name: string, images: Uint8Array[], truncated = false) {
  const parts: Uint8Array[]=[noise(173,91)];
  images.forEach((p,i)=>parts.push(p,noise(97+i*31,27+i)));
  if(truncated) parts.push(service.slice(0,70));
  const combined = new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let at=0;
  for(const part of parts){combined.set(part,at);at+=part.length;}
  writeFileSync(join(output,name),combined);
}
writeFileSync(join(output,'archive-j4.png'),oldJunction);
writeFileSync(join(output,'archive-c7.png'),survey);
writeFileSync(join(output,'sample-signal.png'),pumpImage);
writeFileSync(join(output,'sample-empty.png'),oldJunction);
moduleFile('mira.bin',[oldJunction,service],true);moduleFile('vela.bin',[pumpImage]);moduleFile('rook.bin',[survey]);moduleFile('nacre.bin',[survey]);
writeFileSync(join(output,'manifest.json'),JSON.stringify({ version:1, deterministic:true, format:'8-bit non-interlaced RGB / RGBA PNG', lsb:'P9LSB1; uint16 big-endian UTF-8 byte length; MSB first; RGB row order; alpha ignored', files:{mira:{module:'mira.bin',validPngs:2,truncatedPngs:1,reference:'archive-j4.png',serviceMatchesArchive:false},vela:{module:'vela.bin',message:emergency},rook:{module:'rook.bin',identicalTo:'archive-c7.png'},nacre:{module:'nacre.bin',identicalTo:'archive-c7.png'}},receipts:{'archive-c7.png':'Day 183 19:10','archive-j4.png':'Day 182 16:30'}},null,2));
console.log('Evidence regenerated: four recorder modules, two archives, two standalone samples.');
