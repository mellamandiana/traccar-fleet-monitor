import { MoonIcon, SunIcon } from './Icons.jsx';

/**
 * Interruptor de tema. Es un <button> con aria-pressed: el lector anuncia
 * "Tema oscuro, botón de alternancia, presionado" y Space/Enter lo operan.
 */
export default function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark';
  return (
    <button type="button" className="theme-toggle" aria-pressed={dark} onClick={onToggle} title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb">{dark ? <MoonIcon width={14} height={14} /> : <SunIcon width={14} height={14} />}</span>
      </span>
      <span className="theme-toggle__label">Tema oscuro</span>
    </button>
  );
}
