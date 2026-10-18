import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { encode } from 'fast-png';
import { carvePng, crc32, decodePng, decodeStationLsb, encodeStationLsb, compareHashes, SIGNATURE, MAX_BYTES } from '../src/tools/forensics';
const fixture=(name:string)=>new Uint8Array(readFileSync(new URL(`../public/evidence/${name}`,import.meta.url)));
const join=(...parts:Uint8Array[])=>{const bytes=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;};
const mutateHeader=(bytes:Uint8Array, edit:(view:DataView,copy:Uint8Array)=>void)=>{const copy=bytes.slice(),view=new DataView(copy.buffer);edit(view,copy);view.setUint32(29,crc32(copy.subarray(12,29)));return copy;};
describe('bounded PNG recovery',()=>{
  it('recovers an intact PNG at a nonzero byte offset and preserves exact bytes',()=>{
    const raw=fixture('nacre.bin'),result=carvePng(raw);
    expect(result).toHaveLength(1);expect(result[0].offset).toBe(173);expect(result[0].valid).toBe(true);expect(result[0].bytes).toEqual(fixture('archive-c7.png'));
  });
  it('lists both intact Mira images and rejects the truncated candidate',()=>{
    const result=carvePng(fixture('mira.bin'));
    expect(result).toHaveLength(3);expect(result.filter(c=>c.valid)).toHaveLength(2);expect(result[2].status).toMatch(/Truncated/);expect(result[0].bytes).not.toEqual(result[1].bytes);
    expect(result[1].text?.Scene).toContain('copper bridge');
  });
  it('does not accept a false signature or an isolated IEND string',()=>{
    const falseSignature=join(SIGNATURE,new TextEncoder().encode('noiseIENDmoreNoise'));
    const result=carvePng(join(falseSignature,fixture('archive-c7.png')));
    expect(result.filter(c=>c.valid)).toHaveLength(1);expect(result[0].valid).toBe(false);
    expect(carvePng(new TextEncoder().encode('IEND'))).toEqual([]);
  });
  it('rejects a bad CRC including IEND, without losing later intact candidates',()=>{
    const corrupt=fixture('archive-c7.png');corrupt[corrupt.length-1]^=1;
    const result=carvePng(join(corrupt,fixture('archive-j4.png')));
    expect(result[0].valid).toBe(false);expect(result[0].status).toMatch(/CRC/);expect(result[1].valid).toBe(true);
  });
  it('bounds declared chunk lengths and dimensions before decode',()=>{
    const badLength=fixture('archive-c7.png');new DataView(badLength.buffer).setUint32(8,0xffffffff);
    expect(carvePng(badLength)[0].status).toMatch(/length/);
    const huge=mutateHeader(fixture('archive-c7.png'),v=>{v.setUint32(16,100000);v.setUint32(20,100000);});
    expect(carvePng(huge)[0].status).toMatch(/pixel limit/);
  });
  it('rejects unsupported bit depth, color type and interlacing',()=>{
    for(const [offset,value] of [[24,16],[25,0],[28,1]]) {
      const bytes=mutateHeader(fixture('archive-c7.png'),(_,copy)=>{copy[offset]=value;});
      expect(()=>decodePng(bytes)).toThrow(/Unsupported/);
    }
  });
  it('handles truncated files, empty files, oversize files and random noise',()=>{
    expect(carvePng(fixture('archive-c7.png').slice(0,-12))[0].valid).toBe(false);
    expect(()=>carvePng(new Uint8Array())).toThrow(/empty/);
    expect(()=>carvePng(new Uint8Array(MAX_BYTES+1))).toThrow(/8 MB/);
    expect(carvePng(new Uint8Array(1000).fill(37))).toEqual([]);
  });
});
describe('defined station LSB format',()=>{
  it('reads the real Vela report from the recovered file',()=>{
    const image=carvePng(fixture('vela.bin'))[0].bytes!;
    expect(decodeStationLsb(image,'RGB')).toMatchObject({found:true,message:'P2 FLOODING. 22:06. OPEN CHANNEL COMPROMISED. ISOLATE PUMP TWO. VELA.'});
  });
  it('handles wrong channels and empty samples without universal claims',()=>{
    for(const channel of ['R','G','B'] as const) expect(decodeStationLsb(fixture('sample-signal.png'),channel)).toMatchObject({found:false});
    expect(decodeStationLsb(fixture('sample-empty.png')).status).toContain('Other hidden information may still exist');
  });
  it('decodes a new visitor-independent UTF-8 RGBA fixture and ignores alpha',()=>{
    const width=48,height=48,raw=new Uint8Array(width*height*4).fill(142),message='New test: Δ / 深海 / emergency.';
    const data=encodeStationLsb(raw,4,message,'G');
    for(let i=3;i<data.length;i+=4)data[i]=i%256;
    const png=encode({width,height,channels:4,depth:8,data});
    expect(decodeStationLsb(png,'G').message).toBe(message);expect(decodeStationLsb(png,'RGB').found).toBe(false);
  });
  it('rejects impossible framed lengths instead of reading beyond the pixels',()=>{
    const data=encodeStationLsb(new Uint8Array(16*16*3),3,'a');
    for(let bit=48;bit<64;bit++)data[bit]|=1;
    const png=encode({width:16,height:16,channels:3,depth:8,data});
    expect(decodeStationLsb(png)).toMatchObject({found:false});expect(decodeStationLsb(png).status).toMatch(/length exceeds/);
  });
  it('rejects invalid UTF-8 in a correctly framed payload',()=>{
    const data=encodeStationLsb(new Uint8Array(16*16*3),3,'a');for(let bit=64;bit<72;bit++)data[bit]|=1;
    expect(decodeStationLsb(encode({width:16,height:16,channels:3,depth:8,data})).status).toMatch(/not valid UTF-8/);
  });
});
describe('original-byte SHA-256',()=>{
  it('matches both the legitimate backup and replay with the same archive',async()=>{
    for(const name of ['rook.bin','nacre.bin'])expect((await compareHashes(carvePng(fixture(name))[0].bytes!,fixture('archive-c7.png'))).identical).toBe(true);
  });
  it('a changed byte yields a different digest',async()=>{
    const a=fixture('archive-c7.png'),b=a.slice();b[100]^=1;
    const result=await compareHashes(a,b);expect(result.identical).toBe(false);expect(result.hashA).toHaveLength(64);expect(result.hashA).not.toBe(result.hashB);
  });
  it('service repair differs from old archive and export preserves bytes',async()=>{
    const service=carvePng(fixture('mira.bin'))[1].bytes!;
    expect((await compareHashes(service,fixture('archive-j4.png'))).identical).toBe(false);
    const exported=new Uint8Array(await new Blob([new Uint8Array(service)]).arrayBuffer());
    expect((await compareHashes(exported,service)).identical).toBe(true);
  });
});
