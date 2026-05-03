/**
 * Setlist.js - Main logic for setlist management, MIDI communication, and UI interactions.
 */
(function () {
  let midiAccess = null;
  let midiOut = null;

  let presetsAndSetlists = null;
  let currentSetlistIndex = 0;
  const els = {
    inStatus: document.getElementById('inStatus'),
    outStatus: document.getElementById('outStatus'),
    tuner: document.getElementById('tuner'),
    fullScreenToggle: document.getElementById('fullScreenToggle'),
    soloToggle: document.getElementById('soloToggle'),
    setlist: document.getElementById('setlist'),
    notes: document.getElementById('notes'),

    setlistMenuBtn: document.getElementById('setlistMenuBtn'),
    setlistDropdown: document.getElementById('setlistDropdown'),
    setlistOptions: document.getElementById('setlistOptions'),

    modeMenuBtn: document.getElementById('modeMenuBtn'),
    modeDropdown: document.getElementById('modeDropdown'),
    modeOptions: document.getElementById('modeOptions'),

    presetBankSelectorBar: document.getElementById('presetBankSelectorBar'),
    footer: document.querySelector('.footer'),

    soloSelected: false,

    effectBtns: [
      document.getElementById('effectBtn1'),
      document.getElementById('effectBtn2'),
      document.getElementById('effectBtn3'),
      document.getElementById('effectBtn4')
    ]        
  };

  let currentSetlist = null;

  // TODO: add "SONGLIST" mode - list of all sorted songs (only setlist entries, not all presets)
  const MODE_SETLIST = 'SETLIST', MODE_PRESET = 'PRESET';
  const displayModes = [ MODE_SETLIST, MODE_PRESET ];
  let currentDisplayMode = MODE_SETLIST;

  let currentSong = null;

  let currentBank = null;
  let currentPreset = null;

  let displayModeBeforeSolo = null;
  let presetBankBeforeSolo = null;
  let presetIndexBeforeSolo = null;

  // -----------------------------------------------------------------------

  function populateModeMenu() {
    for (let i = 0; i < displayModes.length; i++) {
      //console.log("populateModeMenu - adding mode=", displayModes[i]);
      const btn = document.createElement('button');
      btn.textContent = displayModes[i];
      btn.addEventListener('click', () => { changeDisplayMode(displayModes[i]); });
      els.modeOptions.appendChild(btn);
    }

    els.modeMenuBtn.textContent = currentDisplayMode;

    els.modeMenuBtn.addEventListener('click', () => {
      const isOpen = els.modeDropdown.style.display !== 'none';
      els.modeDropdown.style.display = isOpen ? 'none' : 'block';
    });
  }

  function changeDisplayMode(modeName) {
    //console.log("changeDisplayMode - modeName=", modeName);

    currentDisplayMode = modeName;
    els.modeMenuBtn.textContent = currentDisplayMode;
    closeModeMenu();
    renderSetlistOrPresets();

    if(modeName === MODE_SETLIST) {
      switchToPreset(currentSong.preset);
    }

    /*
    if(currentDisplayMode === MODE_PRESET && !soloChange) {
      displayModeBeforeSolo = null;
      const presets = getPresetsForBank(currentPresetBank);
      if (presets.length > 0) {
        const preset = presets[currentPresetIndex];
        const midiPatch = calculateMidiPatch(preset.pgm);
        const prog0 = Math.max(0, Math.min(127, midiPatch - 1));
        sendPC(1, prog0, 0);
      }
    }
    */
  }

  function closeModeMenu() {
    els.modeDropdown.style.display = 'none';
  }

  // -----------------------------------------------------------------------

  async function loadSetlist() {
    try {
      presetsAndSetlists = await PresetsAndSetlists.loadFromFile('Setlist.json');
      populateSetlistMenu();
      selectSetlist(0);
      switchToSong(currentSetlist.firstSong());

      //changeDisplayMode(MODE_PRESET);

    } catch (error) {
      console.error('Failed to load setlist:', error);
      els.setlist.innerHTML = `<p style="color: #ff6b6b;">Error loading setlist!<br><br>${error.message}</p>`;
    }
  }

  function populateSetlistMenu() {
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
    els.setlistMenuBtn.addEventListener('click', () => {
      const isOpen = els.setlistDropdown.style.display !== 'none';
      els.setlistDropdown.style.display = isOpen ? 'none' : 'block';
    });
  }

  function selectSetlist(index) {
    currentSetlist = presetsAndSetlists.getSetlist(index);
    currentSong = currentSetlist.firstSong();
    currentDisplayMode = MODE_SETLIST;

    renderSetlistOrPresets();

    closeSetlistMenu();

    els.setlistMenuBtn.textContent = currentSetlist.name.substring(0, 10);
    els.setlistMenuBtn.title = currentSetlist.name;
  }

  function closeSetlistMenu() {
    els.setlistDropdown.style.display = 'none';
  }

  // -----------------------------------------------------------------------

  function renderBankSelector(selectedBank) {
    currentBank = selectedBank;
    
    els.presetBankSelectorBar.innerHTML = '';    
    const banks = presetsAndSetlists.getUniqueBanks();
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '4px';
    btnContainer.style.flexWrap = 'wrap';
    
    //console.log("renderBankSelector - currentPreset.bank=", currentPreset.bank, ", selectedBank=", selectedBank );

    banks.forEach(bank => {
      const btn = document.createElement('button');
      btn.textContent = `B-${bank}`;
      btn.className = 'presetBankSelector';
      if (bank === selectedBank) {
        btn.setAttribute('aria-pressed', 'true');
        btn.style.outline = '5px solid #cf352e';
      }
      btn.addEventListener('click', () => {
        renderBankSelector(bank);
        renderPresets(bank);
      });
      btnContainer.appendChild(btn);
    });
    
    els.presetBankSelectorBar.appendChild(btnContainer);
  }

  function renderPresets(selectedBank) {
    //console.log("renderPresets - currentPreset.bank=", currentPreset.bank, ", currentPreset.indexInBank=", currentPreset.indexInBank);

    els.setlist.innerHTML = '';
    const presets = presetsAndSetlists.getPresetsForBank(selectedBank || currentBank);
    
    presets.forEach((preset, idx) => {
      const row = document.createElement('div');
      row.className = 'preset';
      if(currentPreset===preset) {
        row.classList.add('active');
      }
      row.dataset.idx = String(preset.index);
      const info = document.createElement('div');
      info.innerHTML = `<div class='pgm'>${preset.pgm}</div><div class="presetTitle">${preset.label}</div>`;
      row.appendChild(info);

      row.addEventListener('click', () => {
        switchToPreset(preset);
      });

      els.setlist.appendChild(row);
    });
  }

  function highlightPreset(rowDiv) {
    //console.info("highlightPreset - rowDiv=", rowDiv);
    const nodes = els.setlist.querySelectorAll('.preset');
    nodes.forEach(n => n.classList.remove('active'));
    rowDiv.classList.add('active');
    ensureVisible(rowDiv);
  }

  /** depending on displayMode render either PRESETs or SETLIST */
  function renderSetlistOrPresets() {
    //console.log("render - currentDisplayMode=", currentDisplayMode);
    if (currentDisplayMode === MODE_PRESET) {
      els.presetBankSelectorBar.style.display = 'block';
      renderBankSelector(currentPreset ? currentPreset.bank : 1);
      renderPresets(currentPreset ? currentPreset.bank : 1);
    } else {
      els.presetBankSelectorBar.style.display = 'none';
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
    //setFooterVisible(level === 'ok');
    setFooterVisible(true);
  }
  function setInStatus(text, level = 'warn') {
    const cls = level === 'ok' ? 'ok' : (level === 'warn' ? 'warn' : 'err');
    setBadge(els.inStatus, text, cls);
  }

  // map MIDI-Input PC messages to patches
  function pcToPreset(pc) {
    switch (pc) {
      case 0: // BANK-1 => previous song OR previous direct preset
        if(currentDisplayMode===MODE_PRESET) {
          presetPrevious();
        } else {
          songPrevious();
        }
        return;
      case 1: // BANK-1 => next song OR next direct preset
        if(currentDisplayMode===MODE_PRESET) {
          presetNext();
        } else {
          songNext();
        }
        return;
      case 2: // BANK-1 => MODE => toggle direct mode on/off
        toggleDisplayMode();
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
        if (statusType === 0xC0) pcToPreset(data1);
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
    currentPresetIndex = prog;
  }

  function switchToSong(song) {
    //console.info("switchToSong - song=", song);
    currentSong = song;
    highlightSong();
    setNotes(song);
    switchToPreset(song.preset);
  }

  function switchToPreset(preset) {
    currentPreset = preset;

    //console.info("switchToPreset - preset=", preset);
    if(currentDisplayMode === MODE_PRESET) {
      //console.info("switchToPreset - highlighting preset in UI - preset.index=", preset.index);
      highlightPreset(els.setlist.querySelector(`.preset[data-idx="${preset.index}"]`));
    }

    const useBank = true, oneBased = true;
    const ch = (preset.channel >= 1 && preset.channel <= 16) ? preset.channel : 1;
    const midiPatch = preset.calculatePatchIndex();
    const prog0 = oneBased ? Math.max(0, Math.min(127, midiPatch - 1)) : Math.max(0, Math.min(127, midiPatch));
    //console.info(`switchToPreset(useBank=${useBank}, oneBased=${oneBased}, ch=${ch}, prog0=${prog0})`);
    let t = 0;
    if (useBank) {
      if (Number.isInteger(preset.bankMSB)) sendCC(ch, 0, preset.bankMSB & 0x7F, t);
      if (Number.isInteger(preset.bankLSB)) sendCC(ch, 32, preset.bankLSB & 0x7F, t + 4);
      t += 8;
    }
    if (midiOut) {
      sendPC(ch, prog0, t);
    } else {
      setOutStatus('No OUT selected', 'err');
    }    
    updateEffectButtons(preset);
  }

  function setNotes(song) {
    const text = song && song.notes ? song.notes : '';
    els.notes.innerHTML = text;
  }

  function updateEffectButtons(preset) {
    for(let i=0; i<els.effectBtns.length; i++) {
      const btn = els.effectBtns[i];
      btn.setAttribute('aria-pressed', 'false');
      btn.style.outline = 'none';
      if(preset && preset.effectBtns && preset.effectBtns[i]) {
        btn.innerHTML = `<span class="effect-tag">${preset.effectBtns[i]}</span>`;
      } else {
        btn.innerHTML = `E ${i+1}`;
      }
    }
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
      const pauseLabel = s.hasNoPause && s.hasNoPause() ? '<span class="pause-tag"><b>~</b>pause</span>' : '';
      const capoLabel = s.hasCapo && s.hasCapo() ? `<span class="capo-tag">${s.capo}</span>` : '';
      const info = document.createElement('div');
      info.innerHTML = `<div class='pgm'>${s.getPreset()}</div><div class="songTitle">${s.title}${keyLabel}${pauseLabel}${capoLabel}</div>`;
      row.appendChild(info);
      els.setlist.appendChild(row);
    });
    highlightSong();
  }

  function highlightSong() {
    const nodes = els.setlist.querySelectorAll('.song');
    nodes.forEach(n => n.classList.remove('active'));
    const active = els.setlist.querySelector(`.song[data-idx="${currentSong.index}"]`);
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

  function highlightBtn(btn) {
    btn.style.outline = '5px solid #cf352e';
  }

  function presetPrevious() {
    if( currentPreset && currentPreset.prev ) switchToPreset(currentPreset.prev);
  }

  function presetNext() {
    if( currentPreset && currentPreset.next ) switchToPreset(currentPreset.next);
  }

  function songPrevious() {
    if( currentSong && currentSong.prev ) switchToSong(currentSong.prev);
  }

  function songNext() {
    if( currentSong && currentSong.next ) switchToSong(currentSong.next);
  }

  els.soloToggle.addEventListener('click', () => {
    toggleSolo();
  });    

  function toggleDisplayMode() {
    const newMode = currentDisplayMode === MODE_SETLIST ? MODE_PRESET : MODE_SETLIST;
    changeDisplayMode(newMode);
  }

  function toggleSolo() {
    console.log("Toggling SOLO, currentPreset=", currentPreset.pgm, "soloPreset=", currentSetlist ? currentSetlist.soloPreset : null, ", displayModeBeforeSolo=", displayModeBeforeSolo);
    let isSoloSelected = displayModeBeforeSolo!==null;
    if(isSoloSelected) {
      // switch back to either SONG or PRESET that was selected when SOLO was pressed
      if(displayModeBeforeSolo !== currentDisplayMode) {
        toggleDisplayMode();
      }
      if(currentDisplayMode === MODE_PRESET) {
        switchToPreset(currentPreset);
      } else {
        switchToSong(currentSong);
      }
      displayModeBeforeSolo = null;
    } else {
      // switch to PRESET MODE and SOLO-BANK + SOLO-PRESET
      displayModeBeforeSolo = currentDisplayMode;

      if(currentDisplayMode === MODE_PRESET) { 
        presetBankBeforeSolo = currentPresetBank;
        presetIndexBeforeSolo = currentPresetIndex;
      }
      if(currentDisplayMode !== MODE_PRESET) { 
        toggleDisplayMode(true);
      }
      switchToPreset(currentSetlist ? currentSetlist.soloPreset : null);
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

  // Prevent accidental zoom on double tap
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 350) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  els.setlist.addEventListener('click', (ev) => {
    //console.log("Setlist clicked - currentDisplayMode=", currentDisplayMode);

    const row = ev.target.closest('.song');
    if (!row) return;
    const idx = Number(row.getAttribute('data-idx'));
    
    if (currentDisplayMode === MODE_SETLIST) {
      switchToSong(currentSetlist.getSong(idx), idx);
    } else {
      // TODO presets already have their own click listeners,
      // replace the global handler with individual ones per song as well
    }
  });

  populateModeMenu();

  loadSetlist();

  // close menus when clicking outside
  document.addEventListener('click', (ev) => {
    if (!els.modeMenuBtn.contains(ev.target) && !els.modeDropdown.contains(ev.target)) {
      closeModeMenu();
    }

    if (!els.setlistMenuBtn.contains(ev.target) && !els.setlistDropdown.contains(ev.target)) {
      closeSetlistMenu();
    }
  });

  // Android back button shouldn't exit fullscreen mid-show accidentally
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('performance')) {
      // keep performance mode but allow escape to close fullscreen
      if (document.fullscreenElement) e.stopPropagation();
    }
  });

  // Keyboard navigation for presets (only in preset mode)
  document.addEventListener('keydown', (e) => {
    if (currentDisplayMode === MODE_PRESET && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
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
        if (globalIdx === currentPresetIndex) {
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
            currentPresetIndex = i;
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

  // --------------------------------------------------------------------------

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

  document.getElementById('zoomIn').addEventListener('click', () => {
    const currSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.fontSize = `${Math.min(32, currSize + 4)}px`;
  });

  document.getElementById('zoomOut').addEventListener('click', () => {
    const currSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.fontSize = `${Math.max(8, currSize - 4)}px`;
  });

  // Performance mode button (also tries fullscreen)
  els.fullScreenToggle.addEventListener('click', async () => {
    const on = document.body.classList.toggle('performance');
    els.fullScreenToggle.setAttribute('aria-pressed', on);
    els.fullScreenToggle.textContent = on ? '⇙' : '⇗';
    try {
      if (on && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!on && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch { }
  });

  // --------------------------------------------------------------------------

  enableMIDI();  

})();
