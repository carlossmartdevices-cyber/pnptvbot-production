import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, Lock, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { getTelegramUser, tryTelegramReady } from '../utils/telegram'

function formatAgeMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}

function buildHangoutsUrl({ baseUrl = '/hangouts/', room, token, uid, username, type, appId, callId }) {
  const u = new URL(baseUrl, window.location.origin)
  if (room) u.searchParams.set('room', room)
  if (token) u.searchParams.set('token', token)
  if (uid) u.searchParams.set('uid', String(uid))
  if (username) u.searchParams.set('username', username)
  if (type) u.searchParams.set('type', type)
  if (appId) u.searchParams.set('appId', appId)
  if (callId) u.searchParams.set('callId', callId)
  return u.pathname + (u.search ? u.search : '')
}

export default function Lobby({ defaultAppId }) {
  const [tgUser, setTgUser] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [creating, setCreating] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createPublic, setCreatePublic] = useState(true)
  const [createMax, setCreateMax] = useState(10)

  const [joiningId, setJoiningId] = useState('')
  const autoJoinRef = useRef(false)

  useEffect(() => {
    tryTelegramReady()
    setTgUser(getTelegramUser())
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const joinParam = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search || '')
      const v = p.get('join')
      return v ? String(v) : ''
    } catch {
      return ''
    }
  }, [])

  const fetchRooms = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/hangouts/public', { method: 'GET' })
      if (!resp.ok) throw new Error(`Failed to load rooms (${resp.status})`)
      const data = await resp.json()
      const list = Array.isArray(data?.rooms) ? data.rooms : []
      setRooms(list)
    } catch (e) {
      setRooms([])
      setError(e?.message || 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  const ensureUser = () => {
    const u = tgUser || getTelegramUser()
    if (u) return u
    setToast('Open this inside Telegram to join/create rooms')
    return null
  }

  const joinRoom = async (roomId) => {
    const u = ensureUser()
    if (!u) return
    setJoiningId(roomId)
    try {
      const resp = await fetch(`/api/hangouts/join/${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, userName: u.displayName, initData: u.initData }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.success) throw new Error(data?.error || `Join failed (${resp.status})`)

      const href = buildHangoutsUrl({
        baseUrl: '/hangouts/',
        room: data.room,
        token: data.token,
        uid: data.uid,
        username: u.displayName,
        type: 'public',
        appId: data.appId || defaultAppId,
        callId: data.callId || roomId,
      })
      window.location.href = href
    } catch (e) {
      setToast(e?.message || 'Failed to join room')
    } finally {
      setJoiningId('')
    }
  }

  const createRoom = async () => {
    const u = ensureUser()
    if (!u) return

    setCreating(true)
    try {
      const resp = await fetch('/api/hangouts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: u.id,
          creatorName: u.displayName,
          initData: u.initData,
          title: String(createTitle || '').trim() || `${u.displayName}'s Hangout`,
          maxParticipants: Math.max(2, Math.min(50, Number(createMax) || 10)),
          isPublic: !!createPublic,
          allowGuests: true,
          enforceCamera: false,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.success) throw new Error(data?.error || `Create failed (${resp.status})`)

      const href = buildHangoutsUrl({
        baseUrl: '/hangouts/',
        room: data.room,
        token: data.token,
        uid: data.uid,
        username: u.displayName,
        type: data.isPublic ? 'public' : 'private',
        appId: data.appId || defaultAppId,
        callId: data.callId || data.id,
      })
      window.location.href = href
    } catch (e) {
      setToast(e?.message || 'Failed to create room')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!joinParam) return
    if (autoJoinRef.current) return
    autoJoinRef.current = true
    joinRoom(joinParam)
  }, [joinParam])

  return (
    <div className="app">
      <div className="bg" />
      <header className="header">
        <div className="brand">
          <div className="brandMark">
            <Sparkles size={18} />
          </div>
          <div className="brandText">
            <div className="brandName">PNPtv Hangouts</div>
            <div className="brandTag">Rooms • Public • Private • 18+</div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="hero">
          <div className="heroTitle">Find a room or start one</div>
          <div className="heroText">
            {tgUser ? (
              <>
                Connected as <span className="monoInline">{tgUser.displayName}</span>. Public rooms show up here.
              </>
            ) : (
              <>Open from Telegram for instant join + creator credit.</>
            )}
          </div>
          <div className="heroActions">
            <button className="btn" onClick={createRoom} disabled={creating}>
              <Plus size={18} /> {creating ? 'Creating…' : 'Create room'}
            </button>
            <button className="btn btnGhost" onClick={fetchRooms} disabled={loading}>
              <RefreshCw size={18} /> Refresh
            </button>
          </div>
        </div>

        <div className="card glass">
          <div className="formGrid">
            <label className="field">
              <div className="label">Title</div>
              <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g., Late-night vibez" />
            </label>
            <label className="field">
              <div className="label">Visibility</div>
              <div className="segmented">
                <button className={createPublic ? 'seg active' : 'seg'} onClick={() => setCreatePublic(true)} type="button">
                  <Globe size={16} /> Public
                </button>
                <button className={!createPublic ? 'seg active' : 'seg'} onClick={() => setCreatePublic(false)} type="button">
                  <Lock size={16} /> Private
                </button>
              </div>
            </label>
            <label className="field">
              <div className="label">Max participants</div>
              <input
                type="number"
                min={2}
                max={50}
                value={createMax}
                onChange={(e) => setCreateMax(e.target.value)}
              />
            </label>
          </div>
          <div className="hint">
            Public rooms send a community notification with a join link.
          </div>
        </div>

        <div className="sectionTitle">Public rooms</div>

        {error ? <div className="notice error">{error}</div> : null}

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <div className="muted">Loading rooms…</div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty">
            <div className="emptyTitle">No public rooms right now</div>
            <div className="emptyText">Create one and it will appear here.</div>
          </div>
        ) : (
          <div className="grid">
            {rooms.map((r) => (
              <div key={r.id} className="card">
                <div className="cardTop">
                  <div className="pill">Public</div>
                  <button className="btn btnSmall" onClick={() => joinRoom(r.id)} disabled={joiningId === r.id}>
                    {joiningId === r.id ? 'Joining…' : 'Join'}
                  </button>
                </div>
                <div className="cardTitle">{r.title || 'Untitled room'}</div>
                <div className="cardDesc">
                  Host: <span className="monoInline">{r.creatorName || 'Unknown'}</span>
                </div>
                <div className="cardMeta">
                  <span className="pill subtle">
                    {r.currentParticipants || 0}/{r.maxParticipants || 0}
                  </span>
                  {r.createdAt ? (
                    <span className="pill subtle">
                      {formatAgeMs(Date.now() - new Date(r.createdAt).getTime())} ago
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
