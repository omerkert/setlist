/**
 * Single guitar/equipment d (e.g., "profiler", "Ampero", "Valeton GP-150")
 * Contains its own set of presets
 */
class Device {
  constructor(data = {}) {
    this.name = data.name || '';
    this.id = data.id || '';
    this.description = data.description || '';
    this.presets = (data.presets || []).map(preset => new Preset(preset));
    
    // Set index and navigation for presets within this device
    this.presets.forEach((preset, index) => {
      preset.index = index;
      // Consider bank navigation within the device
      const currentBank = preset.bank;
      preset.prev = index > 0 && preset.bank === this.presets[index - 1].bank 
        ? this.presets[index - 1] 
        : this.presets[index + 4] < this.presets.length ? this.presets[index + 4] : null;
      preset.next = index < this.presets.length - 1 && preset.bank === this.presets[index + 1].bank 
        ? this.presets[index + 1] 
        : index - 4 >= 0 ? this.presets[index - 4] : null;
    });
  }

  getPresetCount() {
    return this.presets.length;
  }

  getPreset(index) {
    if (index >= 0 && index < this.presets.length) {
      return this.presets[index];
    }
    return null;
  }

  findPresetByPgm(pgm) {
    return this.presets.find(preset => preset.pgm === pgm) || null;
  }

  getPresetsForBank(bank) {
    return this.presets.filter(preset => preset.pgm && preset.bank === bank);
  }

  getUniqueBanks() {
    const banks = new Set();
    this.presets.forEach(preset => {
      if (preset.pgm) {
        banks.add(preset.bank);
      }
    });
    return Array.from(banks).sort((a, b) => a - b);
  }
}

// ----------------------------------------------------------------------------

/**
 * preset or "patch" or "program"
 */
class Preset {
  constructor(data = {}) {
    this.pgm = data.pgm || '';
    this.bank = parseInt(this.pgm.split('-')[0] || 0);
    this.indexInBank = parseInt(this.pgm.split('-')[1]) || 0;

    this.label = data.label || '';

    this.effectBtns = data.effectBtns || [];

    this.channel = 1;
    this.bankMSB = data.bankMSB;
    this.bankLSB = data.bankLSB;
  }

  // e.g. 2-1 => (2-1)*5 + 1 = 6 or 1-1 => (1-1)*5 + 1 = 1
  calculatePatchIndex() {
    if (this.pgm.includes('-')) {
      const parts = this.pgm.split('-');
      const before = parseInt(parts[0], 10);
      const after = parseInt(parts[1], 10);
      return (before-1) * 5 + after;
    }
    return parseInt(this.pgm, 10);
  }
}

// ----------------------------------------------------------------------------

/**
 * Band (e.g., "UJ", "CN") with master song definitions and setlists
 */
class Band {
  constructor(data = {}) {
    this.name = data.name || '';
    
    // Master song definitions for this band (used as defaults for songs in setlists)
    this.bandSongs = (data.songs || []).map(song => ({
      title: song.title,
      pgm: song.pgm || null,
      // Device-specific shortcuts (stored but not used at Song level yet)
      KP: song.KP || null,
      AM: song.AM || null,
      GP: song.GP || null,
      key: song.key || '',
      capo: song.capo || '',
      notes: song.notes || '',
      break: song.break || 0,
      noPause: song['no-pause'] || song.noPause || 0,
      GT1: song.GT1 || ''
    }));
    
    // Setlists for this band (will be populated by PresetsAndSetlists)
    this.setlists = [];
  }
  
  /**
   * Find a song definition in this band's master songs list
   */
  findBandSong(title) {
    const lowerTitle = title.toLowerCase();
    return this.bandSongs.find(song => song.title.toLowerCase() === lowerTitle) || null;
  }
  
  getSetlistCount() {
    return this.setlists.length;
  }
}

// ----------------------------------------------------------------------------

/**
 * single song within a setlist
 */
