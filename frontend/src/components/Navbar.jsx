import { initials } from '../utils'

export default function Navbar({ user, onLogout, onHome }) {
  const label = user.name || user.email
  return (
    <header className="topbar">
      <div className="brand clickable" onClick={onHome}>
        <div className="brand-mark">A</div>
        <div>
          <strong>Accord</strong>
          <span>Agreement workspace</span>
        </div>
      </div>
      <div className="user-area">
        <div className="user-avatar">{initials(label)}</div>
        <div className="user-details">
          <strong>{label}</strong>
          <span>{user.email}</span>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  )
}