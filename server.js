const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db'); // <-- Make sure db.js exists as described

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure songs directory exists for file storage
const songsDir = path.join(__dirname, 'songs');
if (!fs.existsSync(songsDir)) {
    fs.mkdirSync(songsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, songsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// List all songs from the database
app.get('/songs', (req, res) => {
    db.all(`SELECT * FROM songs`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

// Serve song file
app.get('/song/:id', (req, res) => {
    const songId = req.params.id;
    const songPath = path.join(songsDir, songId);
    if (!fs.existsSync(songPath)) {
        return res.status(404).json({ error: 'Song not found' });
    }
    res.sendFile(songPath);
});

// Upload songs and save metadata to DB
app.post('/upload', upload.array('songs'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    let completed = 0;
    req.files.forEach(file => {
        db.run(
            `INSERT OR IGNORE INTO songs (id, name, artist, filename) VALUES (?, ?, ?, ?)`,
            [file.filename, path.parse(file.originalname).name, 'Street Artist', file.filename],
            (err) => {
                completed++;
                if (completed === req.files.length) {
                    res.json({ message: 'Upload successful', files: req.files.length });
                }
            }
        );
    });
});

// List all playlists
app.get('/playlists', (req, res) => {
    db.all(`SELECT * FROM playlists`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

// Get songs in a playlist
app.get('/playlist-songs/:playlistId', (req, res) => {
    const playlistId = req.params.playlistId;
    db.all(
        `SELECT songs.* FROM songs
         JOIN playlist_songs ON songs.id = playlist_songs.song_id
         WHERE playlist_songs.playlist_id = ?`,
        [playlistId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json(rows);
        }
    );
});

// Create a new playlist
app.post('/playlist', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Playlist name required' });
    db.run(`INSERT INTO playlists (name) VALUES (?)`, [name], function(err) {
        if (err) return res.status(500).json({ error: 'DB error or playlist exists' });
        res.json({ id: this.lastID, name });
    });
});

// Add a song to a playlist
app.post('/add-to-playlist', (req, res) => {
    const { playlistId, songId } = req.body;
    db.run(
        `INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)`,
        [playlistId, songId],
        (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ message: 'Song added to playlist' });
        }
    );
});

// Remove a song from a playlist
app.post('/remove-from-playlist', (req, res) => {
    const { playlistId, songId } = req.body;
    db.run(
        `DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`,
        [playlistId, songId],
        (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ message: 'Song removed from playlist' });
        }
    );
});

// Delete a playlist
app.post('/delete-playlist', (req, res) => {
    const { playlistId } = req.body;
    db.run(`DELETE FROM playlists WHERE id = ?`, [playlistId], (err) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        db.run(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [playlistId], () => {
            res.json({ message: 'Playlist deleted' });
        });
    });
});

// Rename a playlist
app.post('/rename-playlist', (req, res) => {
    const { playlistId, newName } = req.body;
    db.run(`UPDATE playlists SET name = ? WHERE id = ?`, [newName, playlistId], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ message: 'Playlist renamed' });
    });
});

// Rename a song
app.post('/rename-song', (req, res) => {
    const { songId, newName } = req.body;
    const oldPath = path.join(songsDir, songId);
    const ext = path.extname(songId);
    const newFilename = newName + ext;
    const newPath = path.join(songsDir, newFilename);

    if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: 'Song not found' });
    }

    try {
        fs.renameSync(oldPath, newPath);
        db.run(`UPDATE songs SET name = ?, id = ?, filename = ? WHERE id = ?`, [newName, newFilename, newFilename, songId], (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ message: 'Song renamed' });
        });
    } catch (err) {
        console.error('Rename error:', err);
        res.status(500).json({ error: 'Failed to rename song' });
    }
});

// Delete a song
app.post('/delete-song', (req, res) => {
    const { songId } = req.body;
    const songPath = path.join(songsDir, songId);

    if (!fs.existsSync(songPath)) {
        return res.status(404).json({ error: 'Song not found' });
    }

    try {
        fs.unlinkSync(songPath);
        db.run(`DELETE FROM songs WHERE id = ?`, [songId], (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            db.run(`DELETE FROM playlist_songs WHERE song_id = ?`, [songId], () => {
                res.json({ message: 'Song deleted' });
            });
        });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete song' });
    }
});

app.listen(PORT, () => {
    console.log(`🎵 MuzikApp server running on http://localhost:${PORT}`);
});