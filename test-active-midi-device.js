const assert = require('assert');
const { Setlists } = require('./SetlistModels');

const data = {
  devices: [
    { name: 'Kemper Profiler Player', id: 'kp', 'midi-out-id': ['profiler'], 'solo-pgm': '2-4', presets: [{ pgm: '2-4', label: 'Kemper preset' }] },
    { name: 'Valeton GP-150', id: 'gp', 'midi-out-id': ['GP-150 MIDI'], 'solo-pgm': '2-4', presets: [{ pgm: '2-4', label: 'GP preset' }] }
  ],
  bands: [{ name: 'Band', setlists: [{ name: 'Solo', songs: [{ title: 'Song' }] }] }]
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
assert.strictEqual(model.getSoloPgmForDevice(), '2-4');
assert.strictEqual(setlist.getSoloPgmForDevice(model.getCurrentDevice(), model), '2-4');

// Test undefined solo-pgm validation warning
const invalidSoloModel = new Setlists({
  devices: [
    { name: 'Valeton GP-150', id: 'gp', 'solo-pgm': '70', presets: [{ pgm: '63', label: 'A2 SOLO' }] }
  ],
  bands: []
});
const warnings = invalidSoloModel.validate();
const soloWarning = warnings.find(w => w.type === 'UNDEFINED_SOLO_PRESET');
assert.ok(soloWarning, 'Expected UNDEFINED_SOLO_PRESET warning');
assert.strictEqual(soloWarning.details.deviceId, 'gp');
assert.strictEqual(soloWarning.details.soloPresetPgm, '70');

const gpInvalid = invalidSoloModel.findDeviceById('gp');
assert.strictEqual(gpInvalid.getSoloPreset(invalidSoloModel), null);

console.log('active-midi-device test passed');
