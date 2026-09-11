const { Setlists } = require('./SetlistModels.js');

const data = {
  devices: [
    {
      name: 'Test Device',
      id: 'test-device',
      'bank-size': 5,
      presets: [
        { pgm: '1', label: 'A' },
        { pgm: '2', label: 'B' },
        { pgm: '3', label: 'C' },
        { pgm: '4', label: 'D' },
        { pgm: '5', label: 'E' },
        { pgm: '6', label: 'F' },
        { pgm: '7', label: 'G' },
        { pgm: '8', label: 'H' },
        { pgm: '9', label: 'I' },
        { pgm: '10', label: 'J' }
      ]
    }
  ],
  bands: []
};

const model = new Setlists(data);
const device = model.findDeviceById('test-device');
const banks = device.getUniqueBanks();
const firstBank = device.getPresetsForBank(1).map((preset) => preset.pgm);
const secondBank = device.getPresetsForBank(2).map((preset) => preset.pgm);
const firstPreset = device.getPreset(0);
const tenthPreset = device.getPreset(9);

if (JSON.stringify(banks) !== JSON.stringify([1, 2])) {
  throw new Error(`Expected banks [1,2], got ${JSON.stringify(banks)}`);
}

if (JSON.stringify(firstBank) !== JSON.stringify(['1', '2', '3', '4', '5'])) {
  throw new Error(`Expected first bank to contain 1..5, got ${JSON.stringify(firstBank)}`);
}

if (JSON.stringify(secondBank) !== JSON.stringify(['6', '7', '8', '9', '10'])) {
  throw new Error(`Expected second bank to contain 6..10, got ${JSON.stringify(secondBank)}`);
}

if (firstPreset.prev !== tenthPreset || firstPreset.next !== device.getPreset(1)) {
  throw new Error('Expected first preset navigation to roll over to the last preset');
}

if (device.getPreset(4).next !== device.getPreset(5) || device.getPreset(5).prev !== device.getPreset(4)) {
  throw new Error('Expected navigation to cross the bank boundary');
}

if (tenthPreset.prev !== device.getPreset(8) || tenthPreset.next !== firstPreset) {
  throw new Error('Expected navigation to cross the bank boundary and roll over');
}

console.log('bank grouping test passed');
