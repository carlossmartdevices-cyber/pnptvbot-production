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
} from 'lucide-react'
import { loadItems, saveItems } from './lib/storage'
import { getPublicPlaylists, uploadVideoramaVideo } from './lib/api'
import { parseYouTubeUrl, toYouTubeEmbedUrl, tryYouTubeTitle } from './lib/youtube'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function formatBytes(bytes) {
  const n = Number(bytes || 0)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const v = n / (1024 ** idx)
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[idx]}`
}

function normalizePlaylistVideos(videos) {
  try {
    if (!videos) return []
    if (Array.isArray(videos)) return videos
    if (typeof videos === 'string') {
      const parsed = JSON.parse(videos)
      return Array.isArray(parsed) ? parsed : []
    }
    return []
  } catch {
    return []
  }
}

function PlayerSheet({ item, onClose }) {
  const yt = item?.kind === 'link' ? parseYouTubeUrl(item?.url) : null
  const embed = yt ? toYouTubeEmbedUrl(yt) : null
  const videoUrl = item?.kind === 'upload' ? new URL(item.url, window.location.origin).toString() : null

  if (!item) return null

  return (
    <div className="sheetBackdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        <div className="sheetHeader">
          <div className="sheetTitle">
            <div className="pill">{item.kind === 'upload' ? 'Upload' : 'Link'}</div>
            <div className="titleText">{item.title}</div>
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="player">
          {embed ? (
            <iframe
              title="YouTube player"
              className="playerFrame"
              src={embed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video className="playerVideo" controls playsInline src={videoUrl || item.url} />
          )}
        </div>

        {item.description ? <div className="sheetDesc">{item.description}</div> : null}

        <div className="sheetActions">
          <a className="btn btnGhost" href={item.url} target="_blank" rel="noreferrer">
            Open source
          </a>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
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
  const [tab, setTab] = useState('my')
  const [items, setItems] = useState(() => loadItems())
  const [query, setQuery] = useState('')
  const [playerItem, setPlayerItem] = useState(null)

  const [openAddLink, setOpenAddLink] = useState(false)
  const [openAddUpload, setOpenAddUpload] = useState(false)

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

  const [publicPlaylists, setPublicPlaylists] = useState([])
  const [publicError, setPublicError] = useState('')
  const [publicLoading, setPublicLoading] = useState(false)

  useEffect(() => {
    saveItems(items)
  }, [items])

  useEffect(() => {
    if (tab !== 'explore') return
    let mounted = true
    setPublicLoading(true)
    setPublicError('')
    getPublicPlaylists(30)
      .then((data) => {
        if (!mounted) return
        setPublicPlaylists(Array.isArray(data) ? data : [])
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice().sort((a, b) => b.createdAt - a.createdAt)
    return items
      .filter((it) => `${it.title} ${it.url} ${it.description}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [items, query])

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
            <div className="brandTag">Uploads + YouTube links, mobile-first</div>
          </div>
        </div>

        <div className="headerActions">
          <button className="btn btnGhost" onClick={() => setOpenAddLink(true)}>
            <Link2 size={18} /> Link
          </button>
          <button className="btn" onClick={() => setOpenAddUpload(true)}>
            <UploadCloud size={18} /> Upload
          </button>
        </div>
      </header>

      <main className="main">
        <div className="tabs">
          <button className={cx('tab', tab === 'my' && 'active')} onClick={() => setTab('my')}>
            <Film size={18} /> My Mix
          </button>
          <button className={cx('tab', tab === 'explore' && 'active')} onClick={() => setTab('explore')}>
            <Sparkles size={18} /> Explore
          </button>
        </div>

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
                      <button className="btn btnSmall" onClick={() => setPlayerItem(it)}>
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

        {tab === 'explore' ? (
          <div className="explore">
            <div className="exploreTop">
              <div className="exploreTitle">Community Collections</div>
              <a className="btn btnGhost" href="/music-collections" target="_blank" rel="noreferrer">
                Open classic page
              </a>
            </div>

            {publicLoading ? <div className="notice">Loading playlists…</div> : null}
            {publicError ? <div className="notice error">{publicError}</div> : null}

            <div className="grid">
              {publicPlaylists.map((p) => {
                const vids = normalizePlaylistVideos(p.videos)
                const sample = vids[0]?.url || vids[0]
                const sampleText = sample ? String(sample) : ''
                return (
                  <div key={p.id} className="card">
                    <div className="cardTop">
                      <div className="pill">Playlist</div>
                      <div className="pill subtle">{p.videoCount || vids.length || 0} items</div>
                    </div>
                    <div className="cardTitle">{p.title || 'Untitled playlist'}</div>
                    {p.description ? <div className="cardDesc">{p.description}</div> : null}
                    {sampleText ? <div className="cardSub">{sampleText}</div> : null}
                    <div className="cardActions">
                      {sampleText ? (
                        <button
                          className="btn btnSmall"
                          onClick={() =>
                            setPlayerItem({
                              id: `${p.id}:sample`,
                              title: p.title || 'Playlist sample',
                              url: sampleText,
                              kind: 'link',
                              createdAt: Date.now(),
                              description: p.description || '',
                            })
                          }
                        >
                          <PlayCircle size={18} /> Preview
                        </button>
                      ) : null}
                      <a className="btn btnSmall btnGhost" href="/music-collections" target="_blank" rel="noreferrer">
                        Browse
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="footer">
        <a className="footerLink" href="/videorama" target="_blank" rel="noreferrer">
          Old Videorama
        </a>
        <span className="footerDot">•</span>
        <a className="footerLink" href="/terms?lang=en" target="_blank" rel="noreferrer">
          Policies
        </a>
      </footer>

      <PlayerSheet item={playerItem} onClose={() => setPlayerItem(null)} />

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
    </div>
  )
}

