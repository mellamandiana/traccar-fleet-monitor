import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { compass, knotsToKmh, statusMeta } from '../utils/format.js';
import { usePrefersReducedMotion } from '../hooks/useEnvironment.js';
import { CrosshairIcon } from './Icons.jsx';
import { MapSkeleton } from './Skeletons.jsx';
import ErrorState from './ErrorState.jsx';

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const FOLLOW_ZOOM = 15;
const GLIDE_MS = 1400;

/* Marcador vectorial: flecha que apunta al rumbo (course) con halo de estado. */
const markerIcon = () =>
  L.divIcon({
    className: 'vehicle-marker-host',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    html: `
      <div class="vehicle-marker">
        <span class="vehicle-marker__pulse"></span>
        <span class="vehicle-marker__disc"></span>
        <svg class="vehicle-marker__arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2.5 19 20.5 12 16.6 5 20.5Z"/>
        </svg>
      </div>`,
  });

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Interpolación angular por el camino corto (350° → 10° gira 20°, no 340°). */
function lerpAngle(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

export default function VehicleMap({ device, position, loading, failed, error, nextAttemptAt, onRetry, theme }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tilesRef = useRef(null);
  const markerRef = useRef(null);
  const animRef = useRef({ frame: 0, lat: null, lon: null, course: 0, deviceId: null });
  const followRef = useRef(true);
  const programmaticRef = useRef(false);
  const [follow, setFollow] = useState(true);
  const reduced = usePrefersReducedMotion();

  followRef.current = follow;

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    const map = L.map(containerRef.current, {
      zoomControl: false,
      keyboard: true,
      attributionControl: true,
      center: [4.65, -74.08],
      zoom: 12,
      zoomSnap: 0.5,
    });
    L.control.zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
    map.attributionControl.setPrefix(false);

    // Cualquier desplazamiento manual (ratón, táctil o teclado) desactiva el seguimiento.
    const stopFollow = () => {
      if (!programmaticRef.current) setFollow(false);
    };
    map.on('dragstart', stopFollow);
    const onKey = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) stopFollow();
    };
    containerRef.current.addEventListener('keydown', onKey);

    const container = containerRef.current;
    container.setAttribute(
      'aria-label',
      'Mapa interactivo. Usa las flechas para desplazarte y las teclas más y menos para acercar o alejar.',
    );

    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(container);

    mapRef.current = map;
    return () => {
      ro.disconnect();
      container.removeEventListener('keydown', onKey);
      cancelAnimationFrame(animRef.current.frame);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      animRef.current = { frame: 0, lat: null, lon: null, course: 0, deviceId: null };
    };
  }, []);

  // Teselas según el tema: el mapa también cambia de turno.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = L.tileLayer(TILES[theme] ?? TILES.light, {
      attribution: ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
      detectRetina: false,
    }).addTo(map);
    const prev = tilesRef.current;
    tilesRef.current = next;
    // Retira la capa anterior cuando la nueva ya pintó, para no ver el mapa en blanco.
    if (prev) next.once('load', () => map.removeLayer(prev));
    const fallback = setTimeout(() => prev && map.hasLayer(prev) && map.removeLayer(prev), 2500);
    return () => clearTimeout(fallback);
  }, [theme]);

  // Posición nueva → el marcador se desliza hasta ella.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position || !device) return;

    const anim = animRef.current;
    const target = { lat: position.latitude, lon: position.longitude, course: position.course ?? 0 };
    const kmh = Math.round(knotsToKmh(position.speed) ?? 0);
    const dir = compass(position.course);
    const status = statusMeta(device.status);

    let marker = markerRef.current;
    if (!marker) {
      marker = L.marker([target.lat, target.lon], {
        icon: markerIcon(),
        keyboard: true,
        riseOnHover: true,
        alt: '',
      }).addTo(map);
      marker.bindTooltip('', { direction: 'top', offset: [0, -24], className: 'vehicle-tooltip' });
      markerRef.current = marker;
    }

    const el = marker.getElement();
    if (el) {
      el.setAttribute(
        'aria-label',
        `${device.name}: ${status.label.toLowerCase()}, ${kmh} kilómetros por hora${dir ? `, rumbo ${dir.long}` : ''}`,
      );
      el.classList.remove('is-online', 'is-offline', 'is-unknown', 'is-moving');
      el.classList.add(`is-${status.tone}`);
      if (kmh > 0) el.classList.add('is-moving');
    }
    marker.setTooltipContent(`<strong>${escapeHtml(device.name)}</strong><br>${kmh} km/h · ${status.label}`);

    const setCourse = (deg) => el?.style.setProperty('--course', `${deg}deg`);
    const centerOn = (lat, lon) => {
      // panBy en píxeles: mueve el lienzo sin reiniciar teselas en cada fotograma.
      const p = map.latLngToContainerPoint([lat, lon]);
      const c = map.getSize().divideBy(2);
      programmaticRef.current = true;
      map.panBy(p.subtract(c), { animate: false });
      programmaticRef.current = false;
    };

    cancelAnimationFrame(anim.frame);

    const switched = anim.deviceId !== device.id;
    if (switched || anim.lat == null) {
      // Vehículo nuevo: no deslizamos el marcador a través de la ciudad; volamos la cámara.
      anim.deviceId = device.id;
      anim.lat = target.lat;
      anim.lon = target.lon;
      anim.course = target.course;
      marker.setLatLng([target.lat, target.lon]);
      setCourse(target.course);
      setFollow(true);
      programmaticRef.current = true;
      if (reduced) map.setView([target.lat, target.lon], FOLLOW_ZOOM, { animate: false });
      else map.flyTo([target.lat, target.lon], FOLLOW_ZOOM, { duration: 0.9 });
      map.once('moveend', () => {
        programmaticRef.current = false;
      });
      return;
    }

    const from = { lat: anim.lat, lon: anim.lon, course: anim.course };
    if (reduced) {
      Object.assign(anim, target);
      marker.setLatLng([target.lat, target.lon]);
      setCourse(target.course);
      if (followRef.current) centerOn(target.lat, target.lon);
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / GLIDE_MS);
      const k = easeInOut(t);
      anim.lat = from.lat + (target.lat - from.lat) * k;
      anim.lon = from.lon + (target.lon - from.lon) * k;
      // El giro termina antes que el desplazamiento: el vehículo "apunta" y luego avanza.
      anim.course = lerpAngle(from.course, target.course, Math.min(1, t * 1.8));
      marker.setLatLng([anim.lat, anim.lon]);
      setCourse(anim.course);
      if (followRef.current) centerOn(anim.lat, anim.lon);
      if (t < 1) anim.frame = requestAnimationFrame(step);
    };
    anim.frame = requestAnimationFrame(step);
  }, [position, device, reduced]);

  // Volver a seguir el vehículo recentra suavemente.
  const recenter = () => {
    const map = mapRef.current;
    const { lat, lon } = animRef.current;
    setFollow(true);
    if (map && lat != null) {
      programmaticRef.current = true;
      map.flyTo([lat, lon], Math.max(map.getZoom(), FOLLOW_ZOOM - 1), { duration: reduced ? 0 : 0.6, animate: !reduced });
      map.once('moveend', () => {
        programmaticRef.current = false;
      });
    }
  };

  // Si el vehículo deja de tener posición, retiramos el marcador anterior.
  useEffect(() => {
    if ((position === null || failed) && markerRef.current && mapRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
      animRef.current.lat = null;
    }
  }, [position, failed]);

  const ready = !loading && !failed && position;
  const name = device?.name ?? 'el vehículo';

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <h2 id="map-title" className="visually-hidden">
        Mapa: ubicación de {name}
      </h2>
      <div ref={containerRef} className={`map ${ready ? 'is-ready' : ''}`} />

      {ready && (
        <div className="map-panel__controls">
          <button type="button" className="map-chip" aria-pressed={follow} onClick={follow ? () => setFollow(false) : recenter}>
            <CrosshairIcon width={18} height={18} />
            {follow ? 'Siguiendo vehículo' : 'Seguir vehículo'}
          </button>
        </div>
      )}

      {loading && <MapSkeleton label={device ? `Ubicando ${device.name}…` : 'Cargando vehículos…'} />}

      {!loading && failed && (
        <div className="map-overlay">
          <ErrorState error={error} onRetry={onRetry} nextAttemptAt={nextAttemptAt} compact />
        </div>
      )}

      {!loading && !failed && position === null && (
        <div className="map-overlay">
          <div className="error-state error-state--compact">
            <h3 className="error-state__title">{name} aún no ha enviado su ubicación</h3>
            <p className="error-state__body">
              Aparecerá aquí en cuanto el GPS reporte su primera posición. Mientras tanto puedes elegir otro vehículo de la lista.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