class Song {
  constructor(data = {}, presetsAndSetlist, band = null) {
    // First, get any defaults from the band's master songs list
    let bandDefaults = {};
    if (band) {
      const bandSong = band.findBandSong(data.title);
      if (bandSong) {
        bandDefaults = { ...bandSong };
      }
    }
    
    // Apply band defaults first, then override with setlist-specific data
    this.title = data.title || '';
    
    // Resolve pgm: prefer setlist data, then generic pgm, then device-specific keys (KP, AM, GP)
    if (data.pgm !== undefined) {
      this.pgm = data.pgm;
    } else if (bandDefaults.pgm) {
      this.pgm = bandDefaults.pgm;
    } else {
      // Fall back to first available device-specific key
      this.pgm = bandDefaults.KP || bandDefaults.AM || bandDefaults.GP || '';
    }
    
    this.notes = data.notes !== undefined ? data.notes : (bandDefaults.notes || '');
    this.break = data.break !== undefined ? data.break : (bandDefaults.break || 0);
    this.noPause = data['no-pause'] !== undefined ? data['no-pause'] : (data.noPause !== undefined ? data.noPause : (bandDefaults.noPause || 0));
    this.capo = data.capo !== undefined ? data.capo : (bandDefaults.capo || '');
    this.key = data.key !== undefined ? data.key : (bandDefaults.key || '');
    this.GT1 = data.GT1 !== undefined ? data.GT1 : (bandDefaults.GT1 || '');

    this.preset = presetsAndSetlist.findPresetByPgm(this.pgm);

    // this.index + this.prev + this.next will be set by the Setlist constructor after all songs are created

    //console.info("Created Song - title:", this.title, ", pgm:", this.pgm, ", presetLabel=" + (this.preset ? this.preset.label : "none"));
  }

  getPreset() {
    return this.pgm;
  }

  hasNotes() {
    return this.notes && this.notes.length > 0;
  }

  isBreak() {
    return this.break > 0;
  }

  hasNoPause() {
    return this.noPause > 0;
  }

  hasCapo() {
    return this.capo && String(this.capo).trim().length > 0;
  }
}

// ----------------------------------------------------------------------------

/**
 * single setlist with its configuration and songs
 */
class Setlist {
  constructor(data = {}, presetsAndSetlist, band = null) {
    this.band = band;
    this.name = data.name || '';
    let soloPresetString = (data.cfg && data.cfg.soloPreset) || "1-3";
    this.cfg = {
      soloPresetString: soloPresetString,
      soloPresetBank: parseInt(soloPresetString.split('-')[0]),
      soloPresetIndex: parseInt(soloPresetString.split('-')[1]) - 1
    };
    this.songs = (data.songs || []).map(song => new Song(song, presetsAndSetlist, band));
    this.songs.forEach((song, index) => {
      song.index = index;
      song.prev = index > 0 ? this.songs[index - 1] : null;
      song.next = index < this.songs.length - 1 ? this.songs[index + 1] : null;
    });
    this.soloPreset = presetsAndSetlist.findPresetByPgm(this.cfg.soloPresetString);
  }

  getSongCount() {
    return this.songs.length;
  }

  firstSong() {
    return this.songs.length > 0 ? this.songs[0] : null;
  }

  getSong(index) {
    if (index >= 0 && index < this.songs.length) {
      return this.songs[index];
    }
    return null;
  }

  findSongByTitle(title) {
    const lowerTitle = title.toLowerCase();
    return this.songs.find(song => song.title.toLowerCase() === lowerTitle) || null;
  }

  getSongsSorted() {
    return [...this.songs].sort((a, b) => a.title.localeCompare(b.title));
  }

  getSongsWithBreaks() {
    return this.songs.filter(song => song.isBreak());
  }
}

// ----------------------------------------------------------------------------

/**
 * presets, bands, and all setlists
 */
class PresetsAndSetlists {
  constructor(data = {}) {
    // Handle devices structure
    this.devices = (data.devices || []).map(deviceData => new Device(deviceData));
    
    // Track currently selected device (default to first device)
    this.currentDeviceIndex = 0;
    
    // Build flat presets array from all devices (for backward compatibility)
    this.presets = [];
    this.devices.forEach(device => {
      this.presets.push(...device.presets);
    });
    
    // Set index for flat presets array
    this.presets.forEach((preset, index) => {
      preset.index = index;
      preset.prev = index > 0 && preset.bank===this.presets[index - 1].bank ? this.presets[index - 1] : this.presets[index + 4];
      preset.next = index < this.presets.length - 1 && preset.bank===this.presets[index + 1].bank ? this.presets[index + 1] : this.presets[index - 4];
    });

    // Handle bands structure - create Band instances and their setlists
    this.bands = [];
    this.setlists = [];
    
    (data.bands || []).forEach(bandData => {
      const band = new Band(bandData);
      this.bands.push(band);
      
      // Extract setlists from this band
      const bandSetlists = (bandData.setlists || [])
        .map(setlistData => new Setlist(setlistData, this, band));
      band.setlists = bandSetlists;
      this.setlists.push(...bandSetlists);
    });
  }

  getSetlistCount() {
    return this.setlists.length;
  }

