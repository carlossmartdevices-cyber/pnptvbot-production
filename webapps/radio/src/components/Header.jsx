import { Radio, Tv, Music } from 'lucide-react'

export default function Header({ title, subtitle }) {
  return (
    <header className="header">
      <div className="header-logo">
        <div className="logo-icon">
          <Tv size={28} />
        </div>
        <div className="header-text">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="header-badge">
        <Music size={14} />
        <span>+ Radio</span>
      </div>
    </header>
  )
}
