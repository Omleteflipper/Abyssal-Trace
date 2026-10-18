import { carvePng, decodeStationLsb, compareHashes, decodePng } from './forensics';
self.onmessage = async ({ data }) => {
  try {
    const result = data.operation === 'scan' ? carvePng(data.bytes)
      : data.operation === 'signal' ? decodeStationLsb(data.bytes, data.scheme)
      : data.operation === 'pixels' ? decodePng(data.bytes)
      : await compareHashes(data.bytes, data.reference);
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Analysis failed.' }); }
};
