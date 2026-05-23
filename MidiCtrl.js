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
      this.attachInputListeners();
      this.refreshMidiOut();
    } catch (e) {
      console.error(e);
      this.setOutStatus('Permission denied', 'err');
    }
  }

  onStateChange() {
    this.refreshMidiOut();
    this.attachInputListeners();
  }

  attachInputListeners() {
    if (!this.midiAccess) return;
    //Array.from(this.midiAccess.inputs.values()).forEach((input) => { console.log(`MIDI-input => ${input.name}`); });
    const inputs = Array.from(this.midiAccess.inputs.values().filter((midiInput) => this.MIDI_INPUT_NAMES.includes(midiInput.name)));
    if (inputs.length === 0) {
      this.setInStatus('NO MIDI-IN', 'warn');
      return;
    }

    inputs.forEach((input) => {
      console.log(`MIDI-input => ${input.name}`);
      this.setInStatus(`${input.name}`, input.state === 'connected' ? 'ok' : 'warn');
      // Web MIDI API: onmidimessage is the standard way
      input.onmidimessage = (event) => {
        const data = event.data;
        if (!data || data.length < 1) return;
        const status = data[0];
        const data1 = data[1] || 0;
        const statusType = status & 0xF0;
        if (statusType === 0xC0) this.onPC(data1);
      };
    });
  }

  refreshMidiOut() {
    const outputs = this.midiAccess ? Array.from(this.midiAccess.outputs.values()) : [];
    this.midiOut = outputs.find((o) => o.name && o.name.includes('Profiler')) || outputs[0] || null;
    this.setOutStatus(this.midiOut ? this.midiOut.name : 'NO MIDI-OUT', this.midiOut ? 'ok' : 'warn');
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
}</content>
<parameter name="filePath">c:\Users\olafm\G-Drive\musical\setlist\MidiCtrl.js