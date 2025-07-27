class MuzikApp {
    constructor() {
        this.currentSong = null;
        this.currentPlaylist = null;
        this.queue = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isShuffle = false;
        this.isRepeat = false;
        this.volume = 0.7;
        this.allSongs = [];
        this.playlists = {};
        this.isLoading = false;
        
        // Modal references
        this.currentPromptModal = null;
        this.currentConfirmModal = null;
        this.currentPromptCallback = null;
        this.currentConfirmCallback = null;
        this.currentSelectedSong = null;
        this.currentSongForPlaylist = null;
        this.searchTimeout = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.createCustomModals();
        this.loadData();
    }

    initializeElements() {
        // Audio & Player Elements
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.muteBtn = document.getElementById('muteBtn');
        
        // Progress Elements
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.progressHandle = document.getElementById('progressHandle');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        
        // Song Info Elements (NEW PLAYER BAR)
        this.currentSongTitle = document.getElementById('currentSongTitle');
        this.currentSongArtist = document.getElementById('currentSongArtist');
        this.currentSongArt = document.getElementById('currentSongArt');
        
        // UI Elements
        this.globalSearch = document.getElementById('globalSearch');
        this.songsContainer = document.getElementById('songsContainer');
        this.playlistsGrid = document.getElementById('playlistsGrid');
        this.statusMessage = document.getElementById('statusMessage');
        
        // Upload Elements
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressFillUpload = document.getElementById('progressFillUpload');
        this.progressText = document.getElementById('progressText');
        
        // Playlist Elements
        this.playlistModal = document.getElementById('playlistModal');
        this.playlistModalTitle = document.getElementById('playlistModalTitle');
        this.playlistSongs = document.getElementById('playlistSongs');
        this.newPlaylistName = document.getElementById('newPlaylistName');
        this.createPlaylistBtn = document.getElementById('createPlaylistBtn');
        this.shuffleAllBtn = document.getElementById('shuffleAllBtn');
        
        console.log('✅ All elements initialized successfully');
    }

    setupEventListeners() {
        // **FIXED NAVIGATION** - No more delays!
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.switchPageImmediate(page);
            });
        });

        // Player Controls
        this.playPauseBtn?.addEventListener('click', () => this.togglePlay());
        this.nextBtn?.addEventListener('click', () => this.nextSong());
        this.prevBtn?.addEventListener('click', () => this.prevSong());
        this.shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
        this.repeatBtn?.addEventListener('click', () => this.toggleRepeat());
        this.shuffleAllBtn?.addEventListener('click', () => this.shuffleAllSongs());

        // Volume Controls
        this.volumeSlider?.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        this.muteBtn?.addEventListener('click', () => this.toggleMute());

        // Progress Bar
        this.progressBar?.addEventListener('click', (e) => this.seekTo(e));
        
        // Audio Events
        this.audioPlayer?.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audioPlayer?.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer?.addEventListener('ended', () => this.onSongEnd());

        // Search
        this.globalSearch?.addEventListener('input', (e) => this.searchSongs(e.target.value));

        // Upload Events
        this.fileInput?.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
        this.uploadArea?.addEventListener('click', () => this.fileInput?.click());
        this.uploadArea?.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea?.addEventListener('drop', (e) => this.handleDrop(e));

        // Playlist Events
        this.createPlaylistBtn?.addEventListener('click', () => this.createPlaylist());
        this.newPlaylistName?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createPlaylist();
        });

        // Modal Events
        const deleteBtn = document.getElementById('deletePlaylistBtn');
        const renameBtn = document.getElementById('renamePlaylistBtn');
        const shufflePlaylistBtn = document.getElementById('shufflePlaylistBtn');
        
        deleteBtn?.addEventListener('click', () => this.deleteCurrentPlaylist());
        renameBtn?.addEventListener('click', () => this.renameCurrentPlaylist());
        shufflePlaylistBtn?.addEventListener('click', () => this.shuffleCurrentPlaylist());

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Close modals on outside click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('custom-modal') || e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        console.log('✅ All event listeners setup successfully');
    }

    // **HELPER FUNCTION FOR AUDIO DURATION**
    async getAudioDuration(songId) {
        return new Promise((resolve) => {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            
            audio.onloadedmetadata = function() {
                const duration = audio.duration;
                if (isNaN(duration) || !isFinite(duration)) {
                    resolve('3:45'); // Fallback
                    return;
                }
                const minutes = Math.floor(duration / 60);
                const seconds = Math.floor(duration % 60);
                const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                resolve(formattedTime);
            };
            
            audio.onerror = function() {
                resolve('3:45'); // Fallback duration
            };
            
            // Set timeout to prevent hanging
            setTimeout(() => resolve('3:45'), 5000);
            
            audio.src = `/song/${encodeURIComponent(songId)}`;
        });
    }

    // **INSTANT PAGE SWITCHING** - No more delays!
    switchPageImmediate(page) {
        if (this.isLoading) return;
        
        try {
            // Remove active class from all pages and nav buttons
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            
            // Add active class to selected page and nav button
            const targetPage = document.getElementById(`${page}Page`);
            const targetBtn = document.querySelector(`[data-page="${page}"]`);
            
            if (targetPage && targetBtn) {
                targetPage.classList.add('active');
                targetBtn.classList.add('active');
                
                // Show immediate status
                this.showStatusImmediate(page);
                
                // Load data asynchronously without blocking UI
                setTimeout(() => this.loadPageData(page), 50);
            }
        } catch (error) {
            console.error('Navigation error:', error);
            this.showStatus('Navigation error occurred', 'error');
        }
    }

    showStatusImmediate(page) {
        const messages = {
            'home': '🏠 Home - All your fire tracks! 🔥',
            'playlists': '🎵 Collections - Your street playlists! 📁',
            'upload': '⬆️ Upload - Add new beats! 🎤'
        };
        
        this.showStatus(messages[page] || '🎵 Ready to rock!', 'success');
    }

    async loadPageData(page) {
        try {
            switch(page) {
                case 'home':
                    if (this.allSongs.length === 0) {
                        await this.loadSongs();
                    }
                    break;
                case 'playlists':
                    if (Object.keys(this.playlists).length === 0) {
                        await this.loadPlaylists();
                    }
                    break;
                case 'upload':
                    // Upload page doesn't need data loading
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${page} data:`, error);
        }
    }

    async loadData() {
        this.isLoading = true;
        try {
            console.log('🔄 Loading app data...');
            
            // Load data in parallel for faster startup
            const [songsResult, playlistsResult] = await Promise.allSettled([
                this.loadSongs(),
                this.loadPlaylists()
            ]);
            
            if (songsResult.status === 'rejected') {
                console.warn('Songs loading failed:', songsResult.reason);
            }
            if (playlistsResult.status === 'rejected') {
                console.warn('Playlists loading failed:', playlistsResult.reason);
            }
            
            this.showStatus('🔥 STREET APP LOADED - READY TO DROP BEATS! 🎤', 'success');
        } catch (error) {
            console.error('Error loading app data:', error);
            this.showStatus('App loaded with some issues - but ready to rock! 🎵', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async loadSongs() {
        try {
            const response = await fetch('/songs');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.allSongs = await response.json();
            this.renderSongs();
            console.log(`✅ Loaded ${this.allSongs.length} songs`);
        } catch (error) {
            console.error('Error loading songs:', error);
            this.allSongs = []; // Fallback to empty array
            this.renderSongs();
            // Don't show error for missing server - app should work offline
        }
    }

    async loadPlaylists() {
        try {
            const response = await fetch('/playlists');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.playlists = await response.json();
            this.renderPlaylists();
            console.log(`✅ Loaded ${Object.keys(this.playlists).length} playlists`);
        } catch (error) {
            console.error('Error loading playlists:', error);
            this.playlists = {}; // Fallback to empty object
            this.renderPlaylists();
            // Don't show error for missing server - app should work offline
        }
    }

    showStatus(message, type = 'success') {
        if (!this.statusMessage) return;
        
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (this.statusMessage) {
                this.statusMessage.className = 'status-message';
            }
        }, 3000);
    }

    renderSongs(songs = this.allSongs) {
        if (!this.songsContainer) return;
        
        // Show loading state for better UX
        this.songsContainer.innerHTML = '<div class="loading-state">🎵 Loading tracks...</div>';
        
        // Use setTimeout to prevent UI blocking
        setTimeout(() => {
            this.songsContainer.innerHTML = '';
            
            if (songs.length === 0) {
                this.songsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-microphone-alt" style="font-size: 64px; color: #FF4444; margin-bottom: 24px;"></i>
                        <h3 style="color: #FFF; margin-bottom: 16px;">No beats found! 🔥</h3>
                        <p style="color: #666;">Upload some fire tracks to get started!</p>
                        <button class="btn btn-neon" onclick="app.switchPageImmediate('upload')" style="margin-top: 20px;">
                            <i class="fas fa-upload"></i> UPLOAD TRACKS
                        </button>
                    </div>
                `;
                return;
            }

            // Render songs in batches to prevent UI freezing
            this.renderSongsInBatches(songs);
        }, 10);
    }

    renderSongsInBatches(songs, batchSize = 10, startIndex = 0) {
        const endIndex = Math.min(startIndex + batchSize, songs.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const songCard = this.createSongCard(songs[i], i, songs);
            this.songsContainer.appendChild(songCard);
        }
        
        // Continue rendering next batch
        if (endIndex < songs.length) {
            setTimeout(() => {
                this.renderSongsInBatches(songs, batchSize, endIndex);
            }, 5);
        }
    }

    createSongCard(song, index, songList) {
        const card = document.createElement('div');
        card.className = 'song-card';
        
        // Create initial card with placeholder duration
        card.innerHTML = `
            <div class="song-art">
                <i class="fas fa-microphone-alt"></i>
                <div class="play-overlay">
                    <i class="fas fa-play"></i>
                </div>
            </div>
            <div class="song-info">
                <div class="song-title">${this.escapeHtml(song.name)}</div>
                <div class="song-artist">Street Artist 🎤</div>
                <div class="song-duration" id="duration-${song.id}">⏱️</div>
            </div>
            <div class="song-actions">
                <button class="play-btn btn-action" title="Drop the beat" data-action="play">
                    <i class="fas fa-play"></i>
                </button>
                <button class="add-btn btn-action" title="Add to collection" data-action="add">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="options-btn btn-action" title="More options" data-action="options">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
            </div>
        `;

        // Load real duration asynchronously
        this.getAudioDuration(song.id).then(duration => {
            const durationElement = document.getElementById(`duration-${song.id}`);
            if (durationElement) {
                durationElement.textContent = duration;
            }
        }).catch(() => {
            // If duration fails to load, keep placeholder
            const durationElement = document.getElementById(`duration-${song.id}`);
            if (durationElement) {
                durationElement.textContent = '3:45';
            }
        });

        // **OPTIMIZED EVENT LISTENERS** - Single listener with delegation
        card.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            e.stopPropagation();
            
            switch(action) {
                case 'play':
                    this.playSong(song, songList, index);
                    break;
                case 'add':
                    this.showAddToPlaylistMenu(song);
                    break;
                case 'options':
                    this.showSongOptions(song);
                    break;
                default:
                    // Double click to play
                    if (e.detail === 2) {
                        this.playSong(song, songList, index);
                    }
            }
        });

        return card;
    }

    renderPlaylists() {
        if (!this.playlistsGrid) return;
        
        // Show loading state
        this.playlistsGrid.innerHTML = '<div class="loading-state">🔥 Loading collections...</div>';
        
        setTimeout(() => {
            this.playlistsGrid.innerHTML = '';
            
            const playlistNames = Object.keys(this.playlists);
            
            if (playlistNames.length === 0) {
                this.playlistsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-fire" style="font-size: 64px; color: #00FF88; margin-bottom: 24px;"></i>
                        <h3 style="color: #FFF; margin-bottom: 16px;">No collections yet! 🎵</h3>
                        <p style="color: #666;">Create your first street playlist!</p>
                        <div style="margin-top: 20px;">
                            <input type="text" placeholder="Collection name..." style="padding: 12px; border-radius: 8px; border: none; margin-right: 10px; background: rgba(255,255,255,0.1); color: white;" id="quickPlaylistName">
                            <button class="btn btn-neon" onclick="app.createQuickPlaylist()">
                                <i class="fas fa-plus"></i> CREATE
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            playlistNames.forEach(name => {
                const playlistCard = this.createPlaylistCard(name);
                this.playlistsGrid.appendChild(playlistCard);
            });
        }, 10);
    }

    createPlaylistCard(name) {
        const card = document.createElement('div');
        card.className = 'playlist-card';
        const songCount = this.playlists[name]?.length || 0;
        
        card.innerHTML = `
            <div class="playlist-art">
                <i class="fas fa-fire"></i>
                <div class="playlist-overlay">
                    <span class="track-count">${songCount}</span>
                </div>
            </div>
            <div class="playlist-info">
                <h3>${this.escapeHtml(name)}</h3>
                <p>${songCount} street track${songCount !== 1 ? 's' : ''} 🔥</p>
            </div>
            <div class="playlist-actions">
                <button class="btn-quick-play" title="Quick play">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `;

        // **FAST CLICK HANDLERS**
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-quick-play')) {
                e.stopPropagation();
                this.quickPlayPlaylist(name);
            } else {
                this.openPlaylistModal(name);
            }
        });

        return card;
    }

    quickPlayPlaylist(playlistName) {
        const songIds = this.playlists[playlistName] || [];
        const songs = songIds.map(id => this.allSongs.find(song => song.id === id)).filter(Boolean);
        
        if (songs.length === 0) {
            this.showStatus('This collection is empty! 🎵', 'error');
            return;
        }
        
        this.playSong(songs[0], songs, 0);
        this.showStatus(`🔥 Playing "${playlistName}" collection! 🎤`, 'success');
    }

    createQuickPlaylist() {
        const nameInput = document.getElementById('quickPlaylistName');
        const name = nameInput?.value.trim();
        
        if (!name) {
            this.showStatus('Enter a collection name! 📝', 'error');
            return;
        }
        
        this.newPlaylistName.value = name;
        this.createPlaylist();
        if (nameInput) nameInput.value = '';
    }

    renderPlaylistSongs(songs) {
        if (!this.playlistSongs) return;
        
        this.playlistSongs.innerHTML = '<div class="loading-state">🎵 Loading tracks...</div>';
        
        setTimeout(() => {
            this.playlistSongs.innerHTML = '';
            
            if (songs.length === 0) {
                this.playlistSongs.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-microphone-alt" style="font-size: 48px; color: #FF4444; margin-bottom: 16px;"></i>
                        <p style="color: #666;">This collection is empty. Add some fire tracks! 🔥</p>
                        <button class="btn btn-outline" onclick="app.closePlaylistModal(); app.switchPageImmediate('home');">
                            <i class="fas fa-plus"></i> ADD TRACKS
                        </button>
                    </div>
                `;
                return;
            }
            
            songs.forEach((song, index) => {
                const songCard = this.createPlaylistSongCard(song, index, songs);
                this.playlistSongs.appendChild(songCard);
            });
        }, 10);
    }

    createPlaylistSongCard(song, index, songList) {
        const card = document.createElement('div');
        card.className = 'song-card playlist-song-card';
        card.innerHTML = `
            <div class="song-number">${(index + 1).toString().padStart(2, '0')}</div>
            <div class="song-art">
                <i class="fas fa-microphone-alt"></i>
            </div>
            <div class="song-info">
                <div class="song-title">${this.escapeHtml(song.name)}</div>
                <div class="song-artist">Street Artist 🎤</div>
            </div>
            <div class="song-actions">
                <button class="play-btn btn-action" title="Drop the beat" data-action="play">
                    <i class="fas fa-play"></i>
                </button>
                <button class="remove-btn btn-action" title="Remove from collection" data-action="remove">
                    <i class="fas fa-minus"></i>
                </button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            e.stopPropagation();
            
            switch(action) {
                case 'play':
                    this.playSong(song, songList, index);
                    break;
                case 'remove':
                    this.removeFromPlaylist(song.id);
                    break;
                default:
                    if (e.detail === 2) {
                        this.playSong(song, songList, index);
                    }
            }
        });

        return card;
    }

    // **UTILITY FUNCTIONS**
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoadingState(container, message = 'Loading...') {
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    // **SEARCH FUNCTIONALITY**
    searchSongs(query) {
        // Clear any existing search timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search to prevent excessive filtering
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300);
    }

    performSearch(query) {
        if (!query.trim()) {
            this.renderSongs();
            return;
        }
        
        const filteredSongs = this.allSongs.filter(song =>
            song.name.toLowerCase().includes(query.toLowerCase())
        );
        
        this.renderSongs(filteredSongs);
        
        if (filteredSongs.length === 0) {
            this.showStatus(`No tracks found for "${query}" 🔍`, 'error');
        } else {
            this.showStatus(`Found ${filteredSongs.length} track(s) for "${query}" 🎵`, 'success');
        }
    }

    // **MODAL FUNCTIONS**
    openPlaylistModal(playlistName) {
        this.currentPlaylist = playlistName;
        this.playlistModalTitle.textContent = `${playlistName} 🔥`;
        
        const songIds = this.playlists[playlistName] || [];
        const songs = songIds.map(id => this.allSongs.find(song => song.id === id)).filter(Boolean);
        
        this.renderPlaylistSongs(songs);
        this.playlistModal.classList.add('active');
        
        // Add modal backdrop
        document.body.style.overflow = 'hidden';
    }

    closePlaylistModal() {
        this.playlistModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    showAddToPlaylistMenu(song) {
        const playlistNames = Object.keys(this.playlists);
        if (playlistNames.length === 0) {
            this.showStatus('Create a collection first! 🎵', 'error');
            return;
        }
        
        this.currentSongForPlaylist = song;
        const playlistOptions = document.getElementById('playlistOptions');
        playlistOptions.innerHTML = '';
        
        playlistNames.forEach(name => {
            const option = document.createElement('div');
            option.className = 'option-btn';
            option.innerHTML = `
                <i class="fas fa-fire" style="color: #00FF88;"></i>
                <span>${this.escapeHtml(name)}</span>
                <small style="color: #666;">${this.playlists[name].length} tracks</small>
            `;
            option.onclick = () => this.addToPlaylistFromModal(song.id, name);
            playlistOptions.appendChild(option);
        });
        
        this.playlistSelectModal.classList.add('active');
    }

    showSongOptions(song) {
        this.currentSelectedSong = song;
        document.getElementById('songOptionsTitle').textContent = `"${song.name}" Options`;
        this.songOptionsModal.classList.add('active');
    }

    // **CUSTOM MODALS CREATION**
    createCustomModals() {
        // Create song options modal
        this.songOptionsModal = document.createElement('div');
        this.songOptionsModal.className = 'custom-modal';
        this.songOptionsModal.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h3 id="songOptionsTitle">Track Options</h3>
                    <button class="close-btn" onclick="app.closeSongOptions()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="custom-modal-body">
                    <div class="option-btn" onclick="app.handleSongOption('delete')">
                        <i class="fas fa-trash" style="color: #FF4444;"></i>
                        <span>Delete Track</span>
                    </div>
                    <div class="option-btn" onclick="app.handleSongOption('rename')">
                        <i class="fas fa-edit" style="color: #00FF88;"></i>
                        <span>Rename Track</span>
                    </div>
                    <div class="option-btn" onclick="app.handleSongOption('info')">
                        <i class="fas fa-info-circle" style="color: #4FC3F7;"></i>
                        <span>Track Info</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.songOptionsModal);

        // Create playlist selection modal
        this.playlistSelectModal = document.createElement('div');
        this.playlistSelectModal.className = 'custom-modal';
        this.playlistSelectModal.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h3>Add to Collection</h3>
                    <button class="close-btn" onclick="app.closePlaylistSelect()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="custom-modal-body">
                    <div id="playlistOptions"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.playlistSelectModal);

        console.log('✅ Custom modals created successfully');
    }

    // **CUSTOM PROMPT AND CONFIRM MODALS**
    showCustomPrompt(title, placeholder, defaultValue, callback) {
        const promptModal = document.createElement('div');
        promptModal.className = 'custom-modal active';
        promptModal.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="custom-modal-body">
                    <input type="text" id="promptInput" placeholder="${placeholder}" value="${defaultValue}" 
                           class="rename-input">
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-outline" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                        <button class="btn btn-neon" onclick="app.handlePromptResponse('${callback}')">OK</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(promptModal);
        document.getElementById('promptInput').focus();
        this.currentPromptModal = promptModal;
        this.currentPromptCallback = callback;
    }

    showCustomConfirm(message, callback) {
        const confirmModal = document.createElement('div');
        confirmModal.className = 'custom-modal active';
        confirmModal.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h3>Confirm Action</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="custom-modal-body">
                    <p style="color: white; margin-bottom: 20px; line-height: 1.5;">${message}</p>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-outline" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.handleConfirmResponse('${callback}')">Confirm</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        this.currentConfirmModal = confirmModal;
        this.currentConfirmCallback = callback;
    }

    handlePromptResponse(callbackName) {
        const input = document.getElementById('promptInput');
        const value = input?.value.trim();
        
        if (this.currentPromptModal) {
            this.currentPromptModal.remove();
            this.currentPromptModal = null;
        }
        
        // Execute the callback based on the function name
        switch(callbackName) {
            case 'renameSong':
                if (value && this.currentSelectedSong) {
                    this.executeRenameSong(this.currentSelectedSong, value);
                }
                break;
            case 'renamePlaylist':
                if (value && this.currentPlaylist) {
                    this.executeRenamePlaylist(this.currentPlaylist, value);
                }
                break;
        }
    }

    handleConfirmResponse(callbackName) {
        if (this.currentConfirmModal) {
            this.currentConfirmModal.remove();
            this.currentConfirmModal = null;
        }
        
        // Execute the callback based on the function name
        switch(callbackName) {
            case 'deleteSong':
                if (this.currentSelectedSong) {
                    this.executeDeleteSong(this.currentSelectedSong);
                }
                break;
            case 'deletePlaylist':
                if (this.currentPlaylist) {
                    this.executeDeletePlaylist(this.currentPlaylist);
                }
                break;
        }
    }

    // **MODAL HANDLERS**
    addToPlaylistFromModal(songId, playlistName) {
        this.closePlaylistSelect();
        this.addToPlaylist(songId, playlistName);
    }

    handleSongOption(action) {
        this.closeSongOptions();
        
        switch(action) {
            case 'delete':
                this.deleteSong(this.currentSelectedSong);
                break;
            case 'rename':
                this.renameSong(this.currentSelectedSong);
                break;
            case 'info':
                this.showSongInfo(this.currentSelectedSong);
                break;
        }
    }

    // **MODAL CLOSE FUNCTIONS**
    closeSongOptions() {
        this.songOptionsModal.classList.remove('active');
    }

    closePlaylistSelect() {
        this.playlistSelectModal.classList.remove('active');
    }

    closeAllModals() {
        this.closeSongOptions();
        this.closePlaylistSelect();
        this.closePlaylistModal();
        
        // Remove any custom modals
        document.querySelectorAll('.custom-modal.active').forEach(modal => {
            modal.remove();
        });
    }

    // **SONG MANAGEMENT FUNCTIONS (UPDATED WITH CUSTOM MODALS)**
    async deleteSong(song) {
        this.currentSelectedSong = song;
        this.showCustomConfirm(
            `Delete "${song.name}" permanently? This cannot be undone!`, 
            'deleteSong'
        );
    }

    async renameSong(song) {
        this.currentSelectedSong = song;
        this.showCustomPrompt(
            'Rename Track', 
            'Enter new track name...', 
            song.name, 
            'renameSong'
        );
    }

    showSongInfo(song) {
        // Create info modal dynamically
        const infoModal = document.createElement('div');
        infoModal.className = 'custom-modal active';
        infoModal.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h3>"${this.escapeHtml(song.name)}" Info 🎵</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="custom-modal-body">
                    <div style="color: white; line-height: 2;">
                        <p><strong>🎤 Track:</strong> ${this.escapeHtml(song.name)}</p>
                        <p><strong>🎨 Artist:</strong> Street Artist</p>
                        <p><strong>📁 File ID:</strong> ${song.id}</p>
                        <p><strong>🔥 Status:</strong> Ready to drop beats!</p>
                        <p><strong>⏱️ Duration:</strong> <span id="info-duration">Loading...</span></p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(infoModal);
        
        // Load duration for info
        this.getAudioDuration(song.id).then(duration => {
            const durationSpan = document.getElementById('info-duration');
            if (durationSpan) durationSpan.textContent = duration;
        });
    }

    // **EXECUTION FUNCTIONS FOR SONG MANAGEMENT**

