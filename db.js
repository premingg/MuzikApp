const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./musicapp.db');

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        name TEXT,
        artist TEXT,
        filename TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS playlist_songs (
        playlist_id INTEGER,
        song_id TEXT,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id),
        FOREIGN KEY (song_id) REFERENCES songs(id)
    )`);
});

module.exports = db;