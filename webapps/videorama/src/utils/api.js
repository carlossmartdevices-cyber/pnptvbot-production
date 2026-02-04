// API utilities for Videorama
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

export async function fetchMediaLibrary(type = 'all', category = null) {
  try {
    let url = `${API_BASE}/media/library?type=${type}`;
    if (category) url += `&category=${category}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch media');
    return await response.json();
  } catch (error) {
    console.error('Error fetching media library:', error);
    return [];
  }
}

export async function fetchPlaylists() {
  try {
    const response = await fetch(`${API_BASE}/media/playlists`);
    if (!response.ok) throw new Error('Failed to fetch playlists');
    return await response.json();
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return [];
  }
}

export async function fetchRadioNowPlaying() {
  try {
    const response = await fetch(`${API_BASE}/radio/now-playing`);
    if (!response.ok) throw new Error('Failed to fetch now playing');
    return await response.json();
  } catch (error) {
    console.error('Error fetching radio now playing:', error);
    return null;
  }
}

export async function fetchCategories() {
  try {
    const response = await fetch(`${API_BASE}/media/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return ['music', 'podcast', 'videos', 'live'];
  }
}

export async function fetchCollections() {
  try {
    const response = await fetch(`${API_BASE}/videorama/collections`);
    if (!response.ok) throw new Error('Failed to fetch collections');
    const data = await response.json();
    return data.collections || []
  } catch (error) {
    console.error('Error fetching videorama collections:', error);
    return [];
  }
}

export function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token'),
    uid: params.get('uid'),
    view: params.get('view') || 'home',
    mediaId: params.get('id'),
    role: params.get('role') || '',
    isPrime: params.get('prime') === 'true' || params.get('isPrime') === 'true',
  };
}
