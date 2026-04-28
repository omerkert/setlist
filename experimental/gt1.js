class GT1 {
  constructor(midiOutput) {
    this.output = midiOutput;           // MIDIOutput object from Web MIDI API
    this.deviceId = 0x00;               // Usually 00 (default)
    this.modelId = [0x00, 0x00, 0x00, 0x00, 0x30]; // GT-1 Model ID
  }

  // Helper: Send raw SysEx
  sendSysex(data) {
    const sysex = [0xF0, 0x41, this.deviceId, ...this.modelId, ...data, 0xF7];
    this.output.send(sysex);
    console.log('GT-1 SysEx sent:', sysex.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
  }

  // Roland checksum (standard for Boss/Roland)
  calculateChecksum(address, data) {
    let sum = 0;
    [...address, ...data].forEach(byte => sum += byte);
    const checksum = (128 - (sum % 128)) & 0x7F;
    return checksum;
  }

  // Enter Editor Mode (very important!)
  enterEditorMode() {
    this.sendSysex([0x12, 0x7F, 0x00, 0x00, 0x01, 0x01, 0x7F]);
    console.log('GT-1 → Editor Mode enabled');
  }

  // Exit Editor Mode
  exitEditorMode() {
    this.sendSysex([0x12, 0x7F, 0x00, 0x00, 0x01, 0x00, 0x00]);
    console.log('GT-1 → Editor Mode disabled');
  }

  // Change to a patch
  // patchNum: 1–99
  // isUser: true = User patch (U01–U99), false = Preset (P01–P99)
  changePatch(patchNum, isUser = true) {
    if (patchNum < 1 || patchNum > 99) throw new Error('Patch number must be 1–99');

    let addr = isUser 
      ? [0x00, 0x01, 0x00, 0x00]           // Base for User patches
      : [0x00, 0x01, 0x00, 0x63];          // Base for Preset patches (P01 starts at 0x0063)

    // Calculate 14-bit offset
    const offset = patchNum - 1;
    const ms = (offset >> 7) & 0x7F;
    const ls = offset & 0x7F;

    const address = isUser 
      ? [0x00, 0x01, 0x00, 0x00]
      : [0x00, 0x01, 0x00, 0x63];

    address[2] = ms;
    address[3] = ls;

    const checksum = this.calculateChecksum(address, [0x00]); // data is dummy for DT1

    this.sendSysex([0x12, ...address, 0x00, checksum]); // Actually the full message uses the patch address directly

    console.log(`GT-1 → Changed to ${isUser ? 'U' : 'P'}${patchNum.toString().padStart(2, '0')}`);
  }

  // Quick helpers for common patches
  userPatch(num) { this.changePatch(num, true); }
  presetPatch(num) { this.changePatch(num, false); }

  // Example: Turn FX1 On/Off
  setFX1(on) {
    const value = on ? 0x01 : 0x00;
    const address = [0x60, 0x00, 0x01, 0x40];   // FX1 switch address
    const checksum = this.calculateChecksum(address, [value]);
    this.sendSysex([0x12, ...address, value, checksum]);
    console.log(`GT-1 → FX1 ${on ? 'ON' : 'OFF'}`);
  }

  // You can add more methods easily (FX2, Preamp Solo, Delay time, etc.)
}

export default GT1;

// ----

async function main() {
  const midiAccess = await navigator.requestMIDIAccess({ sysex: true });

  // Find GT-1 output
  let gt1Output = null;
  for (const output of midiAccess.outputs.values()) {
    if (output.name.includes('GT-1') || output.name.includes('BOSS')) {
      gt1Output = output;
      break;
    }
  }

  if (!gt1Output) {
    console.error('Boss GT-1 not found!');
    return;
  }

  const gt1 = new GT1(gt1Output);

  gt1.enterEditorMode();

  // Change patches
  gt1.userPatch(5);        // → U05
  // gt1.presetPatch(12);  // → P12

  // Toggle effects
  gt1.setFX1(true);

  // You can also send these from a DAW timeline using MIDI clips with SysEx events.
}

main();