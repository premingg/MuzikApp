const uploadInput = document.getElementById('uploadInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const uploadProgress = document.getElementById('uploadProgress');
const songsUl = document.getElementById('songsUl');
const playlistsUl = document.getElementById('playlistsUl');
const playlistNameInput = document.getElementById('playlistNameInput');
const createPlaylistBtn = document.getElementById('createPlaylistBtn');
const audioPlayer = document.getElementById('audioPlayer');
const playlistSongsUl = document.getElementById('playlistSongsUl');
const deletePlaylistBtn = document.getElementById('deletePlaylistBtn');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingArt = document.getElementById('nowPlayingArt');
const shuffleBtn = document.getElementById('shuffleBtn');
const playlistControlsDiv = document.getElementById('playlistControlsDiv');
const songSearchInput = document.getElementById('songSearchInput');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const queueStatus = document.getElementById('queueStatus');

let allSongs = [];
let playlists = {};
let selectedPlaylist = null;
let playlistOrder = [];
let playlistIndex = -1;
let shuffleMode = false;
let allSongsOrder = [];
let allSongsIndex = -1;
let playingFromAllSongs = false;
let songDurationsCache = {};
let currentQueue = [];
let queuePointer = -1;

function showStatus(message, isSuccess = true) {
  uploadStatus.textContent = message;
  uploadStatus.className = isSuccess ? "success" : "error";
  setTimeout(() => {
    uploadStatus.textContent = "";
    uploadStatus.className = "";
  }, 2000);
}

async function loadSongs() {
  const res = await fetch('/songs');
  allSongs = await res.json();
  renderSongs();
}

async function loadPlaylists() {
  const res = await fetch('/playlists');
  playlists = await res.json();
  renderPlaylists();
  renderPlaylistSongs();
  renderPlaylistControls();
}

songSearchInput.addEventListener("input", () => renderSongs());

function formatDuration(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds)) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Songs Rendering ---
function renderSongs() {
  songsUl.innerHTML = '';
  const filter = songSearchInput.value.trim().toLowerCase();
  let filteredSongs = allSongs;
  if (filter) {
    filteredSongs = allSongs.filter(song => song.name.toLowerCase().includes(filter));
  }
  allSongsOrder = filteredSongs.map(song => song.id);

  filteredSongs.forEach((song, idx) => {
    const li = document.createElement('li');
    li.className = "song-card";
    const durationStr = formatDuration(songDurationsCache[song.id] || song.duration);

    li.innerHTML = `
      <div class="card-main">
        <div class="song-album-art"></div>
        <div>
          <span class="song-title">${song.name}</span>
          <span class="song-duration" style="color:#6c3ca2;font-size:0.95em;margin-left:10px;">${durationStr}</span>
          <div class="song-actions">
            <button class="icon-btn play-btn" title="Play this song">&#9654;</button>
            <button class="icon-btn rename-btn" title="Rename this song">&#9998;</button>
            <button class="icon-btn delete-btn" title="Delete this song">&#128465;</button>
            ${selectedPlaylist ? '<button class="icon-btn add-btn" title="Add to Playlist">&#43;</button>' : ''}
          </div>
        </div>
      </div>
    `;
    li.querySelector('.play-btn').onclick = () => setQueue(filteredSongs, idx);
    li.querySelector('.rename-btn').onclick = async () => {
      const newName = prompt('Enter new name for the song:', song.name);
      if (newName && newName.trim() && newName !== song.name) {
        const res = await fetch('/rename-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: song.id, newName: newName.trim() })
        });
        if (res.ok) {
          await loadSongs();
          showStatus('Song renamed!', true);
        } else {
          showStatus('Failed to rename song.', false);
        }
      }
    };
    li.querySelector('.delete-btn').onclick = async () => {
      if (!confirm(`Delete song "${song.name}"? This cannot be undone.`)) return;
      const res = await fetch('/delete-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: song.id })
      });
      if (res.ok) {
        await loadSongs();
        await loadPlaylists();
        showStatus('Song deleted!', true);
      } else {
        showStatus('Could not delete song.', false);
      }
    };
    // --- FIX: Add to Playlist button ---
    if (selectedPlaylist && li.querySelector('.add-btn')) {
      li.querySelector('.add-btn').onclick = async () => {
        const res = await fetch('/add-to-playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlist: selectedPlaylist, songId: song.id })
        });
        if (res.ok) {
          await loadPlaylists(); // reload to update playlist songs
          showStatus('Added to playlist!', true);
        } else {
          showStatus('Could not add.', false);
        }
      };
    }
    songsUl.appendChild(li);
  });
}

