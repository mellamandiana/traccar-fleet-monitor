import { useDisclosure } from '../hooks/useDisclosure.js';
import { useNow } from '../hooks/useEnvironment.js';
import { relativeTime } from '../utils/format.js';
import { BellIcon, LogoutIcon, SearchIcon } from './Icons.jsx';
import TraccarLogo from './TraccarLogo.jsx';
import ThemeToggle from './ThemeToggle.jsx';

/**
 * Barra superior (diseño de Figma): marca · origen de datos · búsqueda ·
 * notificaciones · tema · operador. Todos los controles hacen algo real.
 */
export default function Header({
  user,
  server,
  simulated,
  theme,
  onToggleTheme,
  onLogout,
  events = [],
  unread = 0,
  onOpenNotifications,
  onSelectDevice,
  onSearch,
}) {
  return (
    <header className="header">
      <div className="header__brand">
        <TraccarLogo height={30} />
        {/* Único <h1> de la vista: nombra la aplicación; las secciones usan <h2>. */}
        <h1 className="header__title">Monitor de flota</h1>
      </div>

      <p className="header__source">
        {simulated ? (
          <span className="source-badge source-badge--sim">
            <span className="source-badge__long">Flota </span>simulada
          </span>
        ) : (
          <span className="source-badge">
            <span className="visually-hidden">Conectado a </span>
            {server?.label}
          </span>
        )}
      </p>

      <div className="header__actions">
        {/* Siempre presente (también mientras carga): que aparezca después movería la barra. */}
        {onSearch && (
          <button
            type="button"
            className="icon-button header__search"
            onClick={onSearch}
            aria-label="Buscar vehículo"
            aria-keyshortcuts="/"
          >
            <SearchIcon />
          </button>
        )}
        {onSelectDevice && (
          <Notifications events={events} unread={unread} onOpen={onOpenNotifications} onSelectDevice={onSelectDevice} />
        )}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <UserMenu user={user} server={server} simulated={simulated} onLogout={onLogout} />
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------------
   Notificaciones
   --------------------------------------------------------------------------- */
function Notifications({ events, unread, onOpen, onSelectDevice }) {
  const { open, close, rootRef, buttonProps, panelProps } = useDisclosure({ onOpen });
  const now = useNow(15000);
  const label = unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones';

  return (
    <div className="header__menu" ref={rootRef}>
      <button type="button" className="icon-button notification-button" aria-label={label} {...buttonProps}>
        <BellIcon />
        {unread > 0 && <span className="notification-button__dot" aria-hidden="true" />}
      </button>

      <div className="popover popover--notifications" role="region" aria-labelledby={`${panelProps.id}-title`} {...panelProps}>
        <div className="popover__head">
          <h2 id={`${panelProps.id}-title`} className="popover__title">
            Notificaciones
          </h2>
          <span className="popover__meta">{events.length ? `${events.length} recientes` : ''}</span>
        </div>

        {events.length === 0 ? (
          <p className="popover__empty">
            Sin novedades. Aquí verás cuando un vehículo se desconecte, se detenga o tenga batería baja.
          </p>
        ) : (
          <ul className="event-list">
            {events.map((ev) => {
              const body = (
                <>
                  <span className={`event-list__mark event-list__mark--${ev.kind}`} aria-hidden="true" />
                  <span className="event-list__text">
                    {ev.text}
                    <time className="event-list__time" dateTime={ev.at.toISOString()}>
                      {relativeTime(ev.at, now)}
                    </time>
                  </span>
                </>
              );
              return (
                <li key={ev.id}>
                  {ev.deviceId != null ? (
                    // Ir al vehículo del evento: lo selecciona y cierra el panel.
                    <button
                      type="button"
                      className="event-list__item event-list__item--action"
                      onClick={() => {
                        onSelectDevice(ev.deviceId);
                        close(false);
                      }}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="event-list__item">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Operador
   --------------------------------------------------------------------------- */
function initials(name = '') {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function UserMenu({ user, server, simulated, onLogout }) {
  const { rootRef, buttonProps, panelProps } = useDisclosure();
  const name = user?.name || user?.email || 'Operador';
  const role = user?.administrator ? 'Administrador' : 'Operador de flota';

  return (
    <div className="header__menu" ref={rootRef}>
      <button type="button" className="operator" aria-label={`Cuenta: ${name}, ${role}`} {...buttonProps}>
        <span className="avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <span className="operator__text" aria-hidden="true">
          <strong>{name}</strong>
          <small>{role}</small>
        </span>
      </button>

      <div className="popover popover--account" role="region" aria-label="Cuenta" {...panelProps}>
        <div className="account">
          <span className="avatar avatar--lg" aria-hidden="true">
            {initials(name)}
          </span>
          <dl className="account__data">
            <div>
              <dt className="visually-hidden">Nombre</dt>
              <dd className="account__name">{name}</dd>
            </div>
            {user?.email && user.email !== name && (
              <div>
                <dt className="visually-hidden">Correo</dt>
                <dd className="account__muted">{user.email}</dd>
              </div>
            )}
            <div>
              <dt className="visually-hidden">Rol</dt>
              <dd className="account__muted">{role}</dd>
            </div>
            <div>
              <dt className="visually-hidden">Origen de datos</dt>
              <dd className="account__muted">{simulated ? 'Flota simulada' : `Servidor ${server?.label}`}</dd>
            </div>
          </dl>
        </div>
        <button type="button" className="button button--ghost button--block account__logout" onClick={onLogout}>
          <LogoutIcon width={18} height={18} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
