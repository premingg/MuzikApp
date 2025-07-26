const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const SONGS_DIR = path.join(__dirname, 'songs');
const PLAYLISTS_FILE = path.join(__dirname, 'playlists.json');

if (!fs.existsSync(SONGS_DIR)) fs.mkdirSync(SONGS_DIR);
if (!fs.existsSync(PLAYLISTS_FILE)) fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify({}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SONGS_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Multi-upload endpoint: support uploading multiple songs at once
app.post('/upload', upload.array('songs'), (req, res) => {
  // You can log req.files for debugging
  console.log('Received files:', req.files);
  res.sendStatus(200);
});

// Serve song files (decode URI for filenames with spaces/special chars)
app.get('/song/:id', (req, res) => {
  const decodedId = decodeURIComponent(req.params.id);
  const songPath = path.join(SONGS_DIR, decodedId);
  if (fs.existsSync(songPath)) {
    res.sendFile(songPath);
  } else {
    res.status(404).send('Song not found');
  }
});

// List all songs (id = filename)
app.get('/songs', (req, res) => {
  const files = fs.readdirSync(SONGS_DIR).filter(f => f.endsWith('.mp3'));
  res.json(files.map(filename => ({
    id: filename,
    name: filename.replace(/\.mp3$/i, '')
  })));
});

// --- PLAYLIST ENDPOINTS ---

function loadPlaylists() {
  return JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
}
function savePlaylists(obj) {
  fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(obj, null, 2));
}

app.get('/playlists', (req, res) => {
  res.json(loadPlaylists());
});

app.post('/playlist', (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).send('No name');
  const playlists = loadPlaylists();
  if (playlists[name]) return res.status(409).send('Exists');
  playlists[name] = [];
  savePlaylists(playlists);
  res.sendStatus(200);
});

app.post('/delete-playlist', (req, res) => {
  const { playlist } = req.body;
  const playlists = loadPlaylists();
  if (!playlists[playlist]) return res.status(404).send('Not found');
  delete playlists[playlist];
  savePlaylists(playlists);
  res.sendStatus(200);
});

app.post('/add-to-playlist', (req, res) => {
  const { playlist, songId } = req.body;
  const playlists = loadPlaylists();
  if (!playlists[playlist]) return res.status(404).send('Playlist not found');
  if (!fs.existsSync(path.join(SONGS_DIR, songId))) return res.status(404).send('Song not found');
  if (!playlists[playlist].includes(songId)) playlists[playlist].push(songId);
  savePlaylists(playlists);
  res.sendStatus(200);
});

app.post('/remove-from-playlist', (req, res) => {
  const { playlist, songId } = req.body;
  const playlists = loadPlaylists();
  if (!playlists[playlist]) return res.status(404).send('Playlist not found');
  playlists[playlist] = playlists[playlist].filter(id => id !== songId);
  savePlaylists(playlists);
  res.sendStatus(200);
});

app.post('/rename-song', (req, res) => {
  const { id, newName } = req.body;
  if (!id || !newName) return res.status(400).send('Missing');
  const decodedId = decodeURIComponent(id);
  const oldPath = path.join(SONGS_DIR, decodedId);
  const ext = path.extname(decodedId) || '.mp3';
  const sanitizedNewName = newName.replace(/[\\/]/g, '_');
  const newFileName = sanitizedNewName.endsWith(ext) ? sanitizedNewName : sanitizedNewName + ext;
  const newPath = path.join(SONGS_DIR, newFileName);
  if (!fs.existsSync(oldPath)) return res.status(404).send('Song not found');
  if (fs.existsSync(newPath)) return res.status(409).send('File exists');
  fs.renameSync(oldPath, newPath);

  // Update playlists
  const playlists = loadPlaylists();
  Object.keys(playlists).forEach(pl => {
    playlists[pl] = playlists[pl].map(sid => (sid === decodedId ? newFileName : sid));
  });
  savePlaylists(playlists);

  res.sendStatus(200);
});

app.post('/delete-song', (req, res) => {
  const { id } = req.body;
  const decodedId = decodeURIComponent(id);
  const songPath = path.join(SONGS_DIR, decodedId);
  if (!fs.existsSync(songPath)) return res.status(404).send('Song not found');
  fs.unlinkSync(songPath);

  // Remove from playlists
  const playlists = loadPlaylists();
  Object.keys(playlists).forEach(pl => {
    playlists[pl] = playlists[pl].filter(sid => sid !== decodedId);
  });
  savePlaylists(playlists);

  res.sendStatus(200);
});
// ... (existing code above)

app.post('/rename-playlist', (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).send('Missing');
  const playlists = loadPlaylists();
  if (!playlists[oldName]) return res.status(404).send('Playlist not found');
  if (playlists[newName]) return res.status(409).send('New name exists');
  playlists[newName] = playlists[oldName];
  delete playlists[oldName];
  savePlaylists(playlists);
  res.sendStatus(200);
});

// ... (existing code below)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Premingg Music App server running at http://localhost:${PORT}/`);
});
