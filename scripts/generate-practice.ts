// Neutral guide fixture only. Never rewrites the four story modules or archives.
import { readFileSync, writeFileSync } from 'node:fs';
import { decode, encode } from 'fast-png';
import { encodeStationLsb } from '../src/tools/forensics';
const source=decode(readFileSync('public/evidence/sample-empty.png'),{checkCrc:true});
const image=encode({width:source.width,height:source.height,depth:8,channels:source.channels as 3|4,
  data:encodeStationLsb(new Uint8Array(source.data),source.channels as 3|4,'TRAINING CHANNEL CLEAR. REPORT RECEIVED.'),
  text:{Scene:'Training image'}});
const prefix=new TextEncoder().encode('PELAGIC PRACTICE RECORDER\n');
const recorder=new Uint8Array(prefix.length+image.length);recorder.set(prefix);recorder.set(image,prefix.length);
writeFileSync('public/evidence/practice.bin',recorder);
writeFileSync('public/evidence/practice-archive.png',image);
