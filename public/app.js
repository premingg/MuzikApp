const uploadInput = document.getElementById('uploadInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
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

let allSongs = [];
let playlists = {};
let selectedPlaylist = null;
let playlistOrder = [];
let playlistIndex = -1;
let shuffleMode = false;
let allSongsOrder = [];
let allSongsIndex = -1;
let playingFromAllSongs = false;

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

function renderSongs() {
  songsUl.innerHTML = '';
  allSongsOrder = allSongs.map(song => song.id);
  allSongs.forEach((song, idx) => {
    const li = document.createElement('li');
    li.className = "song-card";
    li.innerHTML = `
      <div class="card-main">
        <div class="song-album-art"></div>
        <div>
          <span class="song-title">${song.name}</span>
          <div class="song-actions">
            <button class="icon-btn play-btn" title="Play">&#9654;</button>
            <button class="icon-btn rename-btn" title="Rename">&#9998;</button>
            <button class="icon-btn delete-btn" title="Delete">&#128465;</button>
            ${selectedPlaylist ? '<button class="icon-btn add-btn" title="Add to Playlist">&#43;</button>' : ''}
          </div>
        </div>
      </div>
    `;
    // Use encodeURIComponent for audio src!
    li.querySelector('.play-btn').onclick = () => playSong(song, false, idx);
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
    if (selectedPlaylist && li.querySelector('.add-btn')) {
      li.querySelector('.add-btn').onclick = async () => {
        const res = await fetch('/add-to-playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlist: selectedPlaylist, songId: song.id })
        });
        if (res.ok) {
          await loadPlaylists();
          showStatus('Added to playlist!', true);
        } else {
          showStatus('Could not add.', false);
        }
      };
    }
    songsUl.appendChild(li);
  });
}

function renderPlaylists() {
  playlistsUl.innerHTML = '';
  Object.keys(playlists).forEach(name => {
    const li = document.createElement('li');
    li.className = selectedPlaylist === name ? 'playlist-card selected-playlist' : 'playlist-card';
    li.innerHTML = `
      <span class="playlist-name">${name}</span>
      <button class="icon-btn select-btn">${selectedPlaylist === name ? '✓' : '→'}</button>
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
    const li = document.createElement('li');
    li.className = "song-card";
    li.innerHTML = `
      <div class="card-main">
        <div class="song-album-art"></div>
        <div>
          <span class="song-title">${song.name}</span>
          <div class="song-actions">
            <button class="icon-btn play-btn" title="Play">&#9654;</button>
            <button class="icon-btn remove-btn" title="Remove from Playlist">&#8722;</button>
          </div>
        </div>
      </div>
    `;
    li.querySelector('.play-btn').onclick = () => playSong(song, true, idx);
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

// Fisher-Yates shuffle
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

function playSong(song, fromPlaylist = false, idxInList = 0) {
  // Use encodeURIComponent for src!
  audioPlayer.src = `/song/${encodeURIComponent(song.id)}`;
  audioPlayer.play();
  if (nowPlayingTitle) nowPlayingTitle.textContent = song.name;
  if (nowPlayingArt) {
    nowPlayingArt.style.backgroundImage = 'url("https://img.icons8.com/color/96/000000/musical-notes.png")';
    nowPlayingArt.style.display = "inline-block";
  }
  if (fromPlaylist) {
    playingFromAllSongs = false;
    playlistIndex = shuffleMode
      ? playlistOrder.findIndex(id => id === song.id)
      : idxInList;
  } else {
    playingFromAllSongs = true;
    allSongsIndex = idxInList;
  }
}

// Autoplay next song in playlist or all songs when audio ends
audioPlayer.addEventListener('ended', () => {
  if (selectedPlaylist && playlistOrder.length > 0 && playlistIndex !== -1 && !playingFromAllSongs) {
    const nextIdx = playlistIndex + 1;
    if (nextIdx < playlistOrder.length) {
      const nextSongId = playlistOrder[nextIdx];
      const nextSong = allSongs.find(s => s.id === nextSongId);
      if (nextSong) {
        playSong(nextSong, true, nextIdx);
      }
    }
    return;
  }
  if (playingFromAllSongs && allSongsOrder.length > 0 && allSongsIndex !== -1) {
    const nextIdx = allSongsIndex + 1;
    if (nextIdx < allSongsOrder.length) {
      const nextSongId = allSongsOrder[nextIdx];
      const nextSong = allSongs.find(s => s.id === nextSongId);
      if (nextSong) {
        playSong(nextSong, false, nextIdx);
      }
    }
  }
});

// MULTI UPLOAD SUPPORT
uploadBtn.onclick = async () => {
  const files = uploadInput.files;
  if (!files || files.length === 0) {
    showStatus('Choose file(s) first!', false);
    return;
  }
  uploadBtn.disabled = true;
  showStatus('Uploading...', true);
  const formData = new FormData();
  // Append all files for multi-upload, use "songs" as the field name for the array
  for (let i = 0; i < files.length; i++) {
    formData.append('songs', files[i]);
  }
  const res = await fetch('/upload', { method: 'POST', body: formData });
  uploadBtn.disabled = false;
  if (res.ok) {
    await loadSongs();
    showStatus('Upload successful!', true);
    uploadInput.value = '';
  } else {
    showStatus('Upload failed.', false);
  }
};

window.onload = async () => {
  await loadSongs();
  await loadPlaylists();
  renderPlaylistControls();
};

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ignore if typing in an input or textarea
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
      if (selectedPlaylist && playlistOrder.length > 0 && playlistIndex !== -1 && !playingFromAllSongs) {
        const nextIdx = playlistIndex + 1;
        if (nextIdx < playlistOrder.length) {
          const nextSongId = playlistOrder[nextIdx];
          const nextSong = allSongs.find(s => s.id === nextSongId);
          if (nextSong) playSong(nextSong, true, nextIdx);
        }
      } else if (playingFromAllSongs && allSongsOrder.length > 0 && allSongsIndex !== -1) {
        const nextIdx = allSongsIndex + 1;
        if (nextIdx < allSongsOrder.length) {
          const nextSongId = allSongsOrder[nextIdx];
          const nextSong = allSongs.find(s => s.id === nextSongId);
          if (nextSong) playSong(nextSong, false, nextIdx);
        }
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (selectedPlaylist && playlistOrder.length > 0 && playlistIndex > 0 && !playingFromAllSongs) {
        const prevIdx = playlistIndex - 1;
        if (prevIdx >= 0) {
          const prevSongId = playlistOrder[prevIdx];
          const prevSong = allSongs.find(s => s.id === prevSongId);
          if (prevSong) playSong(prevSong, true, prevIdx);
        }
      } else if (playingFromAllSongs && allSongsOrder.length > 0 && allSongsIndex > 0) {
        const prevIdx = allSongsIndex - 1;
        if (prevIdx >= 0) {
          const prevSongId = allSongsOrder[prevIdx];
          const prevSong = allSongs.find(s => s.id === prevSongId);
          if (prevSong) playSong(prevSong, false, prevIdx);
        }
      }
      break;
  }
});
