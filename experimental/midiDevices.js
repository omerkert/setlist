// midiBluetoothDevices.js
(function(){
  const MIDI_BLE_UUID = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';

  const $ = id => document.getElementById(id);
  const logEl = $('log');
  function log(...args){
    const t = new Date().toLocaleTimeString();
    logEl.textContent = `${t} › ${args.join(' ')}\n` + logEl.textContent;
  }

  function renderList(container, items){
    if(!items || items.length===0){
      container.textContent = '(none)';
      return;
    }
    const ul = document.createElement('ul');
    items.forEach(it=>{
      const li = document.createElement('li');
      li.textContent = `${it.name || '(unnamed)'} — id:${it.id || 'n/a'} — ${it.manufacturer? it.manufacturer + ' — ' : ''}${it.type || ''} — ${it.state || ''}`;
      ul.appendChild(li);
    });
    container.textContent = '';
    container.appendChild(ul);
  }

  function updateMIDIDevices(midiAccess){
    const inputs = [];
    const outputs = [];
    for(const input of midiAccess.inputs.values()){
      inputs.push({id: input.id, name: input.name, manufacturer: input.manufacturer, state: input.state, type: 'input'});
    }
    for(const output of midiAccess.outputs.values()){
      outputs.push({id: output.id, name: output.name, manufacturer: output.manufacturer, state: output.state, type: 'output'});
    }
    renderList($('midiInputs'), inputs);
    renderList($('midiOutputs'), outputs);
    populateOutputSelect(outputs);
    log('Updated MIDI devices — inputs:', inputs.length, 'outputs:', outputs.length);
  }

  function populateOutputSelect(outputs){
    const sel = $('outputSelect');
    if(!sel) return;
    // remember selection
    const prev = sel.value;
    sel.innerHTML = '<option value="">(choose Web MIDI output)</option>';
    outputs.forEach(o=>{
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = `${o.name || '(unnamed)'} — ${o.id}`;
      sel.appendChild(opt);
    });
    // restore if present
    if(prev){
      sel.value = prev;
    }
  }

  async function requestMIDI(){
    if(!navigator.requestMIDIAccess){
      log('Web MIDI API not supported in this browser.');
      return;
    }
    try{
      const access = await navigator.requestMIDIAccess({ sysex: false });
      window.midiAccess = access;
      updateMIDIDevices(access);
      access.onstatechange = () => updateMIDIDevices(access);
      log('Web MIDI access granted.');
    }catch(err){
      log('MIDI access error:', err.message || err);
    }
  }

  function getSelectedOutput(){
    const sel = $('outputSelect');
    if(!sel || !sel.value) return null;
    if(!window.midiAccess) return null;
    return window.midiAccess.outputs.get(sel.value) || null;
  }

  function sendProgramChange(){
    const out = getSelectedOutput();
    if(!out){ log('No MIDI output selected.'); return; }
    const chan = Math.max(1, Math.min(16, parseInt($('midiChannel').value || 1)))-1; // 0-15
    let program = parseInt($('pcNumber').value || 0);
    program = Math.max(0, Math.min(127, program));
    const status = 0xC0 | (chan & 0x0f);
    out.send([status, program]);
    log(`Sent Program Change to ${out.name || out.id} chan=${chan+1} program=${program}`);
  }

  function sendControlChange(){
    const out = getSelectedOutput();
    if(!out){ log('No MIDI output selected.'); return; }
    const chan = Math.max(1, Math.min(16, parseInt($('midiChannel').value || 1)))-1;
    let controller = parseInt($('ccNumber').value || 0);
    let value = parseInt($('ccValue').value || 0);
    controller = Math.max(0, Math.min(127, controller));
    value = Math.max(0, Math.min(127, value));
    const status = 0xB0 | (chan & 0x0f);
    out.send([status, controller, value]);
    log(`Sent CC to ${out.name || out.id} chan=${chan+1} cc=${controller} value=${value}`);
  }

  async function scanBluetooth(){
    if(!navigator.bluetooth){
      log('Web Bluetooth API not available in this browser.');
      return;
    }
    try{
      log('Requesting Bluetooth MIDI device... (browser chooser will appear)');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [MIDI_BLE_UUID] }],
        optionalServices: [MIDI_BLE_UUID]
      });

      showBTDevice(device);
      device.addEventListener('gattserverdisconnected', ()=>{
        log('Bluetooth device disconnected:', device.name || device.id);
        showBTDevice(device);
      });

      if(device.gatt && !device.gatt.connected){
        log('Connecting to GATT server...');
        const server = await device.gatt.connect();
        log('Connected to', device.name || device.id);
        try{
          const service = await server.getPrimaryService(MIDI_BLE_UUID);
          const chars = await service.getCharacteristics();
          log('Found MIDI service with', chars.length, 'characteristics.');
        }catch(e){
          log('Could not get MIDI service details:', e.message || e);
        }
      }
      showBTDevice(device);
    }catch(err){
      log('Bluetooth request cancelled or failed:', err.message || err);
    }
  }

  function showBTDevice(device){
    if(!device){
      $('btDevices').textContent = '(none)';
      return;
    }
    const info = [];
    info.push({id: device.id, name: device.name, type: 'device', manufacturer: ''});
    renderList($('btDevices'), info);
    log('Selected Bluetooth device:', device.name || device.id, 'connected=', !!(device.gatt && device.gatt.connected));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    $('btnRequestMidi').addEventListener('click', requestMIDI);
    $('btnScanBluetooth').addEventListener('click', scanBluetooth);
    const sendPCBtn = $('sendPC');
    if(sendPCBtn) sendPCBtn.addEventListener('click', sendProgramChange);
    const sendCCBtn = $('sendCC');
    if(sendCCBtn) sendCCBtn.addEventListener('click', sendControlChange);
    // populate outputs if midi access already available
    if(window.midiAccess) updateMIDIDevices(window.midiAccess);
    // Auto-request MIDI access to populate list on load (user gesture might be required in some browsers)
    // Do not auto-call requestMIDI(); leave to user to click.
  });

})();
