/**
 * Setlist Model Classes
 * Represents setlist data structure from Setlist.json
 */

/**
 * Represents a single song within a setlist
 */
class Song {
  constructor(data = {}) {
    this.title = data.title || '';
    this.preset = data.preset || data.program || '';
    this.notes = data.notes || '';
    this.break = data.break || 0;
    this.GT1 = data.GT1 || '';
    this.channel = data.channel || 1;
    this.bankMSB = data.bankMSB;
    this.bankLSB = data.bankLSB;
  }

  /**
   * Get the preset/program identifier for this song
   */
  getPreset() {
    return this.preset;
  }

  /**
   * Check if this song has notes
   */
  hasNotes() {
    return this.notes && this.notes.length > 0;
  }

  /**
   * Check if this song marks a section break
   */
  isBreak() {
    return this.break > 0;
  }
}

/**
 * Represents a single setlist with its configuration and songs
 */
class Setlist {
  constructor(data = {}) {
    this.name = data.name || '';
    this.cfg = {
      directPcOffset: (data.cfg && data.cfg.directPcOffset) || 0,
      directButtons: (data.cfg && data.cfg.directButtons) || ['CLEAN', 'UN-CLEAN', 'SOLO', 'CRUNCH', 'HI-GAIN']
    };
    this.songs = (data.songs || []).map(song => new Song(song));
  }

  /**
   * Get the number of songs in this setlist
   */
  getSongCount() {
    return this.songs.length;
  }

  /**
   * Get a song by index
   */
  getSong(index) {
    if (index >= 0 && index < this.songs.length) {
      return this.songs[index];
    }
    return null;
  }

  /**
   * Find a song by title (case-insensitive)
   */
  findSongByTitle(title) {
    const lowerTitle = title.toLowerCase();
    return this.songs.find(song => song.title.toLowerCase() === lowerTitle) || null;
  }

  /**
   * Get all songs sorted alphabetically by title
   */
  getSongsSorted() {
    return [...this.songs].sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Get direct button labels
   */
  getDirectButtons() {
    return this.cfg.directButtons || [];
  }

  /**
   * Get direct PC offset
   */
  getDirectPcOffset() {
    return this.cfg.directPcOffset;
  }

  /**
   * Get all songs with breaks
   */
  getSongsWithBreaks() {
    return this.songs.filter(song => song.isBreak());
  }
}

/**
 * Represents the complete setlist collection
 */
class PresetsAndSetlists {
  constructor(data = {}) {
    this.presets = (data.presets || []).map(preset => new Preset(preset));
    this.setlists = (data.setlists || []).map(setlist => new Setlist(setlist));
  }

  /**
   * Get the number of setlists
   */
  getSetlistCount() {
    return this.setlists.length;
  }

  /**
   * Get a setlist by index
   */
  getSetlist(index) {
    if (index >= 0 && index < this.setlists.length) {
      return this.setlists[index];
    }
    return null;
  }

  /**
   * Find a setlist by name (case-insensitive)
   */
  findSetlistByName(name) {
    const lowerName = name.toLowerCase();
    return this.setlists.find(sl => sl.name.toLowerCase() === lowerName) || null;
  }

  /**
   * Get all setlist names
   */
  getSetlistNames() {
    return this.setlists.map(sl => sl.name);
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

  /**
   * Get the number of presets
   */
  getPresetCount() {
    return this.presets.length;
  }

  /**
   * Get a preset by index
   */
  getPreset(index) {
    if (index >= 0 && index < this.presets.length) {
      return this.presets[index];
    }
    return null;
  }

  /**
   * Find a preset by program number
   */
  findPresetByPgm(pgm) {
    return this.presets.find(preset => preset.pgm === pgm) || null;
  }

  /**
   * Get all favorite presets
   */
  getFavoritePresets() {
    return this.presets.filter(preset => preset.favorite).sort((a, b) => a.favorite - b.favorite);
  }
}

/**
 * Represents a preset/program
 */
class Preset {
  constructor(data = {}) {
    this.pgm = data.pgm || '';
    this.label = data.label || '';
    this.effectBtns = data.effectBtns || [];
    this.favorite = data.favorite || 0;
  }

  /**
   * Check if this is a favorite preset
   */
  isFavorite() {
    return this.favorite > 0;
  }

  /**
   * Get the effect buttons
   */
  getEffectButtons() {
    return this.effectBtns;
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Setlist, Setlists: PresetsAndSetlists, Song, Preset };
} else if (typeof window !== 'undefined') {
  window.Setlist = Setlist;
  window.Setlists = PresetsAndSetlists;
  window.Song = Song;
  window.Preset = Preset;
}
