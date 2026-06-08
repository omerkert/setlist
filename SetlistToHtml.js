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

for (const band of setlistData.bands) {
    if (band.setlists) {
        const found = band.setlists.find(sl => sl.name === setlistName);
        if (found) {
            targetSetlist = found;
            bandName = band.name;
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
            font-family: 'Verdana', monospace;
            font-size: 32px;
            padding: 8px 10px;
            line-height: 1.4;
        }
        
        .song-row:last-child {
            border-bottom: none;
        }
        
        .song-row:hover {
            background-color: #f9f9f9;
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

        .capo-flag {
            display: inline-block;
            margin-left: 0.75rem;
            padding: 3px 8px;
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
                const breakLine = song.break ? '        <hr/>\n' : '';
                const pauseLine = song['no-pause'] ? '<span class="pause-flag">↔ no pause</span>' : '';
                const capoLine = song.capo ? `<span class="capo-flag">${song.capo}</span>` : '';
                return `${breakLine}        <div class="song-row">${song.title}${pauseLine}${capoLine}</div>`;
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
