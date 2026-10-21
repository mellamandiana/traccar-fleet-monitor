import { BrandMark, LogoutIcon } from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function Header({ user, server, simulated, theme, onToggleTheme, onLogout }) {
  return (
    <header className="header">
      <div className="header__brand">
        <BrandMark />
        <span className="header__title">Monitor de flota</span>
      </div>

      <p className="header__source">
        {simulated ? (
          <span className="source-badge source-badge--sim">Flota simulada</span>
        ) : (
          <span className="source-badge">
            <span className="visually-hidden">Conectado a </span>
            {server?.label}
          </span>
        )}
      </p>

      <div className="header__actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <span className="header__user" title={user?.email}>
          {user?.name || user?.email}
        </span>
        <button type="button" className="icon-button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}
