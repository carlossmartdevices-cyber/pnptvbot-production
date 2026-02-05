import { Home, Video, Music, Mic, Radio, Star } from 'lucide-react'

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Home },
  { id: 'featured', label: 'Featured', icon: Star },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'podcast', label: 'Podcasts', icon: Mic },
  { id: 'radio', label: 'Radio', icon: Radio },
]

export default function CategoryNav({ selected, onChange, radioActive }) {
  return (
    <nav className="category-nav">
      <div className="category-scroll">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          const isRadio = cat.id === 'radio'

          return (
            <button
              key={cat.id}
              className={`category-btn ${selected === cat.id ? 'active' : ''} ${isRadio && radioActive ? 'live' : ''}`}
              onClick={() => onChange(cat.id)}
            >
              <Icon size={18} />
              <span>{cat.label}</span>
              {isRadio && radioActive && <span className="live-dot"></span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
