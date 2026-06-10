const fs = require('fs');
const path = require('path');

// Get setlist name from command-line argument
const setlistName = process.argv[2];

if (!setlistName) {
    console.error('Usage: node SetlistToHtml.js <setlist-name>');
    console.error('Example: node SetlistToHtml.js "UJ FULL"');
    process.exit(1);
}

// Read the Setlist.json file
const setlistPath = path.join(__dirname, 'Setlist.json');
const setlistData = JSON.parse(fs.readFileSync(setlistPath, 'utf8'));

// Find the setlist with the given name across all bands
let targetSetlist = null;
let bandName = null;
let bandSongs = null;

for (const band of setlistData.bands) {
    if (band.setlists) {
        const found = band.setlists.find(sl => sl.name === setlistName);
        if (found) {
            targetSetlist = found;
            bandName = band.name;
            bandSongs = band.songs;
            break;
        }
    }
}

if (!targetSetlist) {
    console.error(`Setlist "${setlistName}" not found in Setlist.json`);
    console.error('Available setlists:');
    for (const band of setlistData.bands) {
        if (band.setlists) {
            band.setlists.forEach(sl => {
                console.error(`  - "${sl.name}" (Band: ${band.name})`);
            });
        }
    }
    process.exit(1);
}

// Create HTML content
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bandName} - ${setlistName}</title>
    <style>
        body {
            margin: 10px;
        }
        
        .setlist {
            background-color: white;
            padding: 10px;
        }

        .setlist-header {
            font-family: 'Verdana', monospace;
            font-size: 12px;
            text-align: right;
        }
        
        .song-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: 'Verdana', monospace;
            font-size: 32px;
            padding: 8px 10px;
            line-height: 1.4;
        }

        .song-title {
            flex: 1;
        }

        .song-pgm {
            margin-left: 20px;
            font-size: 24px;
            color: #666;
            white-space: nowrap;
        }
        
        .song-row:last-child {
            border-bottom: none;
        }
        
        .song-row:hover {
            border-radius: 15px;
            background-color: #4aabdf;
        }

        .pause-flag {
            display: inline-block;
            margin-left: 0.75rem;
            padding: 3px 8px;
            border: 1px solid #f4c430;
            border-radius: 999px;
            color: #5a4300;
            background: rgba(244, 196, 48, 0.18);
            font-size: 0.8rem;
            vertical-align: middle;
        }

        .key-flag {
            display: inline-block;
            margin-left: 1.5rem;
            padding: 3px 16px;
            border: 1px solid #7a7a7a;
            border-radius: 999px;
            color: #333;
            background: rgba(200, 200, 200, 0.18);
            font-size: 1.4rem;
            vertical-align: middle;
        }

        .capo-flag {
            display: inline-block;
            margin-left: 1.5rem;
            padding: 3px 16px;
            border: 1px solid #3fc1c9;
            border-radius: 999px;
            color: #0c4c56;
            background: rgba(63, 193, 201, 0.18);
            font-size: 1.8rem;
            vertical-align: middle;
        }

        hr { border-top: 4px solid #000; }
    </style>
</head>
<body>
    <div class="setlist">
        <div class="setlist-header">${bandName} - ${setlistName}</div>
${targetSetlist.songs.map(song => {
                const bandSong = bandSongs.find(bs => bs.title.toLowerCase() === song.title.toLowerCase());
                const pgm = bandSong && bandSong.pgm ? bandSong.pgm : '';
                const songCapo = song.capo || (bandSong && bandSong.capo) || '';
                const songKey = song.key || (bandSong && bandSong.key) || '';

                const breakLine = song.break ? '        <hr/>\n' : '';
                const pauseLine = song['no-pause'] ? '<span class="pause-flag">↔ no pause</span>' : '';
                const keyLine = songKey ? `<span class="key-flag">${songKey}</span>` : '';
                const capoLine = songCapo ? `<span class="capo-flag">${songCapo}</span>` : '';
                const pgmLine = pgm ? `<span class="song-pgm">${pgm}</span>` : '';

                return `${breakLine}        <div class="song-row"><span class="song-title">${song.title}${keyLine}${pauseLine}${capoLine}</span>${pgmLine}</div>`;
            }).join('\n')}
    </div>
</body>
</html>`;

// Write to HTML file
const outputPath = path.join(__dirname, 'Setlist-Rendered.html');
fs.writeFileSync(outputPath, htmlContent, 'utf8');

console.log(`HTML file created: ${outputPath}`);
console.log(`Setlist: ${bandName} - ${setlistName}`);
console.log(`Total songs: ${targetSetlist.songs.length}`);
