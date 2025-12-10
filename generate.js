// generate.js
const fs = require('fs');
const path = require('path');

const readDir = (dir) => {
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    } catch (e) { return []; }
};

const typingFiles = readDir(path.join(__dirname, 'texts/typing'));
const dictationFiles = readDir(path.join(__dirname, 'texts/dictation'));

fs.writeFileSync('index.json', JSON.stringify(typingFiles, null, 2));
fs.writeFileSync('dictation.json', JSON.stringify(dictationFiles, null, 2));

console.log("✅ Updated index.json and dictation.json");