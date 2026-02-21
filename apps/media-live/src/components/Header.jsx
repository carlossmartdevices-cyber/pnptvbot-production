import { LogOut } from 'lucide-react'

export default function Header({ title, telegramUser, onLogout }) {
  return (
    <header className="header">
      <div className="header-logo">
        <div className="logo-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        </div>
        <div className="header-text">
          <h1>{title}</h1>
        </div>
      </div>
      <div className="header-user-info">
        {telegramUser && (
          <>
            <span className="user-greeting">{telegramUser.name}</span>
            <button onClick={onLogout} className="logout-button" title="Logout">
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