  getSetlist(index) {
    if (index >= 0 && index < this.setlists.length) {
      return this.setlists[index];
    }
    return null;
  }

  findSetlistByName(name) {
    const lowerName = name.toLowerCase();
    return this.setlists.find(sl => sl.name.toLowerCase() === lowerName) || null;
  }

  getSetlistNames() {
    return this.setlists.map(sl => sl.name);
  }

  getPresetCount() {
    return this.presets.length;
  }

  getPreset(index) {
    if (index >= 0 && index < this.presets.length) {
      return this.presets[index];
    }
    return null;
  }

  findPresetByPgm(pgm) {
    return this.presets.find(preset => preset.pgm === pgm) || null;
  }

  getPresetsForBank(bank) {
    const result = [];
    for (let i = 0; i < this.getPresetCount(); i++) {
      const preset = this.getPreset(i);
      if (preset && preset.pgm &&preset.bank === bank) {
        result.push(preset);
      }
    }
    return result;
  }

  getUniqueBanks() {
    const banks = new Set();
    for (let i = 0; i < this.getPresetCount(); i++) {
      const preset = this.getPreset(i);
      if (preset && preset.pgm) {
        const bank = parseInt(preset.pgm.split('-')[0], 10);
        banks.add(bank);
      }
    }
    return Array.from(banks).sort((a, b) => a - b);
  }

  // ========== Band-related methods ==========

  getBandCount() {
    return this.bands.length;
  }

  getBand(index) {
    if (index >= 0 && index < this.bands.length) {
      return this.bands[index];
    }
    return null;
  }

  findBandByName(name) {
    const lowerName = name.toLowerCase();
    return this.bands.find(band => band.name.toLowerCase() === lowerName) || null;
  }

  getBandNames() {
    return this.bands.map(band => band.name);
  }

  /**
   * Get setlists for a specific band
   * @param {string|number} bandIdentifier - Band name or index
   */
  getSetlistsForBand(bandIdentifier) {
    let band;
    if (typeof bandIdentifier === 'number') {
      band = this.getBand(bandIdentifier);
    } else if (typeof bandIdentifier === 'string') {
      band = this.findBandByName(bandIdentifier);
    }
    return band ? band.setlists : [];
  }

  /**
   * Get songs for a specific band
   * @param {string|number} bandIdentifier - Band name or index
   */
  getSongsForBand(bandIdentifier) {
    let band;
    if (typeof bandIdentifier === 'number') {
      band = this.getBand(bandIdentifier);
    } else if (typeof bandIdentifier === 'string') {
      band = this.findBandByName(bandIdentifier);
    }
    return band ? band.bandSongs : [];
  }

  // ========== Device-related methods ==========

  getDeviceCount() {
    return this.devices.length;
  }

  getDevice(index) {
    if (index >= 0 && index < this.devices.length) {
      return this.devices[index];
    }
    return null;
  }

  findDeviceByName(name) {
    const lowerName = name.toLowerCase();
    return this.devices.find(device => device.name.toLowerCase() === lowerName) || null;
  }

  findDeviceById(id) {
    return this.devices.find(device => device.id === id) || null;
  }

  getDeviceNames() {
    return this.devices.map(device => device.name);
  }

  /**
   * Get the currently selected device
   * @returns {Device} The currently selected device
   */
  getCurrentDevice() {
    return this.getDevice(this.currentDeviceIndex);
  }

  /**
   * Set the currently selected device
   * @param {string|number} deviceIdentifier - Device name, id, or index
   */
  setCurrentDevice(deviceIdentifier) {
    let index = -1;
    if (typeof deviceIdentifier === 'number') {
      index = deviceIdentifier;
    } else if (typeof deviceIdentifier === 'string') {
      const device = this.findDeviceByName(deviceIdentifier) || this.findDeviceById(deviceIdentifier);
      if (device) {
        index = this.devices.indexOf(device);
      }
    }
    if (index >= 0 && index < this.devices.length) {
      this.currentDeviceIndex = index;
    }
  }

  /**
   * Get presets for the currently selected device
   * @returns {Array} Array of presets from the current device
   */
  getPresetsForCurrentDevice() {
    const device = this.getCurrentDevice();
    return device ? device.presets : [];
  }

  /**
   * Get unique banks for the currently selected device
   * @returns {Array} Array of bank numbers used in the current device
   */
  getUniqueBanksForCurrentDevice() {
    const device = this.getCurrentDevice();
    return device ? device.getUniqueBanks() : [];
  }