// --- Playlists Rendering ---
function renderPlaylists() {
  playlistsUl.innerHTML = '';
  Object.keys(playlists).forEach(name => {
    const li = document.createElement('li');
    li.className = selectedPlaylist === name ? 'playlist-card selected-playlist' : 'playlist-card';
    li.innerHTML = `
      <span class="playlist-name">${name}</span>
      <button class="icon-btn select-btn" title="Select this playlist">${selectedPlaylist === name ? '✓' : '→'}</button>
      <button class="icon-btn playlist-rename-btn" title="Rename playlist">&#9998;</button>
    `;
    li.querySelector('.select-btn').onclick = () => {
      selectedPlaylist = name;
      resetPlaylistOrder();
      renderPlaylists();
      renderSongs();
      renderPlaylistSongs();
      renderPlaylistControls();
      deletePlaylistBtn.style.display = "inline-block";
    };
    // --- FIX: Playlist rename functionality ---
    li.querySelector('.playlist-rename-btn').onclick = async () => {
      const newName = prompt('Enter new name for the playlist:', name);
      if (newName && newName.trim() && newName !== name) {
        const res = await fetch('/rename-playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName: name, newName: newName.trim() })
        });
        if (res.ok) {
          // Update selectedPlaylist to the new name
          selectedPlaylist = newName.trim();
          await loadPlaylists(); // refresh playlists from backend
          renderPlaylists();
          renderSongs();
          renderPlaylistSongs();
          showStatus('Playlist renamed!', true);
        } else {
          showStatus('Failed to rename playlist.', false);
        }
      }
    };
    playlistsUl.appendChild(li);
  });
}

function renderPlaylistSongs() {
  playlistSongsUl.innerHTML = '';
  if (!selectedPlaylist) {
    playlistSongsUl.innerHTML = `<li style="color:#777;">Select a playlist to view songs.</li>`;
    deletePlaylistBtn.style.display = "none";
    return;
  }
  const songIds = playlists[selectedPlaylist];
  if (!songIds || songIds.length === 0) {
    playlistSongsUl.innerHTML = `<li style="color:#777;">No songs in this playlist.</li>`;
    return;
  }
  songIds.forEach((id, idx) => {
    const song = allSongs.find(s => s.id === id);
    if (!song) return;
    const durationStr = formatDuration(songDurationsCache[song.id] || song.duration);
    const li = document.createElement('li');
    li.className = "song-card";
    li.innerHTML = `
      <div class="card-main">
        <div class="song-album-art"></div>
        <div>
          <span class="song-title">${song.name}</span>
          <span class="song-duration" style="color:#6c3ca2;font-size:0.95em;margin-left:10px;">${durationStr}</span>
          <div class="song-actions">
            <button class="icon-btn play-btn" title="Play this song">&#9654;</button>
            <button class="icon-btn remove-btn" title="Remove from playlist">&#8722;</button>
          </div>
        </div>
      </div>
    `;
    li.querySelector('.play-btn').onclick = () => setQueue(songIds.map(id => allSongs.find(s => s.id === id)), idx, selectedPlaylist);
    li.querySelector('.remove-btn').onclick = async () => {
      const res = await fetch('/remove-from-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist: selectedPlaylist, songId: song.id })
      });
      if (res.ok) {
        await loadPlaylists();
        resetPlaylistOrder();
        showStatus('Removed from playlist!', true);
      } else {
        showStatus('Could not remove.', false);
      }
    };
    playlistSongsUl.appendChild(li);
  });
}

function renderPlaylistControls() {
  playlistControlsDiv.style.display = selectedPlaylist ? "flex" : "none";
  shuffleBtn.textContent = shuffleMode ? "Shuffle: On" : "Shuffle: Off";
}

shuffleBtn.onclick = () => {
  if (!selectedPlaylist) return;
  shuffleMode = !shuffleMode;
  shuffleBtn.textContent = shuffleMode ? "Shuffle: On" : "Shuffle: Off";
  resetPlaylistOrder();
};

function resetPlaylistOrder() {
  if (!selectedPlaylist) {
    playlistOrder = [];
    playlistIndex = -1;
    return;
  }
  const songIds = [...playlists[selectedPlaylist]];
  if (shuffleMode) {
    playlistOrder = shuffleArray(songIds);
  } else {
    playlistOrder = songIds;
  }
  playlistIndex = -1;
}