async executeDeleteSong(song) {
    try {
        console.log('🗑️ Deleting song:', song.id);
        
        const response = await fetch('/delete-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId: song.id }) // Changed to match server expectation
        });
        
        const result = await response.json();
        
        if (response.ok) {
            await this.loadSongs();
            await this.loadPlaylists();
            this.showStatus(`🗑️ "${song.name}" deleted from the streets!`, 'success');
        } else {
            throw new Error(result.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting song:', error);
        this.showStatus(`Failed to delete track: ${error.message}`, 'error');
    }
}

async executeRenameSong(song, newName) {
    try {
        console.log('✏️ Renaming song:', song.id, 'to:', newName);
        
        const response = await fetch('/rename-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                songId: song.id,  // Changed to match server expectation
                newName: newName
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            await this.loadSongs();
            this.showStatus(`✏️ Track renamed to "${newName}"!`, 'success');
        } else {
            throw new Error(result.error || 'Rename failed');
        }
    } catch (error) {
        console.error('Error renaming song:', error);
        this.showStatus(`Failed to rename track: ${error.message}`, 'error');
    }
}


    // **MUSIC PLAYER FUNCTIONS**
    playSong(song, playlist = [song], index = 0) {
        this.currentSong = song;
        this.queue = playlist;
        this.currentIndex = index;
        
        this.audioPlayer.src = `/song/${encodeURIComponent(song.id)}`;
        this.audioPlayer.volume = this.volume;
        
        this.updateNowPlaying();
        this.play();
        this.showStatus(`🎤 Now dropping: "${song.name}" 🔥`, 'success');
    }

    updateNowPlaying() {
        if (!this.currentSong) return;
        
        if (this.currentSongTitle) this.currentSongTitle.textContent = this.currentSong.name;
        if (this.currentSongArtist) this.currentSongArtist.textContent = 'Street Artist 🎤';
        if (this.currentSongArt) this.currentSongArt.innerHTML = '<i class="fas fa-microphone-alt"></i>';
    }

    async play() {
        try {
            await this.audioPlayer.play();
            this.isPlaying = true;
            if (this.playPauseBtn) this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } catch (error) {
            console.error('Error playing song:', error);
            this.showStatus('Error dropping the beat', 'error');
        }
    }

    pause() {
        this.audioPlayer.pause();
        this.isPlaying = false;
        if (this.playPauseBtn) this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    nextSong() {
        if (this.queue.length === 0) return;
        
        if (this.isShuffle) {
            this.currentIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            this.currentIndex = (this.currentIndex + 1) % this.queue.length;
        }
        
        this.playSong(this.queue[this.currentIndex], this.queue, this.currentIndex);
    }

    prevSong() {
        if (this.queue.length === 0) return;
        
        if (this.isShuffle) {
            this.currentIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.queue.length - 1;
        }
        
        this.playSong(this.queue[this.currentIndex], this.queue, this.currentIndex);
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        if (this.shuffleBtn) this.shuffleBtn.classList.toggle('active', this.isShuffle);
        this.showStatus(`Shuffle ${this.isShuffle ? 'ON - Random vibes! 🔀' : 'OFF - Sequential flow'}`, 'success');
    }

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;
        if (this.repeatBtn) this.repeatBtn.classList.toggle('active', this.isRepeat);
        this.showStatus(`Repeat ${this.isRepeat ? 'ON - Loop mode activated! 🔁' : 'OFF - Natural flow'}`, 'success');
    }

    shuffleAllSongs() {
        if (this.allSongs.length === 0) {
            this.showStatus('No tracks to shuffle! Upload some beats first 🎵', 'error');
            return;
        }
        
        const shuffledSongs = [...this.allSongs].sort(() => Math.random() - 0.5);
        this.playSong(shuffledSongs[0], shuffledSongs, 0);
        this.showStatus('🔥 SHUFFLING ALL STREET TRACKS - LET THE CHAOS BEGIN! 🎤', 'success');
    }

    setVolume(volume) {
        this.volume = volume;
        this.audioPlayer.volume = volume;
        
        if (!this.muteBtn) return;
        
        if (volume === 0) {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (volume < 0.5) {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            this.muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    toggleMute() {
        if (this.audioPlayer.volume > 0) {
            this.audioPlayer.volume = 0;
            if (this.volumeSlider) this.volumeSlider.value = 0;
            if (this.muteBtn) this.muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else {
            this.audioPlayer.volume = this.volume;
            if (this.volumeSlider) this.volumeSlider.value = this.volume * 100;
            this.setVolume(this.volume);
        }
    }

    seekTo(event) {
        if (!this.progressBar || !this.audioPlayer.duration) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        const time = percent * this.audioPlayer.duration;
        this.audioPlayer.currentTime = time;
    }

    updateProgress() {
        if (!this.audioPlayer.duration || !this.progressFill) return;
        
        const percent = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        this.progressFill.style.width = `${percent}%`;
        if (this.progressHandle) {
            this.progressHandle.style.left = `${percent}%`;
        }
        
        if (this.currentTime) {
            this.currentTime.textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    updateDuration() {
        if (this.audioPlayer.duration && this.totalTime) {
            this.totalTime.textContent = this.formatTime(this.audioPlayer.duration);
            
            // Also update the current song's duration in the list
            if (this.currentSong) {
                const durationElement = document.getElementById(`duration-${this.currentSong.id}`);
                if (durationElement) {
                    durationElement.textContent = this.formatTime(this.audioPlayer.duration);
                }
            }
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    onSongEnd() {
        if (this.isRepeat) {
            this.play();
        } else if (this.queue.length > 1) {
            this.nextSong();
        } else {
            this.showStatus('Queue finished! Add more tracks to keep the vibe going 🎵', 'success');
        }
    }

    // **UPLOAD FUNCTIONALITY**
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        if (this.uploadProgress) this.uploadProgress.style.display = 'block';
        if (this.progressText) this.progressText.textContent = 'Uploading fire tracks...';
        
        const formData = new FormData();
        for (const file of files) {
            formData.append('songs', file);
        }
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                await this.loadSongs();
                this.showStatus(`🔥 Successfully uploaded ${files.length} street track(s)! Ready to drop beats! 🎤`, 'success');
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showStatus('Upload failed. Check your connection and try again.', 'error');
        } finally {
            if (this.uploadProgress) this.uploadProgress.style.display = 'none';
            if (this.fileInput) this.fileInput.value = '';
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        if (this.uploadArea) this.uploadArea.classList.add('dragover');
    }

    handleDrop(event) {
        event.preventDefault();
        if (this.uploadArea) this.uploadArea.classList.remove('dragover');
        this.handleFileUpload(event.dataTransfer.files);
    }

    // **PLAYLIST FUNCTIONALITY**
    async createPlaylist() {
        const name = this.newPlaylistName?.value.trim();
        if (!name) {
            this.showStatus('Enter a name for your street collection! 📝', 'error');
            return;
        }
        
        try {
            const response = await fetch('/playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            
            if (response.ok) {
                await this.loadPlaylists();
                if (this.newPlaylistName) this.newPlaylistName.value = '';
                this.showStatus(`🔥 Collection "${name}" created! Time to add some fire tracks! 🎵`, 'success');
            } else {
                const error = await response.json();
                this.showStatus(error.error || 'Failed to create collection', 'error');
            }
        } catch (error) {
            console.error('Error creating playlist:', error);
            this.showStatus('Failed to create collection', 'error');
        }
    }

    async addToPlaylist(songId, playlistName) {
        try {
            const response = await fetch('/add-to-playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playlist: playlistName,
                    songId: songId
                })
            });
            
            if (response.ok) {
                await this.loadPlaylists();
                this.showStatus(`Added to "${playlistName}" collection! 🎵`, 'success');
            } else {
                this.showStatus('Failed to add to collection', 'error');
            }
        } catch (error) {
            console.error('Error adding to playlist:', error);
            this.showStatus('Failed to add to collection', 'error');
        }
    }

    async removeFromPlaylist(songId) {
        try {
            const response = await fetch('/remove-from-playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playlist: this.currentPlaylist,
                    songId: songId
                })
            });
            
            if (response.ok) {
                await this.loadPlaylists();
                this.openPlaylistModal(this.currentPlaylist);
                this.showStatus('Track removed from collection! 🗑️', 'success');
            }
        } catch (error) {
            console.error('Error removing song:', error);
            this.showStatus('Failed to remove track', 'error');
        }
    }

    async deleteCurrentPlaylist() {
        this.showCustomConfirm(
            `Delete "${this.currentPlaylist}" collection? This cannot be undone!`, 
            'deletePlaylist'
        );
    }

    async renameCurrentPlaylist() {
        this.showCustomPrompt(
            'Rename Collection', 
            'Enter new collection name...', 
            this.currentPlaylist, 
            'renamePlaylist'
        );
    }

    async executeDeletePlaylist(playlistName) {
        try {
            const response = await fetch('/delete-playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlist: playlistName })
            });
            
            if (response.ok) {
                await this.loadPlaylists();
                this.closePlaylistModal();
                this.showStatus(`"${playlistName}" collection deleted from the streets! 🗑️`, 'success');
            }
        } catch (error) {
            console.error('Error deleting playlist:', error);
            this.showStatus('Failed to delete collection', 'error');
        }
    }

    async executeRenamePlaylist(oldName, newName) {
        try {
            const response = await fetch('/rename-playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldName: oldName,
                    newName: newName
                })
            });
            
            if (response.ok) {
                await this.loadPlaylists();
                this.currentPlaylist = newName;
                this.openPlaylistModal(newName);
                this.showStatus(`Collection renamed to "${newName}"! ✏️`, 'success');
            }
        } catch (error) {
            console.error('Error renaming playlist:', error);
            this.showStatus('Failed to rename collection', 'error');
        }
    }

    shuffleCurrentPlaylist() {
        const songIds = this.playlists[this.currentPlaylist] || [];
        const songs = songIds.map(id => this.allSongs.find(song => song.id === id)).filter(Boolean);
        
        if (songs.length === 0) {
            this.showStatus('No tracks to shuffle in this collection! 🎵', 'error');
            return;
        }
        
        const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
        this.playSong(shuffledSongs[0], shuffledSongs, 0);
        this.closePlaylistModal();
        this.showStatus(`🔥 SHUFFLING "${this.currentPlaylist}" - STREET CHAOS ACTIVATED! 🎤`, 'success');
    }

    // **KEYBOARD SHORTCUTS**
    handleKeyboard(event) {
        if (event.target.tagName === 'INPUT') return;
        
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextSong();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.prevSong();
                break;
            case 'KeyS':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.toggleShuffle();
                }
                break;
            case 'KeyR':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.toggleRepeat();
                }
                break;
            case 'Escape':
                this.closeAllModals();
                break;
        }
    }
}

// **APP INITIALIZATION**
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MuzikApp();
    console.log('🔥 STREET MUZIK APP INITIALIZED - READY TO DROP BEATS! 🎤');
});