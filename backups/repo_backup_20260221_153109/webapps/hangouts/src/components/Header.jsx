import { LogOut } from 'lucide-react'

export default function Header({ title, subtitle, telegramUser, onLogout }) {
  return (
    <header className="header">
      <div className="header-logo">
        <h1>{title}</h1>
        {subtitle && <p className="text-muted-color">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {telegramUser && (
          <>
            <span className="text-sm font-medium text-muted-color">
              {telegramUser.first_name} {telegramUser.last_name}
            </span>
            <button onClick={onLogout} className="btn btn-secondary" title="Logout">
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  )
}
