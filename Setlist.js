(function () {
  let midiAccess = null;
  let midiOut = null;
  let currentIndex = 0;
  let presetsAndSetlists = null;
  let currentSetlistIndex = 0;
  const els = {
    tuner: document.getElementById('tuner'),
    perfToggle: document.getElementById('perfToggle'),
    modeToggle: document.getElementById('modeToggle'),
    outStatus: document.getElementById('outStatus'),
    inStatus: document.getElementById('inStatus'),
    setlist: document.getElementById('setlist'),
    notes: document.getElementById('notes'),
    setlistMenuBtn: document.getElementById('setlistMenuBtn'),
    setlistDropdown: document.getElementById('setlistDropdown'),
    setlistOptions: document.getElementById('setlistOptions'),
    presetBankSelector: document.getElementById('presetBankSelector'),
    footer: document.querySelector('.footer'),

    directBtns: [
			document.getElementById('directBtn1'),
			document.getElementById('directBtn2'),
			document.getElementById('directBtn3'),
			document.getElementById('directBtn4'),
			document.getElementById('directBtn5')
		],
    directMode: undefined,
    directSelectedIndex: 0,
    soloSelected: false,

    effectBtns: [
      document.getElementById('effectBtn1'),
      document.getElementById('effectBtn2'),
      document.getElementById('effectBtn3'),
      document.getElementById('effectBtn4')
    ]        
  };

  let currentSetlist = null;
  let displayMode = 'setlist'; // 'setlist' or 'preset'
  let currentPresetBank = 1;
  let currentPreset = 0;

  // Load setlist from external JSON file using SetlistModels
  async function loadSetlist() {
    try {
      presetsAndSetlists = await PresetsAndSetlists.loadFromFile('Setlist.json');
      populateSetlistMenu();
      // Load the first setlist (index 0)
      selectSetlist(0);
    } catch (error) {
      console.error('Failed to load setlist:', error);
      els.setlist.innerHTML = '<p style="color: #ff6b6b;">Error loading setlist!</p>';
    }
  }

  function populateSetlistMenu() {
    if (!presetsAndSetlists) return;
    els.setlistOptions.innerHTML = '';
    const count = presetsAndSetlists.getSetlistCount();
    for (let i = 0; i < count; i++) {
      const sl = presetsAndSetlists.getSetlist(i);
      const btn = document.createElement('button');
      btn.textContent = sl.name;
      btn.setAttribute('data-index', String(i));
      btn.addEventListener('click', () => { selectSetlist(i); });
      els.setlistOptions.appendChild(btn);
    }
  }

  function selectSetlist(index) {
    currentSetlistIndex = index;
    currentSetlist = presetsAndSetlists.getSetlist(index);
    if (!currentSetlist) return;
    currentIndex = 0;
    displayMode = 'setlist';
    els.modeToggle.setAttribute('aria-pressed', 'false');
    els.modeToggle.textContent = '⊞';
    applyDirectButtonLabels();
    render();
    closeSetlistMenu();
    updateMenuButtonText();
  }

  function updateMenuButtonText() {
    if (currentSetlist) {
      els.setlistMenuBtn.textContent = currentSetlist.name.substring(0, 10);
      els.setlistMenuBtn.title = currentSetlist.name;
    }
  }

  function toggleSetlistMenu() {
    const isOpen = els.setlistDropdown.style.display !== 'none';
    els.setlistDropdown.style.display = isOpen ? 'none' : 'block';
  }

  function closeSetlistMenu() {
    els.setlistDropdown.style.display = 'none';
  }

  function applyDirectButtonLabels() {
    const labels = currentSetlist ? currentSetlist.getDirectButtons() : ['CLEAN', 'UN-CLEAN', 'SOLO', 'CRUNCH', 'HI-GAIN'];
		labels.forEach((label, idx) => {
    	els.directBtns[idx].textContent = label;
		});
  }

  function getUniqueBanks() {
    if (!presetsAndSetlists) return [];
    const banks = new Set();
    for (let i = 0; i < presetsAndSetlists.getPresetCount(); i++) {
      const preset = presetsAndSetlists.getPreset(i);
      if (preset && preset.pgm) {
        const bank = parseInt(preset.pgm.split('-')[0], 10);
        banks.add(bank);
      }
    }
    return Array.from(banks).sort((a, b) => a - b);
  }

  function getPresetsForBank(bank) {
    if (!presetsAndSetlists) return [];
    const result = [];
    for (let i = 0; i < presetsAndSetlists.getPresetCount(); i++) {
      const preset = presetsAndSetlists.getPreset(i);
      if (preset && preset.pgm) {
        const presetBank = parseInt(preset.pgm.split('-')[0], 10);
        if (presetBank === bank) {
          result.push(preset);
        }
      }
    }
    return result;
  }

  function renderBankSelector() {
    els.presetBankSelector.innerHTML = '';
    const banks = getUniqueBanks();
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '4px';
    btnContainer.style.flexWrap = 'wrap';
    
    banks.forEach(bank => {
      const btn = document.createElement('button');
      btn.textContent = `B-${bank}`;
      btn.className = 'tb';
      if (bank === currentPresetBank) {
        btn.setAttribute('aria-pressed', 'true');
        btn.style.outline = '5px solid #cf352e';
      }
      btn.addEventListener('click', () => {
        currentPresetBank = bank;
        renderBankSelector();
        renderPresets();
      });
      btnContainer.appendChild(btn);
    });
    
    els.presetBankSelector.appendChild(btnContainer);
  }

  function renderPresets() {
    els.setlist.innerHTML = '';
    const presets = getPresetsForBank(currentPresetBank);
    
    presets.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'song';
      // Find global index of this preset
      let globalIdx = -1;
      for (let i = 0; i < presetsAndSetlists.getPresetCount(); i++) {
        if (presetsAndSetlists.getPreset(i) === p) {
          globalIdx = i;
          break;
        }
      }
      if (globalIdx === currentPreset) {
        row.classList.add('active');
      }
      row.dataset.idx = String(idx);
      const info = document.createElement('div');
      info.innerHTML = `<div class='preset'>${p.pgm}</div><div class="title">${p.label}</div>`;
      row.appendChild(info);
      els.setlist.appendChild(row);
    });
  }

  function render() {
    if (displayMode === 'preset') {
      els.presetBankSelector.style.display = 'block';
      renderBankSelector();
      renderPresets();
    } else {
      els.presetBankSelector.style.display = 'none';
      renderSongs();
    }
  }

  function setBadge(el, text, cls) {
    el.textContent = text;
    el.className = `pill ${cls}`;
  }
  function setFooterVisible(visible) {
    if (!els.footer) return;
    els.footer.style.display = visible ? 'block' : 'none';
  }

  function setOutStatus(text, level = 'warn') {
    const cls = level === 'ok' ? 'ok' : (level === 'warn' ? 'warn' : 'err');
    setBadge(els.outStatus, text, cls);
    setFooterVisible(level === 'ok');
  }
  function setInStatus(text, level = 'warn') {
    const cls = level === 'ok' ? 'ok' : (level === 'warn' ? 'warn' : 'err');
    setBadge(els.inStatus, text, cls);
  }

  // map MIDI-Input PC messages to patches
  function pcToPatch(pc) {
    switch (pc) {
      case 0: // BANK-1 => previous song OR previous direct preset
        if(els.directMode) {
          els.directSelectedIndex = (els.directSelectedIndex - 1  + els.directBtns.length - 1) % (els.directBtns.length - 1);
					if(els.directSelectedIndex === 2) els.directSelectedIndex = 1; // skip SOLO button in direct mode
          els.directBtns[els.directSelectedIndex].click();
        } else {
          patchPrevious();
        }
        return;
      case 1: // BANK-1 => next song OR next direct preset
        if(els.directMode) {
          els.directSelectedIndex = (els.directSelectedIndex + 1) % (els.directBtns.length);
					if(els.directSelectedIndex === 2) els.directSelectedIndex = 3; // skip SOLO button in direct mode
          els.directBtns[els.directSelectedIndex].click();
        } else {
          patchNext();
        }
        return;
      case 2: // BANK-1 => MODE => toggle direct mode on/off
        if(els.directMode) {
          toPatch(songs[currentIndex], currentIndex);
        } else {
          els.directBtns[els.directSelectedIndex].click();
        }
        return;
      case 3: // BANK-1 => SOLO => toggle solo patch on/off
        toggleSolo();
        return;

      case 4: // BANK-2 => Effect Button I
        toggleEffectButton(els.effectBtns[0], 75);
        return;
      case 5: // BANK-2 => Effect Button II
        toggleEffectButton(els.effectBtns[1], 76);
        return;
      case 6: // BANK-2 => Effect Button III
        toggleEffectButton(els.effectBtns[2], 77);
        return;
      case 7: // BANK-2 => Effect Button IIII
        toggleEffectButton(els.effectBtns[3], 78);
        return;
    }
  }

  // we only look for ONE specific midi input device
  const MIDI_INPUT_NAMES = [
    'loopMIDI Port',  // M-VAVE Chocolate via Bluetooth+loopMidi+midiBerry on Windows Tablet
    'MidiPort'        // M-VAVE Chocolate via USB-Dongle on Windows PC
  ];

  function attachInputListeners() {
    if (!midiAccess) return;
    //Array.from(midiAccess.inputs.values()).forEach((input) => { console.log(`MIDI-input => ${input.name}`); });
    const inputs = Array.from(midiAccess.inputs.values().filter((midiInput) => MIDI_INPUT_NAMES.includes(midiInput.name)));
    if (inputs.length === 0) {
      setInStatus('NO MIDI-IN', 'warn');
      return;
    }

    inputs.forEach((input) => {
      console.log(`MIDI-input => ${input.name}`);
      setInStatus(`${input.name}`, input.state === 'connected' ? 'ok' : 'warn');
      // Web MIDI API: onmidimessage is the standard way
      input.onmidimessage = (event) => {
        const data = event.data;
        if (!data || data.length < 1) return;
        const status = data[0];
        const data1 = data[1] || 0;
        const statusType = status & 0xF0;
        if (statusType === 0xC0) pcToPatch(data1);
      };
    });
  }

  function refreshMidiOut() {
    const outputs = midiAccess ? Array.from(midiAccess.outputs.values()) : [];
    midiOut = outputs.find((o) => o.name && o.name.includes('Profiler')) || outputs[0] || null;
    setOutStatus(midiOut ? midiOut.name : 'NO MIDI-OUT', midiOut ? 'ok' : 'warn');
  }

  function onStateChange() { 
    refreshMidiOut();
    attachInputListeners();
  }

  async function enableMIDI() {
    console.info
    if (!('requestMIDIAccess' in navigator)) {
      setOutStatus('MIDI UNSUPPORTED', 'err');
      alert('This browser does not support Web MIDI. Use Chrome or Edge on desktop/tablet.');
      return;
    }
    try {
      setOutStatus('Requesting MIDI', 'warn');
      midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      midiAccess.onstatechange = onStateChange;
      attachInputListeners();
      refreshMidiOut();
    } catch (e) {
      console.error(e);
      setOutStatus('Permission denied', 'err');
    }
  }

  function sendCC(ch1, cc, val, whenMs) {
    if (!midiOut) return; 
    const ch0 = (ch1 - 1) & 0x0F; const status = 0xB0 | ch0;
    midiOut.send([status, cc & 0x7F, val & 0x7F], whenMs ? performance.now() + whenMs : undefined);
  }
  function sendPC(ch1, prog, whenMs) {
    if (!midiOut) return; const ch0 = (ch1 - 1) & 0x0F; const status = 0xC0 | ch0;
    midiOut.send([status, prog & 0x7F], whenMs ? performance.now() + whenMs : undefined);
  }

  function calculateMidiPatch(presetValue) {
    const presetStr = String(presetValue);
    if (presetStr.includes('-')) {
      const parts = presetStr.split('-');
      const before = parseInt(parts[0], 10);
      const after = parseInt(parts[1], 10);
      return (before-1) * 5 + after;
    }
    return parseInt(presetStr, 10);
  }

  function toPatch(song, idx) {
    if (!midiOut) { setOutStatus('No OUT selected', 'err'); return; }
    const useBank = true;
    const oneBased = true;
    const ch = (song.channel >= 1 && song.channel <= 16) ? song.channel : 1;
    const preset = song instanceof Song ? song.getPreset() : song.preset;
    const midiPatch = calculateMidiPatch(preset);
    const prog0 = oneBased ? Math.max(0, Math.min(127, midiPatch - 1)) : Math.max(0, Math.min(127, midiPatch));
    console.info(`useBank=${useBank}, oneBased=${oneBased}, ch=${ch}, prog0=${prog0}`);
    let t = 0;
    if (useBank) {
      if (Number.isInteger(song.bankMSB)) sendCC(ch, 0, song.bankMSB & 0x7F, t);
      if (Number.isInteger(song.bankLSB)) sendCC(ch, 32, song.bankLSB & 0x7F, t + 4);
      t += 8;
    }
    sendPC(ch, prog0, t);
    currentIndex = typeof idx === 'number' ? idx : currentIndex;
    highlightCurrent();
    clearDirectButtons()
  }

  function setNotes(song) {
    const text = song && song.notes ? song.notes : '';
    els.notes.innerHTML = text;
  }

  function getSongsToRender() {
    if (!currentSetlist) return [];
    return currentSetlist.songs;
  }

  function renderSongs() {
    els.setlist.innerHTML = '';
    const songsToRender = getSongsToRender();
    songsToRender.forEach((s, idx) => {
      if (s.isBreak && s.isBreak()) els.setlist.appendChild(document.createElement('hr'));
      const row = document.createElement('div');
      const classes = ['song'];
      if (s.hasNoPause && s.hasNoPause()) classes.push('no-pause');
      if (s.hasCapo && s.hasCapo()) classes.push('capo');
      row.className = classes.join(' ');
      row.dataset.idx = String(currentSetlist.songs.indexOf(s));
      const keyLabel = s.key ? `<span class="key-tag">${s.key}</span>` : '';
      const pauseLabel = s.hasNoPause && s.hasNoPause() ? '<span class="pause-tag">↔ no pause</span>' : '';
      const capoLabel = s.hasCapo && s.hasCapo() ? `<span class="capo-tag">${s.capo}</span>` : '';
      const info = document.createElement('div');
      info.innerHTML = `<div class='preset'>${s.getPreset()}</div><div class="title">${s.title}${keyLabel}${pauseLabel}${capoLabel}</div>`;
      row.appendChild(info);
      els.setlist.appendChild(row);
    });
    highlightCurrent();
  }

  function highlightCurrent() {
    const nodes = els.setlist.querySelectorAll('.song');
    nodes.forEach(n => n.classList.remove('active'));
    const active = els.setlist.querySelector(`.song[data-idx="${currentIndex}"]`);
    if (active) active.classList.add('active');
    ensureVisible(active);
  }

  function ensureVisible(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vph = window.innerHeight;
    if (rect.top < 100 || rect.bottom > vph - 100) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function clearDirectButtons() {
    els.directBtns.forEach((b) => { 
      b.style.outline = 'none';
    });
    els.directMode = undefined;
    els.soloSelected = false;

    els.tuner.style.outline = 'none';
    els.tuner.setAttribute('aria-pressed', 'false');

    els.effectBtns.forEach((btn) => {
      btn.style.outline = 'none';
      btn.setAttribute('aria-pressed', 'false');
    });
  }

  function selectDirect(activeBtn) {
    clearDirectButtons()
    highlightBtn(activeBtn);
    els.directMode = activeBtn;
  }

  function highlightBtn(btn) {
    btn.style.outline = '5px solid #cf352e';
  }

  function patchPrevious() {
    if (!currentSetlist || currentSetlist.getSongCount() === 0 || currentIndex === 0) return;
    currentIndex = (currentIndex - 1 + currentSetlist.getSongCount()) % currentSetlist.getSongCount();
    toPatch(currentSetlist.getSong(currentIndex), currentIndex);
  }

  function patchNext() {
    if (!currentSetlist || currentSetlist.getSongCount() === 0 || currentIndex === currentSetlist.getSongCount() - 1) return;
    currentIndex = (currentIndex + 1) % currentSetlist.getSongCount();
    toPatch(currentSetlist.getSong(currentIndex), currentIndex);
  }

  document.getElementById('zoomIn').addEventListener('click', () => {
    const currSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.fontSize = `${Math.min(32, currSize + 4)}px`;
  });

  document.getElementById('zoomOut').addEventListener('click', () => {
    const currSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.fontSize = `${Math.max(8, currSize - 4)}px`;
  });

  els.tuner.addEventListener('click', () => {
    const on = els.tuner.getAttribute('aria-pressed') === 'true';
    if (on) {
      els.tuner.style.outline = 'none';
      els.tuner.setAttribute('aria-pressed', 'false');
      sendCC(1, 31, 0);
    } else {
      highlightBtn(els.tuner);
      els.tuner.setAttribute('aria-pressed', 'true');
      sendCC(1, 31, 127);
    }
  });

  function toggleDisplayMode() {
    displayMode = displayMode === 'setlist' ? 'preset' : 'setlist';
    els.modeToggle.setAttribute('aria-pressed', displayMode === 'preset');
    els.modeToggle.textContent = displayMode === 'preset' ? '≡' : '⊞';
    render();
  }

  els.modeToggle.addEventListener('click', toggleDisplayMode);


  // Performance mode button (also tries fullscreen)
  els.perfToggle.addEventListener('click', async () => {
    const on = document.body.classList.toggle('performance');
    els.perfToggle.setAttribute('aria-pressed', on);
    els.perfToggle.textContent = on ? '⇙' : '⇗';
    try {
      if (on && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!on && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch { }
  });

  function toggleSolo() {
    //console.info('Toggling SOLO patch, soloSelected=', els.soloSelected, ", directSelected=", els.directSelected);
    if(els.soloSelected) {
      els.directBtns[2].style.outline = 'none';
      if(els.directMode) {
        els.directMode.click();
      } else {
        toPatch(currentSetlist.getSong(currentIndex), currentIndex);
      }
      els.soloSelected = false;
    } else {
      els.directBtns.forEach((b) => { b.style.outline = 'none'; });
      highlightBtn(els.directBtns[2]);
      const directPcOffset = currentSetlist ? currentSetlist.getDirectPcOffset() : 0;
      sendPC(1, directPcOffset+2, 8);
      els.soloSelected = true;
    }
  }

  function toggleEffectButton(btn, ccNum) {
    console.log("toggleEffectButton - ", btn.getAttribute('aria-pressed'));
    if (btn.getAttribute('aria-pressed') === 'true') {
      console.log("Turning OFF effect for CC#", ccNum);
      btn.setAttribute('aria-pressed', 'false');
      btn.style.outline = 'none';
      sendCC(1, ccNum, 0);
    } else {
      console.log("Turning ON effect for CC#", ccNum);
      btn.setAttribute('aria-pressed', 'true');
      highlightBtn(btn);
      sendCC(1, ccNum, 1);
    }
  }

  els.effectBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => { toggleEffectButton(btn, 75+i); });
  });

  els.setlistMenuBtn.addEventListener('click', toggleSetlistMenu);

  // Close menu when clicking outside
  document.addEventListener('click', (ev) => {
    if (!els.setlistMenuBtn.contains(ev.target) && !els.setlistDropdown.contains(ev.target)) {
      closeSetlistMenu();
    }
  });

  els.directBtns[0].addEventListener('click', () => { const offset = currentSetlist ? currentSetlist.getDirectPcOffset() : 0; sendPC(1, offset+0, 8); selectDirect(els.directBtns[0]); });
  els.directBtns[1].addEventListener('click', () => { const offset = currentSetlist ? currentSetlist.getDirectPcOffset() : 0; sendPC(1, offset+1, 8); selectDirect(els.directBtns[1]); });

  els.directBtns[2].addEventListener('click', () => { toggleSolo(); });
	
  els.directBtns[3].addEventListener('click', () => { const offset = currentSetlist ? currentSetlist.getDirectPcOffset() : 0; sendPC(1, offset+3, 8); selectDirect(els.directBtns[3]); });
  els.directBtns[4].addEventListener('click', () => { const offset = currentSetlist ? currentSetlist.getDirectPcOffset() : 0; sendPC(1, offset+4, 8); selectDirect(els.directBtns[4]); });

  // Prevent accidental zoom on double tap
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 350) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  // Delegate clicks from setlist to a single handler (works for both setlist and preset modes)
  els.setlist.addEventListener('click', (ev) => {
    const row = ev.target.closest('.song');
    if (!row) return;
    const idx = Number(row.getAttribute('data-idx'));
    
    if (displayMode === 'preset') {
      const presets = getPresetsForBank(currentPresetBank);
      const preset = presets[idx];
      if (preset) {
        // Find global index of this preset
        for (let i = 0; i < presetsAndSetlists.getPresetCount(); i++) {
          if (presetsAndSetlists.getPreset(i) === preset) {
            currentPreset = i;
            break;
          }
        }
        const midiPatch = calculateMidiPatch(preset.pgm);
        const prog0 = Math.max(0, Math.min(127, midiPatch - 1));
        sendPC(1, prog0, 0);
        renderPresets();
      }
    } else {
      const s = currentSetlist ? currentSetlist.getSong(idx) : null;
      if (!s) return;
      setNotes(s);
      toPatch(s, idx);
    }
  });

  loadSetlist();

  // Android back button shouldn't exit fullscreen mid-show accidentally
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('performance')) {
      // keep performance mode but allow escape to close fullscreen
      if (document.fullscreenElement) e.stopPropagation();
    }
  });

  // Keyboard navigation for presets (only in preset mode)
  document.addEventListener('keydown', (e) => {
    if (displayMode === 'preset' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();
      const presets = getPresetsForBank(currentPresetBank);
      if (presets.length === 0) return;
      // Find current position in this bank
      let currentBankIdx = -1;
      for (let i = 0; i < presets.length; i++) {
        let globalIdx = -1;
        for (let j = 0; j < presetsAndSetlists.getPresetCount(); j++) {
          if (presetsAndSetlists.getPreset(j) === presets[i]) {
            globalIdx = j;
            break;
          }
        }
        if (globalIdx === currentPreset) {
          currentBankIdx = i;
          break;
        }
      }
      if (currentBankIdx === -1) {
        // If current preset not in this bank, start from 0 or end
        currentBankIdx = e.key === 'ArrowDown' ? -1 : presets.length;
      }
      let newBankIdx = currentBankIdx;
      if (e.key === 'ArrowUp' && currentBankIdx > 0) {
        newBankIdx = currentBankIdx - 1;
      } else if (e.key === 'ArrowDown' && currentBankIdx < presets.length - 1) {
        newBankIdx = currentBankIdx + 1;
      }
      if (newBankIdx !== currentBankIdx) {
        // Set currentPreset to global index of the new preset
        const newPreset = presets[newBankIdx];
        for (let i = 0; i < presetsAndSetlists.getPresetCount(); i++) {
          if (presetsAndSetlists.getPreset(i) === newPreset) {
            currentPreset = i;
            break;
          }
        }
        const midiPatch = calculateMidiPatch(newPreset.pgm);
        const prog0 = Math.max(0, Math.min(127, midiPatch - 1));
        sendPC(1, prog0, 0);
        renderPresets();
      }
    }
  });

  enableMIDI();

})();
