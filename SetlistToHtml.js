const fs = require('fs');
const path = require('path');

// Read the Setlist.json file
const setlistPath = path.join(__dirname, 'Setlist.json');
const setlistData = JSON.parse(fs.readFileSync(setlistPath, 'utf8'));

// Create HTML content
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setlist</title>
    <style>
        body {
            margin: 10px;
        }
        
        .setlist {
            background-color: white;
            padding: 10px;
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

        hr { border-top: 4px solid #000; }
    </style>
</head>
<body>
    <div class="setlist">
${setlistData.songs.map(song => {
                const breakLine = song.break ? '        <hr/>\n' : '';
                return `${breakLine}        <div class="song-row">${song.title}</div>`;
            }).join('\n')}
    </div>
</body>
</html>`;

// Write to HTML file
const outputPath = path.join(__dirname, 'Setlist.html');
fs.writeFileSync(outputPath, htmlContent, 'utf8');

console.log(`HTML file created: ${outputPath}`);
console.log(`Total songs: ${setlistData.songs.length}`);
