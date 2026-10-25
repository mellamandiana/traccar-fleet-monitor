import { MoonIcon, SunIcon } from './Icons.jsx';

/**
 * Interruptor de tema con sol y luna a los lados (diseño de Figma).
 * Es un <button aria-pressed>: el lector anuncia "Tema oscuro, botón de alternancia,
 * presionado / no presionado" y lo operan Space y Enter. Los iconos son decorativos;
 * el nombre accesible es el texto oculto "Tema oscuro".
 */
export default function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark';
  return (
    <button type="button" className="theme-toggle" aria-pressed={dark} onClick={onToggle}>
      <SunIcon className="theme-toggle__icon theme-toggle__icon--sun" width={16} height={16} />
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      <MoonIcon className="theme-toggle__icon theme-toggle__icon--moon" width={16} height={16} />
      <span className="visually-hidden">Tema oscuro</span>
    </button>
  );
}
