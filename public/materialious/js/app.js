/**
 * Materialious App - Modern Material Design Invidious Client
 */

const API_BASE = '/api/materialious';
const PLAYLIST_API_BASE = '/api/playlists';

class MaterialiousApp {
  constructor() {
    this.currentPlayer = null;
    this.searchQuery = '';
    this.isDarkTheme = localStorage.getItem('theme') === 'dark';
    this.userId = this.getUserId();
    this.currentVideoForPlaylist = null;
    this.userPlaylists = [];
    this.init();
  }

  getUserId() {
    // Get or create a user ID (stored in localStorage)
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', userId);
    }
    return userId;
  }

  init() {
    this.setupTheme();
    this.setupEventListeners();
    this.loadTrendingVideos();
  }

  setupTheme() {
    if (this.isDarkTheme) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }

  setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const tabs = document.querySelectorAll('.tab');

    searchBtn.addEventListener('click', () => this.search());
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.search();
    });

    // Tabs
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Playlist event listeners
    document.getElementById('createPlaylistBtn').addEventListener('click', () => {
      this.showCreatePlaylistModal();
    });

    document.getElementById('cancelPlaylistBtn').addEventListener('click', () => {
      this.hideCreatePlaylistModal();
    });

    document.getElementById('savePlaylistBtn').addEventListener('click', () => {
      this.createPlaylist();
    });

    document.getElementById('closeAddToPlaylistBtn').addEventListener('click', () => {
      this.hideAddToPlaylistModal();
    });

    // Close modals when clicking outside
    document.getElementById('createPlaylistModal').addEventListener('click', (e) => {
      if (e.target.id === 'createPlaylistModal') {
        this.hideCreatePlaylistModal();
      }
    });

    document.getElementById('addToPlaylistModal').addEventListener('click', (e) => {
      if (e.target.id === 'addToPlaylistModal') {
        this.hideAddToPlaylistModal();
      }
    });
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');

    if (this.isDarkTheme) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Load playlists when switching to playlists tab
    if (tabName === 'playlists') {
      this.loadPlaylists();
    }
  }

  search() {
    const searchInput = document.getElementById('searchInput');
    this.searchQuery = searchInput.value.trim();

    if (!this.searchQuery) {
      alert('Please enter a search query');
      return;
    }

    this.switchTab('search');
    this.loadSearchResults();
  }

  async loadTrendingVideos() {
    const grid = document.getElementById('trendingGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const response = await fetch(`${API_BASE}/trending`);
      if (!response.ok) throw new Error('Failed to fetch trending videos');

      const videos = await response.json();
      grid.innerHTML = '';

      if (videos.length === 0) {
        grid.innerHTML = '<p>No videos found</p>';
        return;
      }

      videos.forEach((video) => {
        const card = this.createVideoCard(video);
        grid.appendChild(card);
      });
    } catch (error) {
      console.error('Error loading trending videos:', error);
      grid.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
  }

  async loadSearchResults() {
    const grid = document.getElementById('searchGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const response = await fetch(
        `${API_BASE}/search?q=${encodeURIComponent(this.searchQuery)}`
      );
      if (!response.ok) throw new Error('Failed to search videos');

      const videos = await response.json();
      grid.innerHTML = '';

      if (videos.length === 0) {
        grid.innerHTML = '<p>No results found</p>';
        return;
      }

      videos.forEach((video) => {
        const card = this.createVideoCard(video);
        grid.appendChild(card);
      });
    } catch (error) {
      console.error('Error loading search results:', error);
      grid.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
  }

  createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => this.playVideo(video);

    const thumbnail = document.createElement('div');
    thumbnail.className = 'video-thumbnail';

    const img = document.createElement('img');
    img.src = video.videoThumbnails?.[0]?.url || video.thumbnail || '';
    img.alt = video.title;
    thumbnail.appendChild(img);

    if (video.lengthSeconds) {
      const duration = document.createElement('div');
      duration.className = 'video-duration';
      duration.textContent = this.formatDuration(video.lengthSeconds);
      thumbnail.appendChild(duration);
    }

    // Add to playlist button
    const menuBtn = document.createElement('div');
    menuBtn.className = 'video-card-menu';
    menuBtn.innerHTML = '<span class="material-icons">playlist_add</span>';
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      this.showAddToPlaylistModal(video);
    };
    thumbnail.appendChild(menuBtn);

    const info = document.createElement('div');
    info.className = 'video-info';

    const title = document.createElement('div');
    title.className = 'video-title';
    title.textContent = video.title;
    info.appendChild(title);

    const author = document.createElement('div');
    author.className = 'video-author';
    author.textContent = video.author || 'Unknown Channel';
    info.appendChild(author);

    const stats = document.createElement('div');
    stats.className = 'video-stats';

    if (video.viewCount) {
      const views = document.createElement('span');
      views.textContent = `${this.formatViews(video.viewCount)} views`;
      stats.appendChild(views);
    }

    if (video.publishedText) {
      const published = document.createElement('span');
      published.textContent = video.publishedText;
      stats.appendChild(published);
    }

    info.appendChild(stats);
    card.appendChild(thumbnail);
    card.appendChild(info);

    return card;
  }

  async playVideo(video) {
    // Create player container
    const existingPlayer = document.querySelector('.player-container');
    if (existingPlayer) {
      existingPlayer.remove();
    }

    const playerContainer = document.createElement('div');
    playerContainer.className = 'player-container';

    // Get working Invidious instance from backend
    let invidiousInstance = 'https://invidious.io'; // Default fallback
    try {
      const statusResponse = await fetch(`${API_BASE}/instance-status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.instance) {
          invidiousInstance = status.instance;
        }
      }
    } catch (error) {
      console.warn('Failed to get working instance, using default:', error);
    }

    const playerHTML = `
      <div class="video-player" id="videoPlayer">
        <iframe
          width="100%"
          height="100%"
          src="${invidiousInstance}/embed/${video.videoId}?autoplay=1"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      <div class="player-info">
        <div class="player-title">${this.escapeHtml(video.title)}</div>
        <div class="player-author" onclick="app.searchChannel('${video.author}')">${this.escapeHtml(
          video.author || 'Unknown Channel'
        )}</div>
        <div class="player-stats">
          <span>${this.formatViews(video.viewCount || 0)} views</span>
          <span>${video.publishedText || ''}</span>
        </div>
        <div class="player-description">${this.escapeHtml(
          video.description || 'No description available'
        )}</div>
      </div>
    `;

    playerContainer.innerHTML = playerHTML;

    const container = document.querySelector('.container');
    container.insertBefore(playerContainer, container.firstChild);

    // Scroll to player
    playerContainer.scrollIntoView({ behavior: 'smooth' });
  }

  searchChannel(channelName) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = `channel:${channelName}`;
    this.search();
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  formatViews(count) {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Playlist Methods

  async loadPlaylists() {
    const grid = document.getElementById('playlistGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const response = await fetch(`${PLAYLIST_API_BASE}/public`);
      if (!response.ok) throw new Error('Failed to fetch playlists');

      const playlists = await response.json();

      // Also try to load user's personal playlists
      try {
        const userResponse = await fetch(`${PLAYLIST_API_BASE}/user?userId=${this.userId}`);
        if (userResponse.ok) {
          const userPlaylists = await userResponse.json();
          this.userPlaylists = userPlaylists;
          playlists.unshift(...userPlaylists);
        }
      } catch (error) {
        console.warn('Could not load user playlists:', error);
      }

      grid.innerHTML = '';

      if (playlists.length === 0) {
        grid.innerHTML = '<p>No playlists found. Create your first playlist!</p>';
        return;
      }

      playlists.forEach((playlist) => {
        const card = this.createPlaylistCard(playlist);
        grid.appendChild(card);
      });
    } catch (error) {
      console.error('Error loading playlists:', error);
      grid.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
  }

  createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.className = 'playlist-card';

    const name = document.createElement('div');
    name.className = 'playlist-name';
    name.textContent = playlist.name;
    card.appendChild(name);

    if (playlist.description) {
      const desc = document.createElement('div');
      desc.style.fontSize = '14px';
      desc.style.color = 'var(--text-secondary)';
      desc.style.marginBottom = '8px';
      desc.textContent = playlist.description;
      card.appendChild(desc);
    }

    const info = document.createElement('div');
    info.className = 'playlist-info';
    info.innerHTML = `
      <span>${playlist.mediaItems?.length || 0} videos</span>
      <span>${playlist.isPublic ? 'Public' : 'Private'}</span>
    `;
    card.appendChild(info);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'playlist-actions';

    const playBtn = document.createElement('button');
    playBtn.innerHTML = '<span class="material-icons" style="font-size: 14px;">play_arrow</span> Play';
    playBtn.onclick = (e) => {
      e.stopPropagation();
      alert('Playlist playback coming soon!');
    };
    actions.appendChild(playBtn);

    // Only show delete for user's own playlists
    if (playlist.userId === this.userId) {
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '<span class="material-icons" style="font-size: 14px;">delete</span> Delete';
      deleteBtn.style.backgroundColor = '#d32f2f';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deletePlaylist(playlist.id);
      };
      actions.appendChild(deleteBtn);
    }

    card.appendChild(actions);

    return card;
  }

  showCreatePlaylistModal() {
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistDescription').value = '';
    document.getElementById('playlistPublic').checked = false;
    document.getElementById('createPlaylistModal').classList.add('active');
  }

  hideCreatePlaylistModal() {
    document.getElementById('createPlaylistModal').classList.remove('active');
  }

  async createPlaylist() {
    const name = document.getElementById('playlistName').value.trim();
    const description = document.getElementById('playlistDescription').value.trim();
    const isPublic = document.getElementById('playlistPublic').checked;

    if (!name) {
      alert('Please enter a playlist name');
      return;
    }

    try {
      const response = await fetch(`${PLAYLIST_API_BASE}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId,
        },
        body: JSON.stringify({
          userId: this.userId,
          name,
          description,
          isPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create playlist');
      }

      const playlist = await response.json();
      console.log('Playlist created:', playlist);

      this.hideCreatePlaylistModal();
      this.loadPlaylists();
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('Failed to create playlist. Please try again.');
    }
  }

  async showAddToPlaylistModal(video) {
    this.currentVideoForPlaylist = video;

    // Load user playlists first
    try {
      const response = await fetch(`${PLAYLIST_API_BASE}/user?userId=${this.userId}`);
      if (response.ok) {
        this.userPlaylists = await response.json();
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    }

    const listContainer = document.getElementById('playlistSelectionList');
    listContainer.innerHTML = '';

    if (this.userPlaylists.length === 0) {
      listContainer.innerHTML = '<p>No playlists yet. Create one first!</p>';
    } else {
      this.userPlaylists.forEach((playlist) => {
        const item = document.createElement('div');
        item.style.padding = '12px';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${playlist.name} (${playlist.mediaItems?.length || 0} videos)`;
        item.appendChild(nameSpan);

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.style.padding = '4px 12px';
        addBtn.onclick = () => this.addVideoToPlaylist(playlist.id, video.videoId);
        item.appendChild(addBtn);

        listContainer.appendChild(item);
      });
    }

    document.getElementById('addToPlaylistModal').classList.add('active');
  }

  hideAddToPlaylistModal() {
    document.getElementById('addToPlaylistModal').classList.remove('active');
    this.currentVideoForPlaylist = null;
  }

  async addVideoToPlaylist(playlistId, videoId) {
    try {
      const response = await fetch(`${PLAYLIST_API_BASE}/${playlistId}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        throw new Error('Failed to add video to playlist');
      }

      alert('Video added to playlist!');
      this.hideAddToPlaylistModal();
      this.loadPlaylists();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      alert('Failed to add video to playlist. Please try again.');
    }
  }

  async deletePlaylist(playlistId) {
    if (!confirm('Are you sure you want to delete this playlist?')) {
      return;
    }

    try {
      const response = await fetch(`${PLAYLIST_API_BASE}/${playlistId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete playlist');
      }

      alert('Playlist deleted successfully!');
      this.loadPlaylists();
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert('Failed to delete playlist. Please try again.');
    }
  }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new MaterialiousApp();
});
