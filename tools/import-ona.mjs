// Run only against the trusted local Ona source supplied by its owner.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Pass the trusted ona asset folder.');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(source, 'traces.js'), 'utf8'), context, { timeout: 5000 });
const traced = context.OnaTraces.parts;
const joint = (id, parent, x, y, rotation, min = -120, max = 120) => ({ id, parent, x, y, rotation, min, max, length: 0 });
const joints = [joint('root', null, 0, 0, 0, -25, 25), joint('leftFoot', 'root', -13, 43, 0, -45, 45), joint('rightFoot', 'root', 13, 43, 0, -45, 45), joint('leftArm', 'root', -27, 0, 18), joint('rightArm', 'root', 27, 0, -15), joint('head', 'root', 0, -16, 0, -25, 25)];
const parts = [];
function add(sourceId, joint, prefix, transform) {
  traced[sourceId].forEach((p, index) => parts.push({ id: `${prefix}-${index}`, joint, d: p.d, fill: p.fill, ...(p.channel ? { channel: p.channel } : {}), transform: `${transform} ${p.transform || ''}`.trim() }));
}
add('shoe-left', 'leftFoot', 'left-shoe', 'scale(.2) translate(-64 0)');
add('shoe-right', 'rightFoot', 'right-shoe', 'scale(.2) translate(-65 0)');
add('arm', 'leftArm', 'left-arm', 'scale(.2) translate(-89 0)');
const clothing = traced.clothing[0];
parts.push({ id: 'shirt-outline', joint: 'root', d: clothing.d, fill: clothing.fill, stroke: '#343332', strokeWidth: 17, transform: `scale(.2) translate(-626 -638) ${clothing.transform || ''}`.trim() });
add('clothing', 'root', 'shirt', 'scale(.2) translate(-626 -638)');
add('arm', 'rightArm', 'right-arm', 'scale(-1 1) scale(.2) translate(-89 0)');
add('head', 'head', 'face', 'translate(0 16) scale(.2) translate(-237 -309)');
const pack = { name: 'Ona', provenance: { source: 'ukis.app Ona vector parts', license: 'MIT', copyright: '2026 Arnas' }, joints, parts,
  inputs: { greeting: { type: 'boolean', default: false } },
  clips: {
    idle: { duration: 3, loop: true, tracks: { 'head.rotation': [[0, -2], [1.5, 2], [3, -2]], 'leftArm.rotation': [[0,18],[1.5,21],[3,18]], 'rightArm.rotation': [[0,-15],[1.5,-18],[3,-15]] } },
    wave: { duration: 1.2, loop: true, tracks: { 'rightArm.rotation': [[0,-85],[.3,-110],[.6,-85],[.9,-110],[1.2,-85]], 'head.rotation': [[0,-4],[.6,1],[1.2,-4]] } }
  },
  initial: 'idle', states: { idle: { clip: 'idle', transitions: [{ to: 'wave', duration: .25, when: { input: 'greeting', equals: true } }] }, wave: { clip: 'wave', transitions: [{ to: 'idle', duration: .25, when: { input: 'greeting', equals: false } }] } },
  reaction: { joint: 'root', strength: 1, stiffness: 45, damping: 9 }
};
const document = { schemaVersion: 1, kind: 'scene', id: 'ona-greeting', name: 'A little hello', revision: 0, bounds: { width: 640, height: 400 }, requiredFeatures: ['rigs','paths','timelines','input-states','translation-inertia'], packs: { ona: pack }, actors: [{ id: 'ona', name: 'Ona', pack: 'ona', transform: { x: 320, y: 220, scale: 2.2, rotation: 0 }, appearance: {} }] };
fs.mkdirSync('examples', { recursive: true });
fs.writeFileSync('examples/ona.posecraft.json', JSON.stringify(document, null, 2) + '\n');
fs.copyFileSync(path.join(source, 'LICENSE'), 'examples/ONA-LICENSE');
console.log(`Imported ${parts.length} paths from Ona's reusable parts. Full scenes remain in Ukis.`);
