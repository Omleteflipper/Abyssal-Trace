export type VisitorId = 'mira' | 'vela' | 'rook' | 'nacre';
export type ToolId = 'recovery' | 'signal' | 'compare';
export interface Observation { id: string; caseId: VisitorId | 'lab'; kind: ToolId; text: string; fileName: string; fingerprint?: string; unlock?: boolean }
export interface Question { id: string; label: string; reply: string; requires?: ToolId }
export interface Encounter { id: VisitorId; name: string; species: string; role: string; claim: string; intro: string; questions: Question[]; admit: string; deny: string; lesson: string; recordId: string; expected: string; truth: 'Genuine' | 'Echo' }
export const records = [
  { id: 'junction', label: 'Maintenance notice / J4', time: 'Day 184 · 21:55', text: 'West intake, junction J4: replace the broken lower cable with a copper-colored bridge. Old archive image shows no bridge. Service crew assigned: Mira.' },
  { id: 'pump', label: 'Independent pump alarm / P2', time: 'Day 184 · 22:06', text: 'Pump P2 reports a rising water level. Open communications channel is compromised. Emergency messages may use the station RGB low-bit scheme. No identity conclusion follows from concealment.' },
  { id: 'backup', label: 'Repair archive / C7-004', time: 'Received Day 183 · 19:10', text: 'East corridor survey retained as the repair reference for the intake bypass. Salvage technicians are authorized to carry identical backup copies. Receipt time belongs to the station archive.' },
  { id: 'camera', label: 'Equipment service / camera C7', time: 'Day 184 · 21:40', text: 'Camera C7 physically disconnected during evacuation. Recording and power lines removed. No new images can originate from this camera after 21:40.' },
];
export const archives = [
  { id: 'c7', label: 'C7-004 · East corridor', path: 'evidence/archive-c7.png', receipt: 'Day 183 · 19:10', recordId: 'camera' },
  { id: 'j4', label: 'J4-012 · Old junction', path: 'evidence/archive-j4.png', receipt: 'Day 182 · 16:30', recordId: 'junction' },
];
export const encounters: Encounter[] = [
  { id: 'mira', name: 'Mira', species: 'Dumbo octopus', role: 'Maintenance assistant', truth: 'Genuine', recordId: 'junction',
    intro: 'Mira. Maintenance. Could you leave that lamp on? My recorder stopped showing the files on the way back.',
    claim: 'I repaired junction J4 at the west intake, just after 22:00. The recorder index failed on the way back.',
    questions: [
      { id: 'route', label: 'Where did you come from?', reply: 'West intake. Past the broken lamp. I followed the wall when the other lights went out.' },
      { id: 'work', label: 'What did you repair?', reply: 'The lower cable at J4, at the west intake. Just after 22:00. I fitted a copper bridge. It was the only spare that still had insulation.' },
      { id: 'recorder', label: 'What happened to your recorder?', reply: 'It stopped showing the files after the surge on the way back. I did not open it.' },
      { id: 'help', label: 'Can you help inside?', reply: 'I know the manual pressure valves. Someone has to hold them until the pumps catch up.' },
      { id: 'recovered', label: 'I recovered the service image.', requires: 'recovery', reply: 'The copper bridge, across the lower contacts. Check the maintenance notice. That is the work they sent me to do.' },
      { id: 'different', label: 'About the archive comparison.', requires: 'compare', reply: 'The old junction image is from before the repair. The bridge should be different. An old picture cannot show what I changed.' },
    ], admit: 'I can hold the valves. Just show me where.', deny: 'Then… leave the lamp on until I reach the wall.',
    expected: 'The recovered J4 service image shows the copper bridge ordered in the independent maintenance notice. The old J4 archive image differs.',
    lesson: 'A damaged index does not mean the underlying files are gone.' },
  { id: 'vela', name: 'Vela', species: 'Anglerfish', role: 'Communications diver', truth: 'Genuine', recordId: 'pump',
    intro: 'Vela. Communications. Keep your voice low. The open channel was repeating us. I hid the report in a picture.',
    claim: 'Pump P2 flooded at 22:06. I concealed an emergency report in the recorder image because the open channel was compromised.',
    questions: [
      { id: 'route', label: 'Where did you come from?', reply: 'The pump corridor. The water rose above the emergency strips. P2 was still turning.' },
      { id: 'report', label: 'Where is your report?', reply: 'Inside the picture. Station encoding. Read the lowest bits across red, green, and blue.' },
      { id: 'channel', label: 'What happened on the radio?', reply: 'A voice answered before I finished speaking. It used my words. I stopped transmitting.' },
      { id: 'help', label: 'What can you do inside?', reply: 'Isolate the open channel. Give us one line that does not answer itself.' },
      { id: 'image', label: 'The pump picture is intact.', requires: 'recovery', reply: 'Then the report may be intact too. The picture alone does not tell you when the water rose.' },
      { id: 'message', label: 'I read the hidden report.', requires: 'signal', reply: 'P2. 22:06. Check the station alarm. Hiding it was the only way to send it without another voice listening.' },
    ], admit: 'I will close the open channel. Do not answer it again.', deny: 'You heard the report. You still heard it.',
    expected: 'The RGB P9LSB1 report names pump P2 and 22:06, agreeing with the independent station alarm.',
    lesson: 'Hidden communication can be legitimate. Concealment is not proof of deception.' },
  { id: 'rook', name: 'Rook', species: 'Giant isopod', role: 'Salvage technician', truth: 'Genuine', recordId: 'backup',
    intro: 'Rook. Salvage. I brought the bypass diagram. It is an old archive copy, unchanged.',
    claim: 'This is an unchanged backup of archive C7-004. I brought it to repair the intake bypass, not to show a new survey.',
    questions: [
      { id: 'age', label: 'How old is this image?', reply: 'Yesterday. Archive C7-004. I copied it before the evacuation.' },
      { id: 'repair', label: 'Why carry an old survey?', reply: 'The bypass runs along the east wall. The survey shows its couplings. Paper would not survive out here.' },
      { id: 'route', label: 'Did you see camera C7?', reply: 'No. I came from salvage. I brought a diagram, not a new survey.' },
      { id: 'help', label: 'Can you repair the intake?', reply: 'With a second pair of hands. Alone, I cannot hold the coupling and seal it.' },
      { id: 'file', label: 'The diagram was recovered.', requires: 'recovery', reply: 'Good. Keep that copy. I do not have another one.' },
      { id: 'match', label: 'This file is already in our archive.', requires: 'compare', reply: 'It is the repair copy. I told you that. A matching backup is exactly what I hoped you would find.' },
    ], admit: 'Give me the diagram. I will start at the lower coupling.', deny: 'Keep the copy. You may need it without me.',
    expected: 'The recovered PNG exactly matches archive C7-004. Rook explicitly described an unchanged backup, consistent with station repair policy.',
    lesson: 'A duplicate file supports a backup claim; it does not establish deception.' },
  { id: 'nacre', name: 'Nacre', species: 'Giant squid', role: 'Claims survey lead', truth: 'Echo', recordId: 'camera',
    intro: 'Nacre. Survey lead. I have a fresh east corridor image from C7, at 22:18. Open the lock.',
    claim: 'This is a fresh image from camera C7, recorded today at 22:18.',
    questions: [
      { id: 'time', label: 'The exact time.', reply: '22:18. Camera C7. I watched it record. I brought you the picture.' },
      { id: 'route', label: 'Describe your route.', reply: 'East corridor. The lamp. The lower coupling. The lamp. You know the corridor.' },
      { id: 'team', label: 'Where is your survey team?', reply: 'Behind me. Far behind me. There is no reason to wait for them.' },
      { id: 'help', label: 'What can you do inside?', reply: 'What you need. What the others can do. Open the lock.' },
      { id: 'picture', label: 'I recovered your image.', requires: 'recovery', reply: 'Then you have seen it. You have the picture. There is nothing else to ask.' },
      { id: 'contradiction', label: 'The archive matches. C7 was disconnected.', requires: 'compare', reply: 'You have the picture. The time is on the record. The picture is here. Open. The. Lock.' },
    ], admit: 'That is better. We can all be quiet now.', deny: 'The picture is here. The picture is here. The picture…',
    expected: 'The claimed fresh image is identical to C7-004, received yesterday. Independent service records show C7 was disconnected at 21:40, before the claimed 22:18 capture.',
    lesson: 'Evaluate the claim against multiple independent records. A hash alone cannot identify a visitor.' },
];
export type Decision = { caseId: VisitorId; admit: boolean; reason: string };
export function resolveEnding(decisions: Decision[]) {
  const echoInside = decisions.some(d => d.caseId === 'nacre' && d.admit);
  const helpers = decisions.filter(d => d.caseId !== 'nacre' && d.admit).length;
  return { secure: !echoInside && helpers > 0, echoInside, helpers };
}
export const toolInfo: Record<ToolId, { title: string; number: string; purpose: string; limit: string }> = {
  recovery: { title: 'Recovery Cradle', number: '01', purpose: 'Recover complete PNGs from raw bytes.', limit: 'Finds intact embedded PNGs; cannot reconstruct missing or fragmented pixels.' },
  signal: { title: 'Signal Scope', number: '02', purpose: 'Read the signals beneath the surface.', limit: 'Reads only the defined P9LSB1 scheme. LSB conceals information; it does not encrypt it.' },
  compare: { title: 'Trace Comparator', number: '03', purpose: 'Compare an image with the archive.', limit: 'Identical hashes support identical bytes, not an identity verdict. Different bytes may depict the same scene.' },
};
