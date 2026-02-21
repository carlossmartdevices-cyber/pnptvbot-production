import { Play, Music, Video, Mic } from 'lucide-react'

function formatDuration(seconds) {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hrs}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getTypeIcon(type) {
  switch (type) {
    case 'video': return Video
    case 'audio': return Music
    case 'podcast': return Mic
    default: return Music
  }
}

export default function MediaGrid({ media, onSelect }) {
  if (!media || media.length === 0) {
    return (
      <div className="media-grid empty">
        <div className="empty-state">
          <Music size={48} />
          <h3>No media found</h3>
          <p>Check back later for new content!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="media-grid">
      {media.map(item => {
        const TypeIcon = getTypeIcon(item.type)

        return (
          <div
            key={item.id}
            className={`media-card ${item.type}`}
            onClick={() => onSelect(item)}
          >
            <div className="media-thumbnail">
              {item.cover_url ? (
                <img src={item.cover_url} alt={item.title} loading="lazy" />
              ) : (
                <div className="thumbnail-placeholder">
                  <TypeIcon size={32} />
                </div>
              )}
              <div className="media-overlay">
                <button className="play-btn">
                  <Play size={24} fill="white" />
                </button>
              </div>
              {item.duration && (
                <span className="media-duration">{formatDuration(item.duration)}</span>
              )}
              <span className="media-type-badge">
                <TypeIcon size={12} />
              </span>
            </div>
            <div className="media-info">
              <h3 className="media-title">{item.title}</h3>
              <p className="media-artist">{item.artist || 'Unknown Artist'}</p>
              {item.category && (
                <span className="media-category">{item.category}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
