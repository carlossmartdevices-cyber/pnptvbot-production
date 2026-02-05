import { Radio, Tv, Music, User, LogOut } from 'lucide-react'

export default function Header({ title, subtitle, telegramUser, onLogout, loginRef }) {
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
      <div className="header-user-info">
        {telegramUser ? (
          <>
            <div className="user-greeting">
              <User size={16} />
              <span>Welcome, {telegramUser.first_name}</span>
            </div >
            <button onClick={onLogout} className="logout-button">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <div ref={loginRef} />
        )}
      </div>
    </header>
  )
}