function shuffleArray(arr) {
  let a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

createPlaylistBtn.onclick = async () => {
  const name = playlistNameInput.value.trim();
  if (!name) {
    showStatus('Enter a name for your playlist!', false);
    return;
  }
  const res = await fetch('/playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (res.ok) {
    playlistNameInput.value = '';
    await loadPlaylists();
    showStatus('Playlist created!', true);
  } else {
    showStatus('Playlist already exists or error.', false);
  }
};

deletePlaylistBtn.onclick = async () => {
  if (!selectedPlaylist) return;
  if (!confirm(`Delete playlist "${selectedPlaylist}"?`)) return;
  const res = await fetch('/delete-playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlist: selectedPlaylist })
  });
  if (res.ok) {
    selectedPlaylist = null;
    resetPlaylistOrder();
    await loadPlaylists();
    renderSongs();
    showStatus('Playlist deleted!', true);
  } else {
    showStatus('Could not delete playlist.', false);
  }
};

// --- QUEUE LOGIC ---
function setQueue(songArr, startIdx = 0, queueName = "") {
  currentQueue = songArr;
  queuePointer = startIdx;
  playQueueSong(queueName);
}

function playQueueSong(queueName = "") {
  if (!currentQueue.length || queuePointer < 0 || queuePointer >= currentQueue.length) {
    audioPlayer.src = "";
    nowPlayingTitle.textContent = "No song playing";
    queueStatus.textContent = "";
    return;
  }
  const song = currentQueue[queuePointer];
  audioPlayer.src = `/song/${encodeURIComponent(song.id)}`;
  audioPlayer.play();
  nowPlayingTitle.textContent = song.name;
  nowPlayingArt.style.backgroundImage = 'url("https://img.icons8.com/color/96/000000/musical-notes.png")';
  nowPlayingArt.style.display = "inline-block";
  queueStatus.textContent = queueName
    ? `Playlist: ${queueName} (#${queuePointer + 1} of ${currentQueue.length})`
    : `Queue: Song #${queuePointer + 1} of ${currentQueue.length}`;
  if (!songDurationsCache[song.id]) {
    audioPlayer.onloadedmetadata = function() {
      songDurationsCache[song.id] = audioPlayer.duration;
      renderSongs();
      renderPlaylistSongs();
    };
  }
}

nextBtn.onclick = () => {
  if (queuePointer < currentQueue.length - 1) {
    queuePointer++;
    playQueueSong(selectedPlaylist);
  }
};
prevBtn.onclick = () => {
  if (queuePointer > 0) {
    queuePointer--;
    playQueueSong(selectedPlaylist);
  }
};

audioPlayer.addEventListener('ended', () => {
  if (queuePointer < currentQueue.length - 1) {
    queuePointer++;
    playQueueSong(selectedPlaylist);
  }
});

// MULTI UPLOAD SUPPORT with PROGRESS BAR
uploadBtn.onclick = async () => {
  const files = uploadInput.files;
  if (!files || files.length === 0) {
    showStatus('Choose file(s) first!', false);
    return;
  }
  uploadBtn.disabled = true;
  showStatus('Uploading...', true);

  if (uploadProgress) {
    uploadProgress.style.display = 'block';
    uploadProgress.value = 0;
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('songs', files[i]);
  }

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload', true);

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable && uploadProgress) {
      const percent = Math.round((e.loaded / e.total) * 100);
      uploadProgress.value = percent;
      uploadStatus.textContent = `Uploading... ${percent}%`;
      uploadStatus.className = "success";
    }
  };

  xhr.onload = async function () {
    uploadBtn.disabled = false;
    if (uploadProgress) uploadProgress.style.display = 'none';
    if (xhr.status === 200) {
      await loadSongs();
      showStatus('Upload successful!', true);
      uploadInput.value = '';
    } else {
      showStatus('Upload failed.', false);
    }
  };

  xhr.onerror = function () {
    uploadBtn.disabled = false;
    if (uploadProgress) uploadProgress.style.display = 'none';
    showStatus('Upload failed.', false);
  };

  xhr.send(formData);
};

window.onload = async () => {
  await loadSongs();
  await loadPlaylists();
  renderPlaylistControls();
};

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (audioPlayer.src) {
        if (audioPlayer.paused) audioPlayer.play();
        else audioPlayer.pause();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (queuePointer < currentQueue.length - 1) {
        queuePointer++;
        playQueueSong(selectedPlaylist);
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (queuePointer > 0) {
        queuePointer--;
        playQueueSong(selectedPlaylist);
      }
      break;
  }
});