import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { parseYouTubeUrl } from '../lib/youtube'
import { loadYouTubeIframeApi } from '../lib/youtubeIframeApi'

function isYouTubeVideoUrl(url) {
  const info = parseYouTubeUrl(url)
  return info?.kind === 'video' ? info : null
}

export default function PlayerSheet({ open, title, queue, startIndex = 0, mode = 'focusOnly', onClose }) {
  const [index, setIndex] = useState(startIndex)
  const [isPlaying, setIsPlaying] = useState(true)
  const [error, setError] = useState('')
  const [needTap, setNeedTap] = useState(false)

  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const ytHostRef = useRef(null)
  const ytRef = useRef(null)
  const queueRef = useRef(queue || [])
  const indexRef = useRef(index)

  const current = queue?.[index] || null
  const hasPrev = index > 0
  const hasNext = index < (queue?.length || 0) - 1

  useEffect(() => {
    if (!open) return
    setIndex(startIndex)
  }, [open, startIndex])

  useEffect(() => {
    queueRef.current = Array.isArray(queue) ? queue : []
  }, [queue])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    if (!open) return
    setError('')
    setNeedTap(false)
  }, [open, index])

  const currentKind = useMemo(() => {
    if (!current) return null
    if (current.kind === 'audio') return 'audio'
    if (current.kind === 'upload') return 'upload'
    const yt = isYouTubeVideoUrl(current.url)
    if (yt) return 'youtube'
    return 'video'
  }, [current])

  const ytVideoId = useMemo(() => {
    if (currentKind !== 'youtube') return null
    return isYouTubeVideoUrl(current?.url)?.id || null
  }, [currentKind, current])

  const goNext = () => {
    setIndex((i) => {
      if (i >= queue.length - 1) return i
      return i + 1
    })
  }

  const goPrev = () => {
    setIndex((i) => {
      if (i <= 0) return i
      return i - 1
    })
  }

  const destroyYouTubePlayer = () => {
    try {
      ytRef.current?.destroy()
    } catch {
      // ignore
    }
    ytRef.current = null
    if (ytHostRef.current) ytHostRef.current.innerHTML = ''
  }

  useEffect(() => {
    if (open) return
    destroyYouTubePlayer()
    try {
      videoRef.current?.pause()
    } catch {
      // ignore
    }
    try {
      audioRef.current?.pause()
    } catch {
      // ignore
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!current) return

    if (currentKind === 'youtube') {
      let cancelled = false
      setIsPlaying(true)
      try {
        videoRef.current?.pause()
      } catch {
        // ignore
      }
      try {
        audioRef.current?.pause()
      } catch {
        // ignore
      }

      loadYouTubeIframeApi()
        .then((YT) => {
          if (cancelled) return
          if (!ytHostRef.current) return

          if (ytRef.current && typeof ytRef.current.loadVideoById === 'function') {
            try {
              ytRef.current.loadVideoById(ytVideoId)
              ytRef.current.playVideo?.()
              setIsPlaying(true)
              setNeedTap(false)
            } catch {
              setNeedTap(true)
            }
            return
          }

          ytHostRef.current.innerHTML = ''
          ytRef.current = new YT.Player(ytHostRef.current, {
            width: '100%',
            height: '100%',
            videoId: ytVideoId,
            playerVars: {
              autoplay: 1,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
            },
            events: {
              onReady: (evt) => {
                try {
                  evt.target.playVideo()
                } catch {
                  setNeedTap(true)
                }
              },
              onStateChange: (evt) => {
                if (!window.YT || !window.YT.PlayerState) return
                if (evt.data === window.YT.PlayerState.ENDED) {
                  setIndex((i) => (i < queueRef.current.length - 1 ? i + 1 : i))
                } else if (evt.data === window.YT.PlayerState.PLAYING) {
                  setIsPlaying(true)
                } else if (evt.data === window.YT.PlayerState.PAUSED) {
                  setIsPlaying(false)
                }
              },
              onError: () => {
                setError('This YouTube video cannot be played here.')
                setIsPlaying(false)
                setTimeout(() => {
                  setIndex((i) => (i < queueRef.current.length - 1 ? i + 1 : i))
                }, 900)
              },
            },
          })
        })
        .catch((e) => {
          setError(e?.message || 'Failed to load YouTube player')
          setIsPlaying(false)
        })

      return () => {
        cancelled = true
      }
    }

    if (currentKind === 'upload' || currentKind === 'video') {
      destroyYouTubePlayer()
      try {
        audioRef.current?.pause()
      } catch {
        // ignore
      }
      const el = videoRef.current
      if (!el) return
      setIsPlaying(true)
      const onEnded = () => {
        setIndex((i) => (i < queueRef.current.length - 1 ? i + 1 : i))
      }
      el.addEventListener('ended', onEnded)

      const play = async () => {
        try {
          await el.play()
          setNeedTap(false)
        } catch {
          setNeedTap(true)
          setIsPlaying(false)
        }
      }
      play()

      return () => {
        el.removeEventListener('ended', onEnded)
      }
    }

    if (currentKind === 'audio') {
      destroyYouTubePlayer()
      try {
        videoRef.current?.pause()
      } catch {
        // ignore
      }
      const el = audioRef.current
      if (!el) return
      setIsPlaying(true)
      const onEnded = () => {
        setIndex((i) => (i < queueRef.current.length - 1 ? i + 1 : i))
      }
      el.addEventListener('ended', onEnded)

      const play = async () => {
        try {
          await el.play()
          setNeedTap(false)
        } catch {
          setNeedTap(true)
          setIsPlaying(false)
        }
      }
      play()

      return () => {
        el.removeEventListener('ended', onEnded)
      }
    }
  }, [open, currentKind, ytVideoId, current?.url])

  const togglePlay = async () => {
    setError('')
    setNeedTap(false)

    if (currentKind === 'youtube') {
      try {
        if (!ytRef.current) return
        const state = ytRef.current.getPlayerState?.()
        if (state === window.YT?.PlayerState?.PLAYING) {
          ytRef.current.pauseVideo()
          setIsPlaying(false)
        } else {
          ytRef.current.playVideo()
          setIsPlaying(true)
        }
      } catch {
        setNeedTap(true)
      }
      return
    }

    const el = currentKind === 'audio' ? audioRef.current : videoRef.current
    if (!el) return
    try {
      if (el.paused) {
        await el.play()
        setIsPlaying(true)
      } else {
        el.pause()
        setIsPlaying(false)
      }
    } catch {
      setNeedTap(true)
    }
  }

  const tapToContinue = async () => {
    setNeedTap(false)
    await togglePlay()
  }

  if (!open) return null

  return (
    <div className="sheetBackdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        <div className="sheetHeader">
          <div className="sheetTitle">
            <div className="pill">Videorama</div>
            <div className="titleText">{title || 'Now playing'}</div>
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="player">
          {currentKind === 'youtube' ? (
            <div className="playerFrame" ref={ytHostRef} />
          ) : currentKind === 'audio' ? (
            <audio
              className="playerVideo"
              ref={audioRef}
              controls
              src={current?.url ? new URL(current.url, window.location.origin).toString() : ''}
            />
          ) : (
            <video
              className="playerVideo"
              ref={videoRef}
              controls
              playsInline
              src={current?.url ? new URL(current.url, window.location.origin).toString() : ''}
            />
          )}

          {needTap ? (
            <button className="tapOverlay" onClick={tapToContinue}>
              Tap to play
            </button>
          ) : null}
        </div>

        {error ? <div className="notice error">{error}</div> : null}

        {mode === 'full' ? (
          <>
            <div className="queueControls">
              <button className="iconBtn" onClick={goPrev} disabled={!hasPrev} aria-label="Previous">
                <ChevronLeft size={20} />
              </button>
              <button className="btn btnGhost" onClick={togglePlay}>
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button className="iconBtn" onClick={goNext} disabled={!hasNext} aria-label="Next">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="queueMeta">
              <div className="queueNow">
                <div className="queueLabel">Now</div>
                <div className="queueTitle">{current?.title}</div>
              </div>
              {current?.description ? <div className="queueDesc">{current.description}</div> : null}
            </div>

            <div className="queueList">
              {(queue || []).map((it, idx) => (
                <button
                  key={it.id || `${idx}-${it.url}`}
                  className={idx === index ? 'queueItem active' : 'queueItem'}
                  onClick={() => setIndex(idx)}
                >
                  <div className="queueItemTop">
                    <div className="queueIndex">{idx + 1}</div>
                    <div className="queueItemTitle">{it.title}</div>
                  </div>
                  {it.description ? <div className="queueItemDesc">{it.description}</div> : null}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="queueMeta focusOnly">
            {current?.description ? <div className="queueDesc">{current.description}</div> : null}
            <div className="queueControls focusControls">
              <button className="btn btnGhost" onClick={togglePlay}>
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
