/**
 * MidiCtrl.js - Dedicated class for MIDI communication and control.
 */
class MidiCtrl {
  constructor(onPC, setInStatus, setOutStatus) {
    this.midiAccess = null;
    this.midiOut = null;
    this.onPC = onPC; // callback for PC messages
    this.setInStatus = setInStatus;
    this.setOutStatus = setOutStatus;

    // we'll attach the first midi input device we find with one of these names (in order of preference):
    this.MIDI_INPUT_NAMES = [
      'USB-Midi',       // M-VAVE Chocolate via USB-cable
      'MidiPort',       // M-VAVE Chocolate via USB-dongle
      'loopMIDI Port'   // M-VAVE Chocolate via Bluetooth+loopMidi+midiBerry on Windows Tablet
    ];

  }

  async enableMIDI() {
    if (!('requestMIDIAccess' in navigator)) {
      this.setOutStatus('MIDI UNSUPPORTED', 'err');
      alert('This browser does not support Web MIDI. Use Chrome or Edge on desktop/tablet.');
      return;
    }
    try {
      this.setOutStatus('Requesting MIDI', 'warn');
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = () => this.onStateChange();
      this.onStateChange(); // initial setup
    } catch (e) {
      console.error(e);
      this.setOutStatus('Permission denied', 'err');
    }
  }

  onStateChange() {
    this.attachInputListeners();
    this.refreshMidiOut();
  }

  attachInputListeners() {
    if (!this.midiAccess) return;

    const allInputs = Array.from(this.midiAccess.inputs.values());
    //allInputs.forEach((input) => { console.log(`MIDI-input => ${input.name}`); });

    let inputs = allInputs.filter((midiInput) => this.MIDI_INPUT_NAMES.some((name) => midiInput.name.includes(name)));

    if (inputs.length === 0) {
      this.setInStatus('NO MIDI-IN', 'warn');
      return;
    }

    inputs.forEach((input) => {
      //console.log(`MIDI-input ATTACH => ${input.name}`);
      this.setInStatus(`${input.name}`, input.state === 'connected' ? 'ok' : 'warn');
      input.onmidimessage = (event) => this.handleMidiMessage(event);
    });
  }

  handleMidiMessage(event) {
    //console.log('MIDI message received:', event.data);
    const data = event.data;
    if (!data || data.length < 1) return;
    const status = data[0];
    const data1 = data[1] || 0;
    const statusType = status & 0xF0;
    if (statusType === 0xC0) this.onPC(data1);
  }

  refreshMidiOut() {
    //console.log('Refreshing MIDI output devices...');
    const outputs = this.midiAccess ? Array.from(this.midiAccess.outputs.values()) : [];
    this.midiOut = outputs.find((o) => o.name && o.name.includes('Profiler')) || null;
    if(this.midiOut) {
      this.setOutStatus(this.midiOut.name, 'ok');
    } else {
      this.setOutStatus('NO OUT', 'err');
    }
  }

  hasOutput() {
    return !!this.midiOut;
  }

  sendCC(ch1, cc, val, whenMs) {
    if (!this.midiOut) return;
    const ch0 = (ch1 - 1) & 0x0F; const status = 0xB0 | ch0;
    this.midiOut.send([status, cc & 0x7F, val & 0x7F], whenMs ? performance.now() + whenMs : undefined);
  }

  sendPC(ch1, prog, whenMs) {
    if (!this.midiOut) return; const ch0 = (ch1 - 1) & 0x0F; const status = 0xC0 | ch0;
    this.midiOut.send([status, prog & 0x7F], whenMs ? performance.now() + whenMs : undefined);
  }
}