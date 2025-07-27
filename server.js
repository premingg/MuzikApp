const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure directories exist
const songsDir = path.join(__dirname, 'songs');
const playlistsFile = path.join(__dirname, 'playlists.json');

if (!fs.existsSync(songsDir)) {
    fs.mkdirSync(songsDir);
}

if (!fs.existsSync(playlistsFile)) {
    fs.writeFileSync(playlistsFile, JSON.stringify({}));
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

// Helper functions
function getPlaylists() {
    try {
        const data = fs.readFileSync(playlistsFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function savePlaylists(playlists) {
    fs.writeFileSync(playlistsFile, JSON.stringify(playlists, null, 2));
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/songs', (req, res) => {
    try {
        const files = fs.readdirSync(songsDir);
        const songs = files
            .filter(file => ['.mp3', '.wav', '.m4a', '.ogg'].includes(path.extname(file).toLowerCase()))
            .map(file => ({
                id: file,
                name: path.parse(file).name
            }));
        res.json(songs);
    } catch (err) {
        console.error('Error reading songs:', err);
        res.status(500).json({ error: 'Failed to read songs' });
    }
});

app.get('/song/:id', (req, res) => {
    const songId = req.params.id;
    const songPath = path.join(songsDir, songId);
    
    if (!fs.existsSync(songPath)) {
        return res.status(404).json({ error: 'Song not found' });
    }
    
    res.sendFile(songPath);
});

app.get('/playlists', (req, res) => {
    res.json(getPlaylists());
});

app.post('/upload', upload.array('songs'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        res.json({ message: 'Upload successful', files: req.files.length });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.post('/playlist', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Playlist name required' });
    }
    
    const playlists = getPlaylists();
    if (playlists[name]) {
        return res.status(400).json({ error: 'Playlist already exists' });
    }
    
    playlists[name] = [];
    savePlaylists(playlists);
    res.json({ message: 'Playlist created' });
});

app.post('/add-to-playlist', (req, res) => {
    const { playlist, songId } = req.body;
    const playlists = getPlaylists();
    
    if (!playlists[playlist]) {
        return res.status(404).json({ error: 'Playlist not found' });
    }
    
    if (!playlists[playlist].includes(songId)) {
        playlists[playlist].push(songId);
        savePlaylists(playlists);
    }
    
    res.json({ message: 'Song added to playlist' });
});

app.post('/remove-from-playlist', (req, res) => {
    const { playlist, songId } = req.body;
    const playlists = getPlaylists();
    
    if (!playlists[playlist]) {
        return res.status(404).json({ error: 'Playlist not found' });
    }
    
    playlists[playlist] = playlists[playlist].filter(id => id !== songId);
    savePlaylists(playlists);
    res.json({ message: 'Song removed from playlist' });
});

app.post('/delete-playlist', (req, res) => {
    const { playlist } = req.body;
    const playlists = getPlaylists();
    
    if (!playlists[playlist]) {
        return res.status(404).json({ error: 'Playlist not found' });
    }
    
    delete playlists[playlist];
    savePlaylists(playlists);
    res.json({ message: 'Playlist deleted' });
});

app.post('/rename-playlist', (req, res) => {
    const { oldName, newName } = req.body;
    const playlists = getPlaylists();
    
    if (!playlists[oldName]) {
        return res.status(404).json({ error: 'Playlist not found' });
    }
    
    if (playlists[newName]) {
        return res.status(400).json({ error: 'New playlist name already exists' });
    }
    
    playlists[newName] = playlists[oldName];
    delete playlists[oldName];
    savePlaylists(playlists);
    res.json({ message: 'Playlist renamed' });
});

// Replace the rename-song and delete-song endpoints with these fixed versions

app.post('/rename-song', (req, res) => {
    const { songId, newName } = req.body; // Changed from 'id' to 'songId'
    const oldPath = path.join(songsDir, songId);
    const ext = path.extname(songId);
    const newPath = path.join(songsDir, newName + ext);
    
    if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: 'Song not found' });
    }
    
    try {
        fs.renameSync(oldPath, newPath);
        
        // Update playlists
        const playlists = getPlaylists();
        const newId = newName + ext;
        
        Object.keys(playlists).forEach(playlistName => {
            const index = playlists[playlistName].indexOf(songId);
            if (index !== -1) {
                playlists[playlistName][index] = newId;
            }
        });
        
        savePlaylists(playlists);
        res.json({ message: 'Song renamed' });
    } catch (err) {
        console.error('Rename error:', err);
        res.status(500).json({ error: 'Failed to rename song' });
    }
});

app.post('/delete-song', (req, res) => {
    const { songId } = req.body; // Changed from 'id' to 'songId'
    const songPath = path.join(songsDir, songId);
    
    if (!fs.existsSync(songPath)) {
        return res.status(404).json({ error: 'Song not found' });
    }
    
    try {
        fs.unlinkSync(songPath);
        
        // Remove from all playlists
        const playlists = getPlaylists();
        Object.keys(playlists).forEach(playlistName => {
            playlists[playlistName] = playlists[playlistName].filter(id => id !== songId);
        });
        
        savePlaylists(playlists);
        res.json({ message: 'Song deleted' });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete song' });
    }
});

app.listen(PORT, () => {
    console.log(`🎵 MuzikApp server running on http://localhost:${PORT}`);
});