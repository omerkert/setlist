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

    this.channel = data.channel || 1;
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
 * single song within a setlist
 */
class Song {
  constructor(data = {}, presetsAndSetlist) {
    this.title = data.title || '';
    this.pgm = data.pgm || '';
    this.notes = data.notes || '';
    this.break = data.break || 0;
    this.noPause = data['no-pause'] || data.noPause || 0;
    this.capo = data.capo || '';
    this.key = data.key || '';
    this.GT1 = data.GT1 || '';

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
  constructor(data = {}, presetsAndSetlist) {
    this.name = data.name || '';
    let soloPresetString = (data.cfg && data.cfg.soloPreset) || "1-3";
    this.cfg = {
      soloPresetString: soloPresetString,
      soloPresetBank: parseInt(soloPresetString.split('-')[0]),
      soloPresetIndex: parseInt(soloPresetString.split('-')[1]) - 1
    };
    this.songs = (data.songs || []).map(song => new Song(song, presetsAndSetlist));
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
 * presets and all setlists
 */
class PresetsAndSetlists {
  constructor(data = {}) {
    this.presets = (data.presets || []).map(preset => new Preset(preset));
    this.presets.forEach((preset, index) => {
      preset.index = index;
      preset.prev = index > 0 && preset.bank===this.presets[index - 1].bank ? this.presets[index - 1] : this.presets[index + 4];
      preset.next = index < this.presets.length - 1 && preset.bank===this.presets[index + 1].bank ? this.presets[index + 1] : this.presets[index - 4];
    });

    this.setlists = (data.setlists || []).map(setlist => new Setlist(setlist, this));
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
  module.exports = { Setlist, Setlists: PresetsAndSetlists, Song, Preset };
} else if (typeof window !== 'undefined') {
  window.Setlist = Setlist;
  window.Setlists = PresetsAndSetlists;
  window.Song = Song;
  window.Preset = Preset;
}