import { useId, useMemo, useState } from 'react';
import { relativeTime } from '../utils/format.js';
import { useNow } from '../hooks/useEnvironment.js';
import StatusPill from './StatusPill.jsx';
import { SearchIcon } from './Icons.jsx';
import { DeviceListSkeleton } from './Skeletons.jsx';
import VehicleIcon, { VEHICLE_LABEL, vehicleKind } from './VehicleIcon.jsx';

const ORDER = { online: 0, unknown: 1, offline: 2 };

/**
 * Selector de vehículos construido con radios nativos dentro de un <fieldset>:
 * una sola parada de Tab para todo el grupo, flechas ↑/↓ para moverse y
 * semántica "1 de 5, seleccionado" gratis en cualquier lector de pantalla.
 */
export default function DeviceList({ devices, loading, stale, selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const now = useNow(15000);
  const ids = { search: 'buscar-vehiculo', legend: useId(), count: useId() };

  const filtered = useMemo(() => {
    if (!devices) return [];
    const q = query.trim().toLowerCase();
    return devices
      .filter((d) => !onlyOnline || d.status === 'online')
      .filter((d) => !q || d.name.toLowerCase().includes(q) || String(d.uniqueId).toLowerCase().includes(q))
      .sort((a, b) => (ORDER[a.status] ?? 1) - (ORDER[b.status] ?? 1) || a.name.localeCompare(b.name, 'es'));
  }, [devices, query, onlyOnline]);

  const onlineCount = devices?.filter((d) => d.status === 'online').length ?? 0;

  return (
    <section className="card device-list" id="lista-vehiculos" tabIndex={-1} aria-labelledby={ids.legend}>
      <div className="device-list__head">
        <h2 className="device-list__title" id={ids.legend}>
          Vehículos
        </h2>
        <p className="device-list__count" id={ids.count}>
          {loading ? <span className="bone" style={{ width: 92, height: 14 }} aria-hidden="true" /> : `${onlineCount} de ${devices.length} en línea`}
        </p>
      </div>

      <div className="device-list__tools">
        <div className="search">
          <label htmlFor={ids.search} className="visually-hidden">
            Buscar vehículo por nombre o identificador
          </label>
          <SearchIcon className="search__icon" />
          <input
            id={ids.search}
            type="search"
            placeholder="Buscar vehículo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} disabled={loading} />
          <span>Solo en línea</span>
        </label>
      </div>

      {stale && (
        <p className="device-list__stale" role="status">
          La lista puede estar desactualizada: no pudimos refrescarla.
        </p>
      )}

      {loading ? (
        <DeviceListSkeleton />
      ) : (
        <fieldset className="device-list__group">
          <legend className="visually-hidden">Elige el vehículo a monitorear</legend>
          {filtered.length === 0 ? (
            <p className="device-list__empty">
              Ningún vehículo coincide{query ? ` con “${query.trim()}”` : ''}
              {onlyOnline ? ' entre los que están en línea' : ''}.
            </p>
          ) : (
            <ul className="device-list__items">
              {filtered.map((d) => {
                const checked = d.id === selectedId;
                const last = d.lastUpdate ? relativeTime(new Date(d.lastUpdate), now) : 'Sin registro';
                return (
                  <li key={d.id}>
                    <label className={`device-row ${checked ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="device"
                        className="device-row__input"
                        value={d.id}
                        checked={checked}
                        onChange={() => onSelect(d.id)}
                      />
                      {/* El nombre va primero en el DOM para que el lector diga "Camión 07, Camión,
                          en línea…"; el avatar se recoloca a la izquierda con CSS (order). */}
                      <span className="device-row__text">
                        <span className="device-row__name">{d.name}</span>
                        <span className="device-row__meta">
                          {VEHICLE_LABEL[vehicleKind(d)]} · {d.uniqueId}
                        </span>
                      </span>
                      <span className="device-row__avatar">
                        <VehicleIcon kind={vehicleKind(d)} size={20} />
                        <StatusPill status={d.status} compact />
                      </span>
                      <span className="device-row__time">{last}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      )}
    </section>
  );
}
