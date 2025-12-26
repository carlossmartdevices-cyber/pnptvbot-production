/**
 * Materialious App - Modern Material Design Invidious Client
 */

const API_BASE = '/api/materialious';

class MaterialiousApp {
  constructor() {
    this.currentPlayer = null;
    this.searchQuery = '';
    this.isDarkTheme = localStorage.getItem('theme') === 'dark';
    this.init();
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
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new MaterialiousApp();
});
