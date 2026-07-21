const assert = require('assert');
const { Setlists } = require('./SetlistModels');

const data = {
  devices: [
    { name: 'Kemper Profiler Player', id: 'kp', 'midi-out-id': ['profiler'], presets: [{ pgm: '2-4', label: 'Kemper preset' }] },
    { name: 'Valeton GP-150', id: 'gp', 'midi-out-id': ['GP-150 MIDI'], presets: [{ pgm: '2-4', label: 'GP preset' }] }
  ],
  bands: [{ name: 'Band', setlists: [{ name: 'Solo', cfg: { soloPreset: { kp: '1-3', gp: '2-4' } }, songs: [{ title: 'Song' }] }] }]
};

const model = new Setlists(data);
const activeDevice = model.updateActiveMidiOutputDevice([
  { name: 'Kemper Profiler Player' },
  { name: 'GP-150 MIDI' }
]);

assert.strictEqual(activeDevice.id, 'kp');
assert.strictEqual(model.getCurrentDevice().id, 'kp');

const secondActiveDevice = model.updateActiveMidiOutputDevice([
  { name: 'something else' },
  { name: 'GP-150 MIDI' }
]);
assert.strictEqual(secondActiveDevice.id, 'gp');
assert.strictEqual(model.getCurrentDevice().id, 'gp');

const setlist = model.getSetlist(0);
const soloPresetForGp = setlist.getSoloPresetForDevice(model.findDeviceById('gp'), model);
assert.strictEqual(soloPresetForGp.label, 'GP preset');
assert.strictEqual(soloPresetForGp.pgm, '2-4');

console.log('active-midi-device test passed');