  /**
   * Get presets for a specific device
   * @param {string|number} deviceIdentifier - Device name, id, or index
   */
  getPresetsForDevice(deviceIdentifier) {
    let device;
    if (typeof deviceIdentifier === 'number') {
      device = this.getDevice(deviceIdentifier);
    } else if (typeof deviceIdentifier === 'string') {
      device = this.findDeviceByName(deviceIdentifier) || this.findDeviceById(deviceIdentifier);
    }
    return device ? device.presets : [];
  }

  /**
   * Find preset by pgm within a specific device
   * @param {string} pgm - Preset program identifier (e.g., "1-1")
   * @param {string|number} deviceIdentifier - Device name, id, or index
   */
  findPresetByPgmInDevice(pgm, deviceIdentifier) {
    let device;
    if (typeof deviceIdentifier === 'number') {
      device = this.getDevice(deviceIdentifier);
    } else if (typeof deviceIdentifier === 'string') {
      device = this.findDeviceByName(deviceIdentifier) || this.findDeviceById(deviceIdentifier);
    }
    return device ? device.findPresetByPgm(pgm) : null;
  }

  /**
   * Validate the setlist data for common issues
   * @returns {Array} Array of validation warning objects with {type, message, details}
   */
  validate() {
    const warnings = [];

    // Iterate through all setlists
    for (let i = 0; i < this.setlists.length; i++) {
      const setlist = this.setlists[i];
      const bandName = setlist.band ? setlist.band.name : 'Unknown';

      for (let j = 0; j < setlist.songs.length; j++) {
        const song = setlist.songs[j];

        // Check 1: Song references undefined preset
        if (!song.preset && song.pgm) {
          warnings.push({
            type: 'UNDEFINED_PRESET',
            message: `Undefined preset reference in setlist "${setlist.name}"`,
            details: {
              setlist: setlist.name,
              songIndex: j,
              songTitle: song.title,
              pgm: song.pgm,
              band: bandName
            }
          });
        }

        // Check 2: Song not in band's master songs list
        if (setlist.band && !setlist.band.findBandSong(song.title)) {
          warnings.push({
            type: 'MISSING_BAND_SONG',
            message: `Song not found in band's master songs list for setlist "${setlist.name}"`,
            details: {
              setlist: setlist.name,
              songIndex: j,
              songTitle: song.title,
              band: bandName
            }
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Validate and log warnings to console
   * @returns {boolean} True if validation passed (no warnings)
   */
  validateAndLog() {
    const warnings = this.validate();

    if (warnings.length === 0) {
      console.info('✓ Setlist validation passed - no issues found');
      return true;
    }

    console.error(`❌ SETLIST VALIDATION ERRORS: ${warnings.length} issue(s) found`);

    const undefinedPresets = warnings.filter(w => w.type === 'UNDEFINED_PRESET');
    const missingBandSongs = warnings.filter(w => w.type === 'MISSING_BAND_SONG');

    if (undefinedPresets.length > 0) {
      console.error(`\n📍 ${undefinedPresets.length} Undefined Preset(s):`);
      undefinedPresets.forEach((warning, index) => {
        console.error(`  [${index + 1}] "${warning.details.songTitle}" in setlist "${warning.details.setlist}" references pgm "${warning.details.pgm}" (band: ${warning.details.band})`);
      });
    }

    if (missingBandSongs.length > 0) {
      console.error(`\n📍 ${missingBandSongs.length} Song(s) Missing from Band Master List:`);
      missingBandSongs.forEach((warning, index) => {
        console.error(`  [${index + 1}] "${warning.details.songTitle}" in setlist "${warning.details.setlist}" not found in band "${warning.details.band}" master songs`);
      });
    }

    return false;
  }

  /**
   * Load from a JSON object (typically from Setlist.json)
   * @static
   */
  static fromJSON(jsonData) {
    return new PresetsAndSetlists(jsonData);
  }

  /**
   * Load setlists from a JSON file (for Node.js)
   * @static
   */
  static async loadFromFile(filePath) {
    if (typeof require !== 'undefined') {
      // Node.js environment
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      return new PresetsAndSetlists(data);
    } else if (typeof fetch !== 'undefined') {
      // Browser environment
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return new PresetsAndSetlists(data);
    } else {
      throw new Error('Unable to load file: no file system or fetch available');
    }
  }

}

// ----------------------------------------------------------------------------

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Setlist, Setlists: PresetsAndSetlists, Song, Preset, Device, Band };
} else if (typeof window !== 'undefined') {
  window.Setlist = Setlist;
  window.Setlists = PresetsAndSetlists;
  window.Song = Song;
  window.Preset = Preset;
  window.Device = Device;
  window.Band = Band;
}