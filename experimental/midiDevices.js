// midiDevices.js
(function () {
  'use strict';

  const MIDI_BLE_UUID = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
  const MAX_MONITOR_ROWS = 200;

  const $ = id => document.getElementById(id);
  const logEl = $('log');

  // ── Logging ────────────────────────────────────────────────
  function log(...args) {
    const t = new Date().toLocaleTimeString();
    logEl.textContent = `${t} › ${args.join(' ')}\n` + logEl.textContent;
  }

  // ── Device list rendering ───────────────────────────────────
  function renderList(container, items) {
    if (!items || items.length === 0) {
      container.textContent = '(none)';
      return;
    }
    const ul = document.createElement('ul');
    items.forEach(it => {
      const li = document.createElement('li');
      li.textContent =
        `${it.name || '(unnamed)'}  —  id: ${it.id || 'n/a'}` +
        `${it.manufacturer ? '  —  ' + it.manufacturer : ''}` +
        `  —  ${it.type || ''}  —  ${it.state || ''}`;
      ul.appendChild(li);
    });
    container.textContent = '';
    container.appendChild(ul);
  }

  // ── MIDI device update ──────────────────────────────────────
  function updateMIDIDevices(midiAccess) {
    const inputs  = [];
    const outputs = [];
    for (const inp of midiAccess.inputs.values())
      inputs.push({ id: inp.id, name: inp.name, manufacturer: inp.manufacturer, state: inp.state, type: 'input' });
    for (const out of midiAccess.outputs.values())
      outputs.push({ id: out.id, name: out.name, manufacturer: out.manufacturer, state: out.state, type: 'output' });

    renderList($('midiInputs'),  inputs);
    renderList($('midiOutputs'), outputs);
    populateOutputSelect(outputs);
    populateInputSelect(inputs);
    log('Updated MIDI devices — inputs:', inputs.length, 'outputs:', outputs.length);
  }

  // ── Output selector ─────────────────────────────────────────
  function populateOutputSelect(outputs) {
    const sel = $('outputSelect');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">(choose Web MIDI output)</option>';
    outputs.forEach(o => {
      const opt = document.createElement('option');
      opt.value       = o.id;
      opt.textContent = `${o.name || '(unnamed)'}  —  ${o.id}`;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
  }

  // ── Input selector + monitor listener ───────────────────────
  let activeInputId   = null;
  let activeInputPort = null;
  let monitorCount    = 0;

  function populateInputSelect(inputs) {
    const sel = $('inputSelect');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">(choose MIDI input)</option>';
    inputs.forEach(i => {
      const opt = document.createElement('option');
      opt.value       = i.id;
      opt.textContent = `${i.name || '(unnamed)'}  —  ${i.id}`;
      sel.appendChild(opt);
    });
    // restore previous selection and re-attach listener if device still present
    if (prev) {
      sel.value = prev;
      if (sel.value === prev) {
        attachInputListener(prev);
      } else {
        detachInputListener();
      }
    }
  }

  function attachInputListener(id) {
    if (!window.midiAccess) return;
    // detach previous
    if (activeInputPort) {
      activeInputPort.onmidimessage = null;
    }
    const port = window.midiAccess.inputs.get(id);
    if (!port) { detachInputListener(); return; }

    activeInputId   = id;
    activeInputPort = port;
    port.onmidimessage = handleMidiMessage;

    setMonitorStatus(true, `Listening: ${port.name || id}`);
    log('Now monitoring input:', port.name || id);
  }

  function detachInputListener() {
    if (activeInputPort) activeInputPort.onmidimessage = null;
    activeInputId   = null;
    activeInputPort = null;
    setMonitorStatus(false, 'Not listening');
  }

  $('inputSelect').addEventListener('change', e => {
    const id = e.target.value;
    if (id) attachInputListener(id);
    else    detachInputListener();
  });

  // ── Monitor status indicator ─────────────────────────────────
  function setMonitorStatus(active, text) {
    const dot  = $('statusDot');
    const span = $('statusText');
    dot.classList.toggle('active', active);
    span.textContent = text;
  }

  // ── MIDI message parsing ─────────────────────────────────────
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function noteName(n) {
    return NOTE_NAMES[n % 12] + Math.floor(n / 12 - 1);
  }

  function parseMidi(data) {
    const status  = data[0];
    const type4   = status >> 4;       // upper nibble
    const channel = (status & 0x0f) + 1; // 1-16

    let kind, badge, d1Label, d2Label;

    switch (type4) {
      case 0x9:
        if (data[2] > 0) {
          kind = 'Note On';  badge = 'note-on';
          d1Label = `${noteName(data[1])} (${data[1]})`;
          d2Label = `vel ${data[2]}`;
        } else {
          kind = 'Note Off'; badge = 'note-off';
          d1Label = `${noteName(data[1])} (${data[1]})`;
          d2Label = `vel 0`;
        }
        break;
      case 0x8:
        kind = 'Note Off'; badge = 'note-off';
        d1Label = `${noteName(data[1])} (${data[1]})`;
        d2Label = `vel ${data[2]}`;
        break;
      case 0xB:
        kind = 'CC';  badge = 'cc';
        d1Label = `cc ${data[1]}`;
        d2Label = `val ${data[2]}`;
        break;
      case 0xC:
        kind = 'Prog Chg'; badge = 'pc';
        d1Label = `prog ${data[1]}`;
        d2Label = '—';
        break;
      case 0xD:
        kind = 'Ch Press'; badge = 'other';
        d1Label = `press ${data[1]}`;
        d2Label = '—';
        break;
      case 0xE:
        kind = 'Pitch Bend'; badge = 'pb';
        // 14-bit value: LSB data[1], MSB data[2]
        const pb = ((data[2] << 7) | data[1]) - 8192;
        d1Label = `${pb}`;
        d2Label = '—';
        break;
      case 0xF:
        kind = 'SysEx/RT'; badge = 'sysex';
        d1Label = data[1] !== undefined ? `0x${data[1].toString(16).padStart(2,'0')}` : '—';
        d2Label = '—';
        break;
      default:
        kind = `0x${type4.toString(16)}`; badge = 'other';
        d1Label = data[1] !== undefined ? data[1] : '—';
        d2Label = data[2] !== undefined ? data[2] : '—';
    }

    const raw = Array.from(data).map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
    return { kind, badge, channel, d1Label, d2Label, raw };
  }

  // ── Monitor table ────────────────────────────────────────────
  function handleMidiMessage(event) {
    const data = event.data;
    if (!data || data.length === 0) return;

    monitorCount++;
    const { kind, badge, channel, d1Label, d2Label, raw } = parseMidi(data);
    const t = new Date().toLocaleTimeString('en-GB', { hour12: false }) +
              '.' + String(new Date().getMilliseconds()).padStart(3,'0');

    const tbody = $('monitorBody');

    // Remove placeholder row if present
    const placeholder = tbody.querySelector('td[colspan]');
    if (placeholder) placeholder.closest('tr').remove();

    // Create row
    const tr = document.createElement('tr');
    tr.classList.add('flash');
    tr.innerHTML =
      `<td class="val-dim">${monitorCount}</td>` +
      `<td class="val-dim">${t}</td>` +
      `<td><span class="badge badge-${badge}">${kind}</span></td>` +
      `<td>${channel}</td>` +
      `<td>${d1Label}</td>` +
      `<td>${d2Label}</td>` +
      `<td class="val-dim">${raw}</td>`;

    // Prepend (newest first)
    tbody.insertBefore(tr, tbody.firstChild);

    // Remove flash class after animation
    setTimeout(() => tr.classList.remove('flash'), 250);

    // Trim old rows
    while (tbody.rows.length > MAX_MONITOR_ROWS) {
      tbody.deleteRow(tbody.rows.length - 1);
    }
  }

  $('clearMonitor').addEventListener('click', () => {
    monitorCount = 0;
    $('monitorBody').innerHTML =
      '<tr><td colspan="7" style="color:var(--text-dim);padding:10px 8px;font-family:sans-serif;">Monitor cleared. Select a MIDI input to start monitoring.</td></tr>';
  });

  // ── MIDI access ──────────────────────────────────────────────
  async function requestMIDI() {
    if (!navigator.requestMIDIAccess) {
      log('Web MIDI API not supported in this browser.');
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: true });
      window.midiAccess = access;
      updateMIDIDevices(access);
      access.onstatechange = () => {
        updateMIDIDevices(access);
        // re-attach if active port disconnected/reconnected
        if (activeInputId) attachInputListener(activeInputId);
      };
      log('Web MIDI access granted.');
    } catch (err) {
      log('MIDI access error:', err.message || err);
    }
  }

  // ── Output helpers ───────────────────────────────────────────
  function getSelectedOutput() {
    const sel = $('outputSelect');
    if (!sel || !sel.value || !window.midiAccess) return null;
    return window.midiAccess.outputs.get(sel.value) || null;
  }

  function sendProgramChange() {
    const out = getSelectedOutput();
    if (!out) { log('No MIDI output selected.'); return; }
    const chan    = Math.max(1, Math.min(16, parseInt($('midiChannel').value || 1))) - 1;
    const program = Math.max(0, Math.min(127, parseInt($('pcNumber').value || 0)));
    out.send([0xC0 | (chan & 0x0f), program]);
    log(`Sent PC → ${out.name || out.id}  ch=${chan+1}  prog=${program}`);
  }

  function sendControlChange() {
    const out = getSelectedOutput();
    if (!out) { log('No MIDI output selected.'); return; }
    const chan       = Math.max(1, Math.min(16, parseInt($('midiChannel').value || 1))) - 1;
    const controller = Math.max(0, Math.min(127, parseInt($('ccNumber').value || 0)));
    const value      = Math.max(0, Math.min(127, parseInt($('ccValue').value  || 0)));
    out.send([0xB0 | (chan & 0x0f), controller, value]);
    log(`Sent CC → ${out.name || out.id}  ch=${chan+1}  cc=${controller}  val=${value}`);
  }

  // ── Bluetooth ────────────────────────────────────────────────
  async function scanBluetooth() {
    if (!navigator.bluetooth) {
      log('Web Bluetooth API not available in this browser.');
      return;
    }
    try {
      log('Requesting Bluetooth MIDI device... (browser chooser will appear)');
      const device = await navigator.bluetooth.requestDevice({
        filters:          [{ services: [MIDI_BLE_UUID] }],
        optionalServices: [MIDI_BLE_UUID]
      });
      showBTDevice(device);
      device.addEventListener('gattserverdisconnected', () => {
        log('Bluetooth device disconnected:', device.name || device.id);
        showBTDevice(device);
      });
      if (device.gatt && !device.gatt.connected) {
        log('Connecting to GATT server...');
        const server = await device.gatt.connect();
        log('Connected to', device.name || device.id);
        try {
          const service = await server.getPrimaryService(MIDI_BLE_UUID);
          const chars   = await service.getCharacteristics();
          log('Found MIDI service with', chars.length, 'characteristics.');
        } catch (e) {
          log('Could not get MIDI service details:', e.message || e);
        }
      }
      showBTDevice(device);
    } catch (err) {
      log('Bluetooth request cancelled or failed:', err.message || err);
    }
  }

  function showBTDevice(device) {
    if (!device) { $('btDevices').textContent = '(none)'; return; }
    renderList($('btDevices'), [{
      id: device.id, name: device.name, type: 'device', manufacturer: '',
      state: device.gatt && device.gatt.connected ? 'connected' : 'disconnected'
    }]);
    log('Bluetooth device:', device.name || device.id,
        '| connected=', !!(device.gatt && device.gatt.connected));
  }

  // ── Init ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('btnRequestMidi').addEventListener('click', requestMIDI);
    $('btnScanBluetooth').addEventListener('click', scanBluetooth);
    $('sendPC').addEventListener('click', sendProgramChange);
    $('sendCC').addEventListener('click', sendControlChange);
    if (window.midiAccess) updateMIDIDevices(window.midiAccess);
  });

})();
