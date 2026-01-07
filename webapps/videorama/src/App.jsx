import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Film,
  Link2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  PlayCircle,
  X,
  Sparkles,
  Play,
  Copy,
  Music2,
  Mic2,
  Star,
} from 'lucide-react'
import { loadItems, saveItems } from './lib/storage'
import { getPublicPlaylists, uploadPodcastAudio, uploadVideoramaVideo } from './lib/api'
import { parseYouTubeUrl, tryYouTubeTitle } from './lib/youtube'
import PlayerSheet from './components/PlayerSheet'
import { OFFICIAL_VIDEORAMA } from './lib/videoramaCatalog'
import { TELEGRAM_POST_BILINGUAL } from './lib/telegramPost'
import { loadPodcasts, savePodcasts } from './lib/podcastStorage'
import { getTelegramCreator } from './lib/userContext'
import { DEFAULT_FEATURED, loadFeaturedVideoramas, saveFeaturedVideoramas } from './lib/featuredVideoramas'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function normalizeKeyPart(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function dedupePlaylists(playlists) {
  const seen = new Set()
  const out = []
  for (const p of playlists || []) {
    const key = [normalizeKeyPart(p.category), normalizeKeyPart(p.title), normalizeKeyPart(p.creator)].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

function formatBytes(bytes) {
  const n = Number(bytes || 0)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const v = n / (1024 ** idx)
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[idx]}`
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="iconBtn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('categories')
  const [items, setItems] = useState(() => loadItems())
  const [podcasts, setPodcasts] = useState(() => loadPodcasts())
  const [query, setQuery] = useState('')
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playerTitle, setPlayerTitle] = useState('')
  const [playerQueue, setPlayerQueue] = useState([])
  const [playerStartIndex, setPlayerStartIndex] = useState(0)
  const [playerMode, setPlayerMode] = useState('full')

  const [openAddLink, setOpenAddLink] = useState(false)
  const [openAddUpload, setOpenAddUpload] = useState(false)
  const [openTelegramPost, setOpenTelegramPost] = useState(false)
  const [toast, setToast] = useState('')
  const [openCreateVideorama, setOpenCreateVideorama] = useState(false)

  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDesc, setLinkDesc] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)

  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const uploadAbortRef = useRef(null)

  const [openAddPodcast, setOpenAddPodcast] = useState(false)
  const [podcastFile, setPodcastFile] = useState(null)
  const [podcastTitle, setPodcastTitle] = useState('')
  const [podcastDesc, setPodcastDesc] = useState('')
  const [podcastBusy, setPodcastBusy] = useState(false)
  const [podcastProgress, setPodcastProgress] = useState(null)
  const podcastAbortRef = useRef(null)

  const [publicPlaylists, setPublicPlaylists] = useState([])
  const [publicLoading, setPublicLoading] = useState(false)
  const [publicError, setPublicError] = useState('')

  const [createVideoramaTitle, setCreateVideoramaTitle] = useState('')
  const [createVideoramaDesc, setCreateVideoramaDesc] = useState('')

  const [featured, setFeatured] = useState(() => {
    const stored = loadFeaturedVideoramas()
    return [...DEFAULT_FEATURED, ...stored].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  })

  const tgCreator = useMemo(() => getTelegramCreator(), [])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    saveItems(items)
  }, [items])

  useEffect(() => {
    savePodcasts(podcasts)
  }, [podcasts])

  useEffect(() => {
    // Persist only user-created featured videoramas (exclude defaults)
    const defaultIds = new Set(DEFAULT_FEATURED.map((v) => v.id))
    const userCreated = (featured || []).filter((v) => !defaultIds.has(v.id))
    saveFeaturedVideoramas(userCreated)
  }, [featured])

  useEffect(() => {
    if (tab !== 'music') return
    let mounted = true
    setPublicLoading(true)
    setPublicError('')
    getPublicPlaylists(30)
      .then((data) => {
        if (!mounted) return
        setPublicPlaylists(dedupePlaylists(Array.isArray(data) ? data : []))
      })
      .catch((e) => {
        if (!mounted) return
        setPublicError(e?.message || 'Failed to load playlists')
        setPublicPlaylists([])
      })
      .finally(() => {
        if (!mounted) return
        setPublicLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [tab])

  function openQueue({ title, queue, startIndex = 0, mode = 'full' }) {
    setPlayerTitle(title || 'Videorama')
    setPlayerQueue(queue || [])
    setPlayerStartIndex(startIndex)
    setPlayerMode(mode)
    setPlayerOpen(true)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice().sort((a, b) => b.createdAt - a.createdAt)
    return items
      .filter((it) => `${it.title} ${it.url} ${it.description}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [items, query])

  const podcastFiltered = useMemo(() => {
    return podcasts.slice().sort((a, b) => b.createdAt - a.createdAt)
  }, [podcasts])

  async function submitLink() {
    const url = String(linkUrl || '').trim()
    if (!url) return

    setLinkBusy(true)
    try {
      let title = String(linkTitle || '').trim()
      const yt = parseYouTubeUrl(url)
      if (!title && yt?.kind === 'video') {
        const t = await tryYouTubeTitle(url)
        if (t) title = t
      }
      if (!title) title = yt?.kind === 'playlist' ? 'YouTube playlist' : 'YouTube video'
      const next = {
        id: crypto.randomUUID(),
        title,
        url,
        kind: 'link',
        createdAt: Date.now(),
        description: String(linkDesc || '').trim(),
      }
      setItems((prev) => [next, ...prev])
      setOpenAddLink(false)
      setLinkUrl('')
      setLinkTitle('')
      setLinkDesc('')
      setTab('my')
    } finally {
      setLinkBusy(false)
    }
  }

  async function submitUpload() {
    const file = uploadFile
    if (!file) return

    const title = String(uploadTitle || '').trim()
    const safeTitle = title || (file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Upload')

    setUploadBusy(true)
    setUploadProgress({ pct: 0, loaded: 0, total: file.size })

    const controller = new AbortController()
    uploadAbortRef.current = controller

    try {
      const info = await uploadVideoramaVideo(file, {
        signal: controller.signal,
        onProgress: (p) => setUploadProgress(p),
      })

      const url = String(info?.url || '').trim()
      if (!url) throw new Error('Upload succeeded but no URL returned')

      const next = {
        id: crypto.randomUUID(),
        title: safeTitle,
        url,
        kind: 'upload',
        createdAt: Date.now(),
        description: String(uploadDesc || '').trim(),
      }

      setItems((prev) => [next, ...prev])
      setOpenAddUpload(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadDesc('')
      setUploadProgress(null)
      setTab('my')
    } finally {
      setUploadBusy(false)
      uploadAbortRef.current = null
    }
  }

  function cancelUpload() {
    try {
      uploadAbortRef.current?.abort()
    } catch {
      // ignore
    }
  }

  async function submitPodcast() {
    const file = podcastFile
    if (!file) return

    const title = String(podcastTitle || '').trim()
    const safeTitle = title || (file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'Podcast')

    setPodcastBusy(true)
    setPodcastProgress({ pct: 0, loaded: 0, total: file.size })

    const controller = new AbortController()
    podcastAbortRef.current = controller

    try {
      const info = await uploadPodcastAudio(file, {
        signal: controller.signal,
        onProgress: (p) => setPodcastProgress(p),
      })

      const url = String(info?.url || '').trim()
      if (!url) throw new Error('Upload succeeded but no URL returned')

      const next = {
        id: crypto.randomUUID(),
        title: safeTitle,
        url,
        kind: 'audio',
        createdAt: Date.now(),
        description: String(podcastDesc || '').trim(),
      }

      setPodcasts((prev) => [next, ...prev])
      setOpenAddPodcast(false)
      setPodcastFile(null)
      setPodcastTitle('')
      setPodcastDesc('')
      setPodcastProgress(null)
      setTab('podcasts')
    } finally {
      setPodcastBusy(false)
      podcastAbortRef.current = null
    }
  }

  function cancelPodcastUpload() {
    try {
      podcastAbortRef.current?.abort()
    } catch {
      // ignore
    }
  }

  function openFeaturedVideorama(videorama) {
    openQueue({
      title: videorama?.creator ? `${videorama.title} — by ${videorama.creator}` : videorama?.title,
      queue: videorama?.tracks || [],
      startIndex: 0,
      mode: 'focus',
    })
  }

  function startCreateVideorama() {
    setCreateVideoramaTitle('')
    setCreateVideoramaDesc('')
    setOpenCreateVideorama(true)
  }

  function createVideoramaFromMyMix({ title, description }) {
    const normalizedTitle = String(title || '').trim() || 'Untitled Videorama'
    const creator = tgCreator || 'Anonymous'
    const tracks = items
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map((t) => ({ ...t }))

    const next = {
      id: crypto.randomUUID(),
      title: normalizedTitle,
      category: 'Featured Videoramas',
      creator,
      description: String(description || '').trim(),
      tracks,
      createdAt: Date.now(),
    }

    setFeatured((prev) => [next, ...(prev || [])])
    setOpenCreateVideorama(false)
    setToast('Videorama created')
    setTab('videorama')
  }

  async function copyTelegramPost() {
    try {
      await navigator.clipboard.writeText(TELEGRAM_POST_BILINGUAL)
      setToast('Copied')
    } catch {
      setToast('Copy failed')
    }
  }

  return (
    <div className="app">
      <div className="bg" />

      <header className="header">
        <div className="brand">
          <div className="brandMark">
            <Sparkles size={18} />
          </div>
          <div className="brandText">
            <div className="brandName">PNPtv Videorama</div>
            <div className="brandTag">Categories • Featured • Podcasts</div>
          </div>
        </div>

        <div className="headerActions">
          {tab === 'videorama' ? (
            <>
              <button
                className="btn"
                onClick={() => openQueue({ title: 'Videorama', queue: OFFICIAL_VIDEORAMA, startIndex: 0, mode: 'focus' })}
              >
                <Play size={18} /> Play Videorama
              </button>
              <button className="btn btnGhost" onClick={() => setOpenTelegramPost(true)}>
                <Copy size={18} /> Post
              </button>
            </>
          ) : tab === 'podcasts' ? (
            <>
              <button
                className="btn"
                onClick={() => openQueue({ title: 'Podcasts', queue: podcastFiltered, startIndex: 0 })}
                disabled={podcastFiltered.length === 0}
              >
                <Play size={18} /> Play All
              </button>
              <button className="btn btnGhost" onClick={() => setOpenAddPodcast(true)}>
                <Mic2 size={18} /> Upload
              </button>
            </>
          ) : tab === 'my' ? (
            <>
              <button className="btn btnGhost" onClick={() => setOpenAddLink(true)}>
                <Link2 size={18} /> Link
              </button>
              <button className="btn" onClick={() => setOpenAddUpload(true)}>
                <UploadCloud size={18} /> Upload
              </button>
            </>
          ) : (
            null
          )}
        </div>
      </header>

      <main className="main">
        <div className="tabs">
          <button className={cx('tab', tab === 'categories' && 'active')} onClick={() => setTab('categories')}>
            <Sparkles size={18} /> Categories
          </button>
          <button className={cx('tab', tab === 'music' && 'active')} onClick={() => setTab('music')}>
            <Music2 size={18} /> PNP Music
          </button>
          <button className={cx('tab', tab === 'videorama' && 'active')} onClick={() => setTab('videorama')}>
            <Star size={18} /> Featured
          </button>
          <button className={cx('tab', tab === 'podcasts' && 'active')} onClick={() => setTab('podcasts')}>
            <Mic2 size={18} /> Podcasts
          </button>
          <button className={cx('tab', tab === 'my' && 'active')} onClick={() => setTab('my')}>
            <Film size={18} /> My Mix
          </button>
        </div>

        {tab === 'categories' ? (
          <>
            <div className="hero">
              <div className="heroTitle">PNPtv Categories</div>
              <div className="heroText">Choose a lane: music, featured videoramas, or podcasts.</div>
            </div>

            <div className="grid">
              <button className="card cardBtn" onClick={() => setTab('music')}>
                <div className="cardTop">
                  <div className="pill">Category</div>
                  <div className="pill subtle">PNP Music</div>
                </div>
                <div className="cardTitle">PNP Music / Música para Viciosos</div>
                <div className="cardDesc">Colecciones, links y playlists curadas para viciosos.</div>
              </button>

              <button className="card cardBtn" onClick={() => setTab('videorama')}>
                <div className="cardTop">
                  <div className="pill">Category</div>
                  <div className="pill subtle">Featured</div>
                </div>
                <div className="cardTitle">Featured Videoramas</div>
                <div className="cardDesc">Play full sequences back‑to‑back with the curator’s text.</div>
              </button>

              <button className="card cardBtn" onClick={() => setTab('podcasts')}>
                <div className="cardTop">
                  <div className="pill">Category</div>
                  <div className="pill subtle">Podcasts</div>
                </div>
                <div className="cardTitle">Podcasts by PNP putxs</div>
                <div className="cardDesc">Uploads + playback. Keep it raw, personal, and PNPtv.</div>
              </button>
            </div>
          </>
        ) : null}

        {tab === 'music' ? (
          <>
            <div className="hero">
              <div className="heroTitle">PNP Music / Música para Viciosos</div>
              <div className="heroText">Browse curated playlists. (No preview — open the full collections.)</div>
              <div className="heroActions">
                <a className="btn" href="/music-collections" target="_blank" rel="noreferrer">
                  <Music2 size={18} /> Open Music Collections
                </a>
              </div>
            </div>

            {publicLoading ? <div className="notice">Loading playlists…</div> : null}
            {publicError ? <div className="notice error">{publicError}</div> : null}

            <div className="grid">
              {publicPlaylists.map((p) => (
                <div key={p.id} className="card">
                  <div className="cardTop">
                    <div className="pill">Playlist</div>
                    <div className="pill subtle">{p.videoCount || 0} items</div>
                  </div>
                  <div className="cardTitle">{p.title || 'Untitled playlist'}</div>
                  {p.description ? <div className="cardDesc">{p.description}</div> : null}
                  <div className="cardActions">
                    <a className="btn btnSmall btnGhost" href="/music-collections" target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'videorama' ? (
          <>
            <div className="hero">
              <div className="heroTitle">Featured Videoramas</div>
              <div className="heroText">Play featured sequences back‑to‑back. New creations are credited to your Telegram username.</div>
              <div className="heroActions">
                <button
                  className="btn"
                  onClick={() => openFeaturedVideorama(DEFAULT_FEATURED[0])}
                >
                  <Play size={18} /> Play Videorama
                </button>
                <button className="btn btnGhost" onClick={() => setOpenTelegramPost(true)}>
                  <Copy size={18} /> Post para Telegram
                </button>
                <button className="btn btnGhost" onClick={startCreateVideorama}>
                  <Plus size={18} /> Create
                </button>
              </div>
            </div>

            <div className="grid">
              {featured.map((v) => (
                <div key={v.id} className="card">
                  <div className="cardTop">
                    <div className="pill">Videorama</div>
                    <button className="btn btnSmall" onClick={() => openFeaturedVideorama(v)}>
                      <PlayCircle size={18} /> Play
                    </button>
                  </div>
                  <div className="cardTitle">{v.title}</div>
                  {v.creator ? <div className="cardSub">by {v.creator}</div> : null}
                  {v.description ? <div className="cardDesc">{v.description}</div> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'podcasts' ? (
          <>
            <div className="hero">
              <div className="heroTitle">Podcasts by PNP putxs</div>
              <div className="heroText">Upload and play episodes. Tap “Play All” for back‑to‑back.</div>
              <div className="heroActions">
                <button
                  className="btn"
                  onClick={() => openQueue({ title: 'Podcasts', queue: podcastFiltered, startIndex: 0 })}
                  disabled={podcastFiltered.length === 0}
                >
                  <Play size={18} /> Play All
                </button>
                <button className="btn btnGhost" onClick={() => setOpenAddPodcast(true)}>
                  <Mic2 size={18} /> Upload Podcast
                </button>
              </div>
            </div>

            {podcastFiltered.length === 0 ? (
              <div className="empty">
                <div className="emptyTitle">No podcasts yet</div>
                <div className="emptyText">Upload your first episode and it’ll show up here.</div>
                <div className="emptyActions">
                  <button className="btn" onClick={() => setOpenAddPodcast(true)}>
                    <Mic2 size={18} /> Upload Podcast
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid">
                {podcastFiltered.map((it) => (
                  <div key={it.id} className="card">
                    <div className="cardTop">
                      <div className="pill">Podcast</div>
                      <button
                        className="iconBtn danger"
                        onClick={() => setPodcasts((prev) => prev.filter((x) => x.id !== it.id))}
                        aria-label="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="cardTitle">{it.title}</div>
                    {it.description ? <div className="cardDesc">{it.description}</div> : null}
                    <div className="cardActions">
                      <button className="btn btnSmall" onClick={() => openQueue({ title: it.title, queue: [it], startIndex: 0 })}>
                        <PlayCircle size={18} /> Play
                      </button>
                      <a className="btn btnSmall btnGhost" href={it.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {tab === 'my' ? (
          <>
            <div className="searchRow">
              <div className="search">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles, links, notes…"
                  inputMode="search"
                />
              </div>
              <button className="iconBtn" onClick={() => setOpenAddLink(true)} aria-label="Add">
                <Plus size={20} />
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="empty">
                <div className="emptyTitle">Start your Videorama</div>
                <div className="emptyText">Add a YouTube link or upload a video and it’ll show up here.</div>
                <div className="emptyActions">
                  <button className="btn btnGhost" onClick={() => setOpenAddLink(true)}>
                    <Link2 size={18} /> Add link
                  </button>
                  <button className="btn" onClick={() => setOpenAddUpload(true)}>
                    <UploadCloud size={18} /> Upload
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid">
                {filtered.map((it) => (
                  <div key={it.id} className="card">
                    <div className="cardTop">
                      <div className="pill">{it.kind === 'upload' ? 'Upload' : 'YouTube'}</div>
                      <button
                        className="iconBtn danger"
                        onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                        aria-label="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="cardTitle">{it.title}</div>
                    <div className="cardSub">{it.url}</div>
                    {it.description ? <div className="cardDesc">{it.description}</div> : null}
                    <div className="cardActions">
                      <button
                        className="btn btnSmall"
                        onClick={() => openQueue({ title: 'My Mix', queue: [it], startIndex: 0 })}
                      >
                        <PlayCircle size={18} /> Play
                      </button>
                      <a className="btn btnSmall btnGhost" href={it.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>

      <footer className="footer">
        <a className="footerLink" href="/terms?lang=en" target="_blank" rel="noreferrer">
          Policies
        </a>
      </footer>

      <PlayerSheet
        open={playerOpen}
        title={playerTitle}
        queue={playerQueue}
        startIndex={playerStartIndex}
        mode={playerMode}
        onClose={() => setPlayerOpen(false)}
      />

      <Modal
        open={openTelegramPost}
        title="Post para Telegram"
        onClose={() => setOpenTelegramPost(false)}
      >
        <div className="hint">Listo para copiar / pegar.</div>
        <textarea className="monoTextarea" rows={18} value={TELEGRAM_POST_BILINGUAL} readOnly />
        <div className="modalActions">
          <button className="btn btnGhost" onClick={() => setOpenTelegramPost(false)}>
            Close
          </button>
          <button className="btn" onClick={copyTelegramPost}>
            <Copy size={18} /> Copy
          </button>
        </div>
      </Modal>

      <Modal
        open={openCreateVideorama}
        title="Create Featured Videorama"
        onClose={() => setOpenCreateVideorama(false)}
      >
        <div className="hint">
          Creator: <span className="monoInline">{tgCreator || 'Anonymous'}</span> • Tracks: {items.length} (from My Mix)
        </div>
        <label className="field">
          <div className="label">Title</div>
          <input
            value={createVideoramaTitle}
            onChange={(e) => setCreateVideoramaTitle(e.target.value)}
            placeholder="Videorama title"
          />
        </label>
        <label className="field">
          <div className="label">Description (optional)</div>
          <textarea
            value={createVideoramaDesc}
            onChange={(e) => setCreateVideoramaDesc(e.target.value)}
            rows={4}
            placeholder="Short curator note"
          />
        </label>
        <div className="modalActions">
          <button className="btn btnGhost" onClick={() => setOpenCreateVideorama(false)}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => createVideoramaFromMyMix({ title: createVideoramaTitle, description: createVideoramaDesc })}
            disabled={items.length === 0}
          >
            <Plus size={18} /> Create
          </button>
        </div>
      </Modal>

      <Modal
        open={openAddPodcast}
        title="Upload Podcast"
        onClose={() => {
          if (podcastBusy) return
          setOpenAddPodcast(false)
        }}
      >
        <label className="field">
          <div className="label">Audio file (max 100MB)</div>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setPodcastFile(e.target.files?.[0] || null)}
            disabled={podcastBusy}
          />
          {podcastFile ? <div className="hint">{podcastFile.name} • {formatBytes(podcastFile.size)}</div> : null}
        </label>
        <label className="field">
          <div className="label">Title (optional)</div>
          <input value={podcastTitle} onChange={(e) => setPodcastTitle(e.target.value)} disabled={podcastBusy} />
        </label>
        <label className="field">
          <div className="label">Notes (optional)</div>
          <textarea value={podcastDesc} onChange={(e) => setPodcastDesc(e.target.value)} rows={3} disabled={podcastBusy} />
        </label>

        {podcastProgress ? (
          <div className="progress">
            <div className="progressTop">
              <div>Uploading…</div>
              <div>{podcastProgress.pct || 0}%</div>
            </div>
            <div className="progressBar">
              <div className="progressFill" style={{ width: `${Math.max(0, Math.min(100, podcastProgress.pct || 0))}%` }} />
            </div>
            <div className="progressMeta">
              <span>{formatBytes(podcastProgress.loaded || 0)} / {formatBytes(podcastProgress.total || 0)}</span>
              <button className="btn btnSmall btnGhost" onClick={cancelPodcastUpload}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="modalActions">
          <button className="btn btnGhost" onClick={() => setOpenAddPodcast(false)} disabled={podcastBusy}>
            Close
          </button>
          <button className="btn" onClick={submitPodcast} disabled={podcastBusy || !podcastFile}>
            {podcastBusy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </Modal>

      <Modal
        open={openAddLink}
        title="Add YouTube link"
        onClose={() => {
          if (linkBusy) return
          setOpenAddLink(false)
        }}
      >
        <label className="field">
          <div className="label">YouTube URL</div>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://youtu.be/… or https://www.youtube.com/watch?v=…"
          />
        </label>
        <label className="field">
          <div className="label">Title (optional)</div>
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Leave blank to auto-fill" />
        </label>
        <label className="field">
          <div className="label">Notes (optional)</div>
          <textarea value={linkDesc} onChange={(e) => setLinkDesc(e.target.value)} rows={3} placeholder="Mood, context, why it hits…" />
        </label>
        <div className="modalActions">
          <button className="btn btnGhost" onClick={() => setOpenAddLink(false)} disabled={linkBusy}>
            Cancel
          </button>
          <button className="btn" onClick={submitLink} disabled={linkBusy || !String(linkUrl || '').trim()}>
            {linkBusy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </Modal>

      <Modal
        open={openAddUpload}
        title="Upload a video"
        onClose={() => {
          if (uploadBusy) return
          setOpenAddUpload(false)
        }}
      >
        <label className="field">
          <div className="label">Video file (max 250MB)</div>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            disabled={uploadBusy}
          />
          {uploadFile ? <div className="hint">{uploadFile.name} • {formatBytes(uploadFile.size)}</div> : null}
        </label>
        <label className="field">
          <div className="label">Title (optional)</div>
          <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} disabled={uploadBusy} />
        </label>
        <label className="field">
          <div className="label">Notes (optional)</div>
          <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} rows={3} disabled={uploadBusy} />
        </label>

        {uploadProgress ? (
          <div className="progress">
            <div className="progressTop">
              <div>Uploading…</div>
              <div>{uploadProgress.pct || 0}%</div>
            </div>
            <div className="progressBar">
              <div className="progressFill" style={{ width: `${Math.max(0, Math.min(100, uploadProgress.pct || 0))}%` }} />
            </div>
            <div className="progressMeta">
              <span>{formatBytes(uploadProgress.loaded || 0)} / {formatBytes(uploadProgress.total || 0)}</span>
              <button className="btn btnSmall btnGhost" onClick={cancelUpload}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="modalActions">
          <button className="btn btnGhost" onClick={() => setOpenAddUpload(false)} disabled={uploadBusy}>
            Close
          </button>
          <button className="btn" onClick={submitUpload} disabled={uploadBusy || !uploadFile}>
            {uploadBusy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </Modal>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
