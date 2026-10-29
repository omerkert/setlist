const assert = require('assert');
const { Setlists, Device, Song } = require('./SetlistModels');

// Test 1: User's exact example: device/solo-pgm = [40, 41] and song/solo = 2 => solo pgm is 41 while it's 40 for all other cases
const modelData = {
  devices: [
    {
      name: 'Test Device',
      id: 'td',
      'solo-pgm': [40, 41],
      presets: [
        { pgm: '40', label: 'Preset 40 (Default Solo)' },
        { pgm: '41', label: 'Preset 41 (Second Solo)' }
      ]
    },
    {
      name: 'Single Solo Device',
      id: 'sd',
      'solo-pgm': [40],
      presets: [
        { pgm: '40', label: 'Preset 40 (Only Solo)' }
      ]
    }
  ],
  bands: [
    {
      name: 'Test Band',
      songs: [
        { title: 'Master Song 1', pgm: '1' },
        { title: 'Master Song With Solo 2', pgm: '2', solo: 2 }
      ],
      setlists: [
        {
          name: 'Main Setlist',
          songs: [
            { title: 'Song With Solo 2', td: '40', solo: 2 },
            { title: 'Song With Solo 1', td: '40', solo: 1 },
            { title: 'Song Without Solo', td: '40' },
            { title: 'Song With Out Of Range Solo', td: '40', solo: 3 },
            { title: 'Song With Zero Solo', td: '40', solo: 0 },
            { title: 'Song With Negative Solo', td: '40', solo: -1 },
            { title: 'Song With String Solo', td: '40', solo: '2' },
            { title: 'Song Inheriting Solo From Band', title: 'Master Song With Solo 2', td: '40' }
          ]
        }
      ]
    }
  ]
};

const model = new Setlists(modelData);
const tdDevice = model.findDeviceById('td');
const sdDevice = model.findDeviceById('sd');
const setlist = model.getSetlist(0);

// Verify device properties
assert.strictEqual(tdDevice.soloPresetPgm, '40');
assert.deepStrictEqual(tdDevice.soloPresetPgms, ['40', '41']);

// Verify songs
const songSolo2 = setlist.getSong(0);
const songSolo1 = setlist.getSong(1);
const songNoSolo = setlist.getSong(2);
const songSoloOutOfRange = setlist.getSong(3);
const songSoloZero = setlist.getSong(4);
const songSoloNegative = setlist.getSong(5);
const songSoloString = setlist.getSong(6);
const songInherited = setlist.getSong(7);

assert.strictEqual(songSolo2.solo, 2);
assert.strictEqual(songSolo2.hasSolo(), true);
assert.strictEqual(songNoSolo.solo, null);
assert.strictEqual(songNoSolo.hasSolo(), false);
assert.strictEqual(songInherited.solo, 2);

// Case: song/solo = 2 => solo pgm is 41
assert.strictEqual(tdDevice.getSoloPgm(songSolo2), '41');
assert.strictEqual(tdDevice.getSoloPreset(model, songSolo2).pgm, '41');
assert.strictEqual(setlist.getSoloPresetForDevice(tdDevice, model, songSolo2).pgm, '41');
assert.strictEqual(songSolo2.getSoloPreset(model, tdDevice).pgm, '41');

// Case: song with string solo "2" => solo pgm is 41
assert.strictEqual(tdDevice.getSoloPgm(songSoloString), '41');
assert.strictEqual(tdDevice.getSoloPreset(model, songSoloString).pgm, '41');

// Case: song inheriting solo: 2 from band master songs => solo pgm is 41
assert.strictEqual(tdDevice.getSoloPgm(songInherited), '41');
assert.strictEqual(tdDevice.getSoloPreset(model, songInherited).pgm, '41');

// Case: direct number passed: 2 => 41
assert.strictEqual(tdDevice.getSoloPgm(2), '41');
assert.strictEqual(tdDevice.getSoloPreset(model, 2).pgm, '41');

// All other cases => 40
// 1. song with solo = 1
assert.strictEqual(tdDevice.getSoloPgm(songSolo1), '40');
assert.strictEqual(tdDevice.getSoloPreset(model, songSolo1).pgm, '40');

// 2. song without solo attribute
assert.strictEqual(tdDevice.getSoloPgm(songNoSolo), '40');
assert.strictEqual(tdDevice.getSoloPreset(model, songNoSolo).pgm, '40');
assert.strictEqual(setlist.getSoloPresetForDevice(tdDevice, model, songNoSolo).pgm, '40');

// 3. out of range solo index (3)
assert.strictEqual(tdDevice.getSoloPgm(songSoloOutOfRange), '40');
assert.strictEqual(tdDevice.getSoloPreset(model, songSoloOutOfRange).pgm, '40');

// 4. zero solo index
assert.strictEqual(tdDevice.getSoloPgm(songSoloZero), '40');

// 5. negative solo index
assert.strictEqual(tdDevice.getSoloPgm(songSoloNegative), '40');

// 6. null or undefined song
assert.strictEqual(tdDevice.getSoloPgm(null), '40');
assert.strictEqual(tdDevice.getSoloPgm(undefined), '40');
assert.strictEqual(tdDevice.getSoloPgm(), '40');
assert.strictEqual(tdDevice.getSoloPreset(model).pgm, '40');
assert.strictEqual(setlist.getSoloPresetForDevice(tdDevice, model).pgm, '40');

// 7. single-entry solo-pgm array: even if song has solo = 2, does NOT have multiple entries => uses 40
assert.strictEqual(sdDevice.getSoloPgm(songSolo2), '40');
assert.strictEqual(sdDevice.getSoloPreset(model, songSolo2).pgm, '40');

// 8. Setlist resolution by song index
assert.strictEqual(setlist.getSoloPresetForDevice('td', model, 0).pgm, '41'); // song 0 has solo = 2
assert.strictEqual(setlist.getSoloPresetForDevice('td', model, 2).pgm, '40'); // song 2 has no solo
assert.strictEqual(setlist.getSoloPgmForDevice('td', model, 0), '41');
assert.strictEqual(setlist.getSoloPgmForDevice('td', model, 2), '40');
assert.strictEqual(model.getSoloPgmForDevice('td', songSolo2), '41');
assert.strictEqual(model.getSoloPgmForDevice('td', songNoSolo), '40');

// Test validation with array solo-pgm
const invalidModel = new Setlists({
  devices: [
    {
      name: 'Bad Device',
      id: 'bad',
      'solo-pgm': [40, 99],
      presets: [{ pgm: '40', label: 'Only 40' }]
    }
  ],
  bands: []
});
const warnings = invalidModel.validate();
const badSoloWarning = warnings.find(w => w.type === 'UNDEFINED_SOLO_PRESET');
assert.ok(badSoloWarning, 'Expected UNDEFINED_SOLO_PRESET warning');
assert.strictEqual(badSoloWarning.details.deviceId, 'bad');
assert.strictEqual(badSoloWarning.details.soloPresetPgm, '99');

console.log('All solo-pgm and song solo tests passed successfully!');
