/**
 * Setlist.js - Main logic for setlist management, MIDI communication, and UI interactions.
 */
(function () {
  let currentPresetIndex = null;

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
    setlistGrid: document.getElementById('setlistGrid'),

    setlistMenuBtn: document.getElementById('setlistMenuBtn'),
    setlistDropdown: document.getElementById('setlistDropdown'),
    setlistOptions: document.getElementById('setlistOptions'),

    modeMenuBtn: document.getElementById('modeMenuBtn'),
    modeDropdown: document.getElementById('modeDropdown'),
    modeOptions: document.getElementById('modeOptions'),

    presetBankSelectorBar: document.getElementById('presetBankSelectorBar'),
    footer: document.querySelector('.footer'),
    footerLeftToggle: document.getElementById('footerLeftToggle'),
    footerRightToggle: document.getElementById('footerRightToggle'),
    effectButtonsBar: document.getElementById('effectButtonsBar'),

    soloSelected: false
  };

  let currentSetlist = null;

  // TODO: add "SONGLIST" mode - list of all sorted songs (only setlist entries, not all presets)
  const MODE_SETLIST = 'SETLIST', MODE_SONGS = 'SONGS', MODE_BANKS = 'BANKS', MODE_CARDS = 'CARDS';
  const displayModes = [ MODE_SETLIST, MODE_SONGS, MODE_BANKS, MODE_CARDS ];
  let currentDisplayMode = MODE_SETLIST;

  let currentSong = null;

  let currentBank = null;
  let currentPreset = null;
  let currentPresetBank = 1;

  let displayModeBeforeSolo = null;
  let presetBeforeSolo = null;
  let activeEffectGroupIndex = 0;

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
    currentDisplayMode = modeName;
    els.modeMenuBtn.textContent = currentDisplayMode;
    closeModeMenu();
    renderSetlistOrPresets();

    if (modeName === MODE_SETLIST) {
      const preset = getPresetForSong(currentSong);
      if (preset) {
        switchToPreset(preset);
      }
    }

    /*
    if(currentDisplayMode === MODE_BANK && !soloChange) {
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

  // -----------------------------------------------------------------------

  async function loadSetlist() {
    try {
      presetsAndSetlists = await PresetsAndSetlists.loadFromFile('Setlist.json');
      
      // Validate setlist data and log any issues
      presetsAndSetlists.validateAndLog();
      
      populateSetlistMenu();
      selectSetlist(0);
      switchToSong(currentSetlist.firstSong());
      if (midiCtrl) {
        midiCtrl.refreshMidiOut();
      }

      //changeDisplayMode(MODE_BANK);

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
    currentPresetBank = selectedBank || currentPresetBank || 1;
    
    els.presetBankSelectorBar.innerHTML = '';    
    const banks = presetsAndSetlists.getUniqueBanksForCurrentDevice();
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
    const device = presetsAndSetlists.getCurrentDevice();
    const presets = device ? device.getPresetsForBank(selectedBank || currentBank) : [];
    
    presets.forEach((preset) => {
      const row = document.createElement('div');
      row.className = 'preset';
      if (currentPreset === preset) {
        row.classList.add('active');
      }
      row.dataset.deviceId = device && device.id ? device.id : '';
      row.dataset.presetKey = `${preset.pgm}:${preset.label}`;
      const info = document.createElement('div');
      info.innerHTML = `<div class='pgm'>${preset.pgm}</div><div class="presetTitle">${preset.label}</div>`;
      row.appendChild(info);

      row.addEventListener('click', () => {
        switchToPreset(preset);
      });

      els.setlist.appendChild(row);
    });
  }

  function renderCards() {
    els.setlist.innerHTML = '';
    const presets = presetsAndSetlists.getPresetsForCurrentDevice() || [];
    presets.forEach((preset) => {
      const row = document.createElement('div');
      row.className = 'preset card-view';
      if (currentPreset === preset) {
        row.classList.add('active');
      }
      row.dataset.deviceId = presetsAndSetlists.getCurrentDevice() && presetsAndSetlists.getCurrentDevice().id ? presetsAndSetlists.getCurrentDevice().id : '';
      row.dataset.presetKey = `${preset.pgm}:${preset.label}`;
      const info = document.createElement('div');
      info.className = 'cardHeader';
      info.innerHTML = `<div class="presetTitle">${preset.label}</div>`;
      const pgm = document.createElement('span');
      pgm.className = 'pgm';
      pgm.textContent = preset.pgm;
      row.appendChild(info);
      row.appendChild(pgm);

      row.addEventListener('click', () => {
        switchToPreset(preset);
      });

      els.setlist.appendChild(row);
    });
  }

  function highlightPreset(rowDiv) {
    if (!rowDiv) return;
    const nodes = els.setlist.querySelectorAll('.preset');
    nodes.forEach(n => n.classList.remove('active'));
    rowDiv.classList.add('active');
    ensureVisible(rowDiv);
  }

  function findPresetRowForCurrentDevice(preset) {
    if (!preset) return null;
    const activeDevice = presetsAndSetlists.getCurrentDevice();
    const activeDeviceId = activeDevice && activeDevice.id ? activeDevice.id : '';
    const presetKey = `${preset.pgm}:${preset.label}`;
    const rows = els.setlist.querySelectorAll('.preset');
    for (const row of rows) {
      if (row.dataset.deviceId === activeDeviceId && row.dataset.presetKey === presetKey) {
        return row;
      }
    }
    return null;
  }

  /** depending on displayMode render either BANKS, SONGS, CARDS or SETLIST */
  function renderSetlistOrPresets() {
    //console.log("render - currentDisplayMode=", currentDisplayMode);
    els.setlist.classList.remove('cardsMode', 'songsMode');
    els.setlistGrid.classList.remove('cardsMode', 'songsMode');

    if (currentDisplayMode === MODE_BANKS) {
      els.presetBankSelectorBar.style.display = 'block';
      els.notes.style.display = '';
      const bankToRender = currentPresetBank || (currentPreset ? currentPreset.bank : 1);
      renderBankSelector(bankToRender);
      renderPresets(bankToRender);
    } else if (currentDisplayMode === MODE_SONGS) {
      els.presetBankSelectorBar.style.display = 'none';
      els.setlist.classList.add('songsMode');
      els.setlistGrid.classList.add('songsMode');
      els.notes.style.display = 'none';
      renderBandSongs();
    } else if (currentDisplayMode === MODE_CARDS) {
      els.presetBankSelectorBar.style.display = 'none';
      els.setlist.classList.add('cardsMode');
      els.setlistGrid.classList.add('cardsMode');
      els.notes.style.display = 'none';
      renderCards();
    } else {
      els.presetBankSelectorBar.style.display = 'none';
      els.notes.style.display = '';
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
    updateEffectButtons(currentPreset);
  }
  function setInStatus(text, level = 'warn') {
    const cls = level === 'ok' ? 'ok' : (level === 'warn' ? 'warn' : 'err');
    setBadge(els.inStatus, text, cls);
  }

  function getDeviceEffectGroups(device) {
    if (!device) return [];
    if (Array.isArray(device.effects) && device.effects.length > 0) {
      return device.effects.map((group) => Array.isArray(group)
        ? group.map((cc) => Number(cc)).filter(Number.isFinite)
        : []);
    }

    const legacyGroups = [];
    const effectBtnsCc = Array.isArray(device.effectBtnsCc) ? device.effectBtnsCc : [];
    const modEffectsCc = Array.isArray(device.modEffectsCc) ? device.modEffectsCc : [];
    if (effectBtnsCc.length > 0) legacyGroups.push(effectBtnsCc);
    if (modEffectsCc.length > 0) legacyGroups.push(modEffectsCc);
    return legacyGroups;
  }

  function getPresetEffectGroups(preset) {
    if (!preset) return [];
    let rawGroups = [];
    if (Array.isArray(preset.effects) && preset.effects.length > 0) {
      rawGroups = preset.effects;
    } else {
      if (Array.isArray(preset.effectBtns)) rawGroups.push(preset.effectBtns);
      if (Array.isArray(preset.fixEffects)) rawGroups.push(preset.fixEffects);
      if (Array.isArray(preset.modEffects)) rawGroups.push(preset.modEffects);
    }
    return rawGroups.filter((group) => {
      if (!Array.isArray(group)) return false;
      const entries = normalizeEffectEntries(group);
      return entries.some((entry) => !entry.isDisabled);
    });
  }

  function getEffectGroupCcNum(groupIndex, index) {
    const device = presetsAndSetlists && presetsAndSetlists.getCurrentDevice ? presetsAndSetlists.getCurrentDevice() : null;
    const effectGroups = getDeviceEffectGroups(device);
    const ccValues = Array.isArray(effectGroups[groupIndex]) ? effectGroups[groupIndex] : [];
    const ccValue = Number(ccValues[index]);
    return Number.isInteger(ccValue) ? ccValue : (groupIndex === 0 ? 75 + index : 17 + index);
  }

  // map MIDI-Input PC messages to patches
  function pcToPreset(pc) {
    switch (pc) {
      case 0: // BANK-1 => previous song OR previous direct preset
        if(currentDisplayMode===MODE_BANKS) {
          presetPrevious();
        } else {
          songPrevious();
        }
        return;
      case 1: // BANK-1 => next song OR next direct preset
        if(currentDisplayMode===MODE_BANKS) {
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

      case 4: // BANK-2 => Effect Button 1
        toggleEffectButtonIndex(0);
        return;
      case 5: // BANK-2 => Effect Button 2
        toggleEffectButtonIndex(1);
        return;
      case 6: // BANK-2 => Effect Button 3
        toggleEffectButtonIndex(2);
        return;
      case 7: // BANK-2 => Effect Button 4
        toggleEffectButtonIndex(3);
        return;
    }
  }

  function sendCC(ch1, cc, val, whenMs) {
    midiCtrl.sendCC(ch1, cc, val, whenMs);
  }
  function sendPC(ch1, prog, whenMs) {
    midiCtrl.sendPC(ch1, prog, whenMs);
  }

  function getPresetForSong(song) {
    if (!song) return null;
    const device = presetsAndSetlists.getCurrentDevice();
    return song.getPresetForDevice(presetsAndSetlists, device);
  }

  function refreshActiveMidiOutputDevice(outputs) {
    if (!presetsAndSetlists) return null;

    const activeDevice = presetsAndSetlists.updateActiveMidiOutputDevice(outputs);
    if (!activeDevice) {
      return null;
    }

    const matchedOutput = outputs.find((output) => output && output.name && activeDevice.matchesMidiOutputName(output.name)) || null;
    if (currentSong) {
      switchToSong(currentSong);
    }
    if (currentDisplayMode === MODE_SETLIST) {
      renderSongs();
    } else if (currentDisplayMode === MODE_BANKS) {
      const bankToRender = currentPresetBank || (currentPreset ? currentPreset.bank : 1);
      renderBankSelector(bankToRender);
      renderPresets(bankToRender);
    } else if (currentDisplayMode === MODE_SONGS) {
      renderBandSongs();
    } else if (currentDisplayMode === MODE_CARDS) {
      renderCards();
    }
    return matchedOutput;
  }

  function switchToSong(song) {
    currentSong = song;
    highlightSong();
    setNotes(song);
    const preset = getPresetForSong(song);
    if (preset) {
      switchToPreset(preset);
    } else {
      currentPreset = null;
      updateEffectButtons(null);
    }
  }

  function switchToPreset(preset) {
    currentPreset = preset;
    activeEffectGroupIndex = 0;

    if (preset && Number.isInteger(preset.bank)) {
      currentPresetBank = preset.bank;
    }

    if (currentDisplayMode === MODE_BANKS) {
      currentBank = currentPresetBank;
      renderBankSelector(currentBank);
      renderPresets(currentBank);
      const nextRow = findPresetRowForCurrentDevice(preset);
      highlightPreset(nextRow);
    } else if (currentDisplayMode === MODE_CARDS) {
      const nextRow = findPresetRowForCurrentDevice(preset);
      if (nextRow) {
        nextRow.classList.add('card-view');
      }
      highlightPreset(nextRow);
    }

    const useBank = true, oneBased = true;
    const ch = (preset.channel >= 1 && preset.channel <= 16) ? preset.channel : 1;
    const midiPatch = preset.calculatePatchIndex();
    const prog0 = oneBased ? Math.max(0, Math.min(127, midiPatch - 1)) : Math.max(0, Math.min(127, midiPatch));
    currentPresetIndex = preset.index;
    //console.info(`switchToPreset(useBank=${useBank}, oneBased=${oneBased}, ch=${ch}, prog0=${prog0})`);
    let t = 0;
    if (useBank) {
      if (Number.isInteger(preset.bankMSB)) sendCC(ch, 0, preset.bankMSB & 0x7F, t);
      if (Number.isInteger(preset.bankLSB)) sendCC(ch, 32, preset.bankLSB & 0x7F, t + 4);
      t += 8;
    }
    if (midiCtrl && midiCtrl.hasOutput()) {
      sendPC(ch, prog0, t);
    }
    updateEffectButtons(preset);
  }

  function setNotes(song) {
    const text = song && song.notes ? song.notes : '';
    els.notes.innerHTML = text;
  }

  function normalizeEffectEntries(groupConfig, labelPrefix = 'E') {
    if (!Array.isArray(groupConfig)) {
      return [];
    }

    return groupConfig.map((entry, idx) => {
      if (typeof entry === 'string') {
        const trimmedLabel = entry ? entry.trim() : '';
        return {
          label: trimmedLabel || '...',
          state: 0,
          isDisabled: !trimmedLabel
        };
      }

      if (entry && typeof entry === 'object') {
        const entries = Object.entries(entry);
        if (entries.length === 0) {
          return {
            label: '...',
            state: 0,
            isDisabled: true
          };
        }

        const [label, value] = entries[0];
        const trimmedLabel = typeof label === 'string' ? label.trim() : '';
        return {
          label: trimmedLabel || '...',
          state: Number(value) === 1 ? 1 : 0,
          isDisabled: !trimmedLabel
        };
      }

      return null;
    }).filter(Boolean);
  }

  function renderEffectGroup(preset, groupIndex) {
    els.effectButtonsBar.innerHTML = '';
    const presetEffectGroups = getPresetEffectGroups(preset);
    const groupConfig = presetEffectGroups[groupIndex];
    const entries = normalizeEffectEntries(groupConfig, 'E');

    if (entries.length === 0) {
      return;
    }

    entries.forEach((config, itemIndex) => {
      const btn = document.createElement('button');
      btn.className = 'footerBtn';
      btn.type = 'button';
      const hasLabel = config && typeof config.label === 'string' && config.label.trim().length > 0;
      const label = hasLabel ? config.label : '...';

      // Apply label-specific color class
      const labelColorMap = {
        'PRE-BST': 'fx-pre-bst',
        'PST-BST': 'fx-pst-bst',
        'CHR':     'fx-chr',
        'DLY':     'fx-dly',
        'CMP':     'fx-cmp',
        'TRM':     'fx-trm',
        'PHA':     'fx-pha',
        'REV':     'fx-rev',
        'BST':     'fx-bst',
      };
      if (hasLabel) {
        btn.classList.add(labelColorMap[label] || 'fx-default');
      }
      const isOn = Number(config && config.state) === 1;
      const isDisabled = Boolean(config && config.isDisabled) || !hasLabel;

      btn.innerHTML = `<span class="effect-tag">${label}</span>`;
      btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      if (isOn) btn.classList.add('is-on');
      btn.disabled = isDisabled;
      btn.setAttribute('aria-disabled', String(isDisabled));
      btn.setAttribute('aria-label', label);

      if (!isDisabled) {
        btn.addEventListener('click', () => {
          const ccNum = getEffectGroupCcNum(groupIndex, itemIndex);
          const nextState = btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true';
          btn.setAttribute('aria-pressed', nextState);
          const turningOn = nextState === 'true';
          btn.classList.toggle('is-on', turningOn);
          if (turningOn) {
            btn.classList.remove('just-toggled');
            void btn.offsetWidth; // reflow to restart animation
            btn.classList.add('just-toggled');
          }
          sendCC(1, ccNum, turningOn ? 1 : 0);
        });
      }
      els.effectButtonsBar.appendChild(btn);
    });
  }

  function updateEffectButtons(preset) {
    const presetEffectGroups = getPresetEffectGroups(preset);
    const numGroups = presetEffectGroups.length;

    if (!preset || numGroups === 0) {
      setFooterVisible(false);
      els.effectButtonsBar.innerHTML = '';
      els.footerLeftToggle.style.display = 'none';
      els.footerRightToggle.style.display = 'none';
      return;
    }

    setFooterVisible(true);
    if (activeEffectGroupIndex >= numGroups || activeEffectGroupIndex < 0) {
      activeEffectGroupIndex = 0;
    }

    if (numGroups > 1) {
      els.footerLeftToggle.style.display = 'inline-block';
      els.footerRightToggle.style.display = 'inline-block';
    } else {
      els.footerLeftToggle.style.display = 'none';
      els.footerRightToggle.style.display = 'none';
    }

    renderEffectGroup(preset, activeEffectGroupIndex);
  }

  function getSongsToRender() {
    if (!currentSetlist) return [];
    return currentSetlist.songs;
  }

  function getBandSongsToRender() {
    if (!currentSetlist) return [];
    const band = currentSetlist.band;
    const bandSongs = band && Array.isArray(band.bandSongs) ? band.bandSongs : [];
    const unique = new Map();
    for (const song of bandSongs) {
      const title = String(song && song.title ? song.title : '').trim();
      if (!title || title.toLowerCase() === 'break') continue;
      const key = title.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, song);
      }
    }
    return [...unique.values()].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  }

  function getSongPatchLabel(song) {
    if (!song) return '';
    const currentDevice = presetsAndSetlists && presetsAndSetlists.getCurrentDevice ? presetsAndSetlists.getCurrentDevice() : null;
    if (!currentDevice || !currentDevice.id) {
      return song.pgm ? String(song.pgm) : (song.kp ? String(song.kp) : '');
    }

    const deviceId = currentDevice.id;
    const deviceValue = song[deviceId] !== undefined ? song[deviceId] : (song[deviceId.toUpperCase()] !== undefined ? song[deviceId.toUpperCase()] : null);
    if (deviceValue !== null && deviceValue !== undefined && deviceValue !== '') {
      return String(deviceValue);
    }

    if (song.getPreset && typeof song.getPreset === 'function') {
      const value = song.getPreset(currentDevice);
      if (value) return String(value);
    }

    return song.pgm ? String(song.pgm) : (song.kp ? String(song.kp) : '');
  }

  function renderBandSongs() {
    els.setlist.innerHTML = '';
    const songsToRender = getBandSongsToRender();
    songsToRender.forEach((song) => {
      const title = String(song && song.title ? song.title : '').trim();
      if (!title || title.toLowerCase() === 'break') return;
      const row = document.createElement('div');
      const classes = ['song', 'song-card-view'];
      const matchingSong = currentSetlist && currentSetlist.findSongByTitle(title);
      if (currentSong && matchingSong && currentSong.title === matchingSong.title) {
        classes.push('active');
      }
      row.className = classes.join(' ');
      row.dataset.title = title;
      row.dataset.idx = matchingSong && Number.isInteger(matchingSong.index) ? String(matchingSong.index) : '';

      const keyLabel = song.key ? `<span class="key-tag">${song.key}</span>` : '';
      const capoLabel = song.capo ? `<span class="capo-tag">${song.capo}</span>` : '';
      const patchLabel = getSongPatchLabel(song);
      const info = document.createElement('div');
      info.innerHTML = `
        <div class="songCardHeader">
          <div class="songTitleRow">
            <div class="songTitle">${title}</div>
            <div class="songCardMeta">${keyLabel}${capoLabel}</div>
          </div>
          <span class='pgm'>${patchLabel}</span>
        </div>
      `;
      row.appendChild(info);
      row.addEventListener('click', () => {
        if (matchingSong) {
          switchToSong(matchingSong);
        } else {
          currentSong = { title: song.title, notes: song.notes || '', prev: null, next: null };
          setNotes(currentSong);
          highlightSongForTitle(song.title);
        }
      });
      els.setlist.appendChild(row);
    });
  }

  function renderSongs() {
    els.setlist.innerHTML = '';
    const songsToRender = getSongsToRender();
    songsToRender.forEach((s, idx) => {
      if (s.isBreak && s.isBreak()) {
        els.setlist.appendChild(document.createElement('hr'));
        return;
      }
      const row = document.createElement('div');
      const classes = ['song'];
      if (s.hasNoPause && s.hasNoPause()) classes.push('no-pause');
      if (s.hasCapo && s.hasCapo()) classes.push('capo');
      row.className = classes.join(' ');
      row.dataset.idx = String(currentSetlist.songs.indexOf(s));
      const keyLabel = s.key ? `<span class="key-tag">${s.key}</span>` : '';
      const pauseLabel = s.hasNoPause && s.hasNoPause() ? '<span class="pause-tag"><b>~</b>pause</span>' : '';
      const capoLabel = s.hasCapo && s.hasCapo() ? `<span class="capo-tag">${s.capo}</span>` : '';
      const currentDevice = presetsAndSetlists.getCurrentDevice();
      const patchLabel = s.getPreset(currentDevice) || '';
      const info = document.createElement('div');
      info.innerHTML = `<div class='pgm'>${patchLabel}</div><div class="songTitle">${s.title}${keyLabel}${pauseLabel}${capoLabel}</div>`;
      row.appendChild(info);
      els.setlist.appendChild(row);
    });
    highlightSong();
  }

  function highlightSong() {
    const nodes = els.setlist.querySelectorAll('.song');
    nodes.forEach(n => n.classList.remove('active'));
    const active = currentDisplayMode === MODE_SONGS && currentSong
      ? els.setlist.querySelector(`.song[data-title="${CSS.escape(String(currentSong.title))}"]`)
      : els.setlist.querySelector(`.song[data-idx="${currentSong.index}"]`);
    if (active) active.classList.add('active');
    ensureVisible(active);
  }

  function highlightSongForTitle(title) {
    const nodes = els.setlist.querySelectorAll('.song');
    nodes.forEach(n => n.classList.remove('active'));
    const active = els.setlist.querySelector(`.song[data-title="${CSS.escape(String(title))}"]`);
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
    btn.style.boxShadow = 'inset 0 0 0 3px #cf352e';
    btn.style.borderColor = '#cf352e';
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
    const order = [ MODE_SETLIST, MODE_BANKS, MODE_SONGS, MODE_CARDS ];
    const currentIndex = order.indexOf(currentDisplayMode);
    const nextIndex = (currentIndex + 1) % order.length;
    changeDisplayMode(order[nextIndex]);
  }

  function toggleSolo() {
    //console.log("Toggling SOLO, currentPreset=", currentPreset.pgm, "soloPreset=", currentSetlist ? currentSetlist.soloPreset : null, ", displayModeBeforeSolo=", displayModeBeforeSolo);
    let isSoloSelected = displayModeBeforeSolo!==null;
    if(isSoloSelected) {
      // switch back to the mode that was selected when SOLO was pressed
      changeDisplayMode(displayModeBeforeSolo);
      if(currentDisplayMode === MODE_BANKS) {
        switchToPreset(presetBeforeSolo);
      } else if(currentDisplayMode === MODE_CARDS || currentDisplayMode === MODE_SONGS) {
        switchToPreset(presetBeforeSolo);
      } else {
        switchToSong(currentSong);
      }
      displayModeBeforeSolo = null;
      presetBeforeSolo = null;

      els.soloToggle.classList.remove('active', 'just-toggled');
      els.soloToggle.setAttribute('aria-pressed', 'false');

    } else {
      // switch to PRESET MODE and SOLO-BANK + SOLO-PRESET
      displayModeBeforeSolo = currentDisplayMode;

      if(currentDisplayMode === MODE_BANKS || currentDisplayMode === MODE_CARDS) { 
        presetBeforeSolo = currentPreset;
      }
      const soloPreset = currentSetlist.getSoloPresetForDevice(presetsAndSetlists.getCurrentDevice(), presetsAndSetlists);
      if(currentDisplayMode !== MODE_BANKS) { 
        changeDisplayMode(MODE_BANKS);
      }
      switchToPreset(soloPreset || currentSetlist.soloPreset);
      els.soloToggle.classList.add('active');
      els.soloToggle.classList.remove('just-toggled');
      void els.soloToggle.offsetWidth; // reflow to restart animation
      els.soloToggle.classList.add('just-toggled');
      els.soloToggle.setAttribute('aria-pressed', 'true');
    }
  }

  function toggleEffectButtonIndex(index) {
    const children = els.effectButtonsBar.children;
    if (index >= 0 && index < children.length) {
      const btn = children[index];
      if (btn && !btn.disabled) {
        btn.click();
      }
    }
  }

  els.footerLeftToggle.addEventListener('click', () => {
    const presetEffectGroups = getPresetEffectGroups(currentPreset);
    if (presetEffectGroups.length <= 1) return;
    activeEffectGroupIndex = (activeEffectGroupIndex - 1 + presetEffectGroups.length) % presetEffectGroups.length;
    renderEffectGroup(currentPreset, activeEffectGroupIndex);
  });

  els.footerRightToggle.addEventListener('click', () => {
    const presetEffectGroups = getPresetEffectGroups(currentPreset);
    if (presetEffectGroups.length <= 1) return;
    activeEffectGroupIndex = (activeEffectGroupIndex + 1) % presetEffectGroups.length;
    renderEffectGroup(currentPreset, activeEffectGroupIndex);
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

  const midiCtrl = new MidiCtrl(pcToPreset, setInStatus, setOutStatus, refreshActiveMidiOutputDevice);

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
    if (currentDisplayMode === MODE_BANKS && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
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
    const activeDevice = presetsAndSetlists && presetsAndSetlists.getCurrentDevice ? presetsAndSetlists.getCurrentDevice() : null;
    const tunerCc = activeDevice && activeDevice.tunerCc ? parseInt(activeDevice.tunerCc, 10) : 31;

    console.log(`Tuner button clicked - activeDevice=${activeDevice ? activeDevice.name : 'none'}, tunerCc=${tunerCc}`);

    const on = els.tuner.getAttribute('aria-pressed') === 'true';
    if (on) {
      els.tuner.style.outline = '';
      els.tuner.style.boxShadow = '';
      els.tuner.style.borderColor = '';
      els.tuner.setAttribute('aria-pressed', 'false');
      sendCC(1, tunerCc, 0);
    } else {
      highlightBtn(els.tuner);
      els.tuner.setAttribute('aria-pressed', 'true');
      sendCC(1, tunerCc, 127);
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

  midiCtrl.enableMIDI();

})();
