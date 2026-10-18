export function analyze<T>(operation: 'scan' | 'signal' | 'compare' | 'pixels', bytes: Uint8Array, extra = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    const timer = window.setTimeout(() => { worker.terminate(); reject(new Error('Analysis exceeded its time limit. Try a smaller supported file.')); }, 10000);
    const done = () => { clearTimeout(timer); worker.terminate(); };
    worker.onmessage = ({ data }) => { done(); data.error ? reject(new Error(data.error)) : resolve(data.result); };
    worker.onerror = () => { done(); reject(new Error('Analysis could not finish. Reload or try another file.')); };
    worker.postMessage({ operation, bytes, ...extra });
  });
}
export async function readLocal(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('Upload limit: 8 MB.');
  if (!file.size) throw new Error('This file is empty.');
  return new Uint8Array(await file.arrayBuffer());
}
export async function fetchBytes(path: string) {
  const response = await fetch(import.meta.env.BASE_URL + path);
  if (!response.ok) throw new Error(`Unable to load bundled evidence (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}
export function download(bytes: Uint8Array, name: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
