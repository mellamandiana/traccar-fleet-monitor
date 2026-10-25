import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { compass, knotsToKmh, relativeTime, statusMeta } from '../utils/format.js';
import { useNow, usePrefersReducedMotion, useSlow } from '../hooks/useEnvironment.js';
import { CrosshairIcon, RetryIcon } from './Icons.jsx';
import { MapSkeleton } from './Skeletons.jsx';
import ErrorState from './ErrorState.jsx';

/*
 * Teselas de OpenStreetMap: no requieren API key. El aspecto de cada tema
 * (más sobrio en claro, invertido en oscuro) se logra con un filtro CSS sobre
 * las teselas definido en los tokens (--map-filter), así basta una sola capa.
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const FOLLOW_ZOOM = 15;

/*
 * Suavizado del marcador (interpolación con búfer de un intervalo)
 * ----------------------------------------------------------------
 * Cada posición nueva se convierte en el destino de un tramo cuya duración es
 * el intervalo REAL entre posiciones (media móvil). Así el marcador llega al
 * punto justo cuando llega el siguiente dato y nunca se queda quieto esperando:
 * el movimiento es continuo, como el del vehículo. El coste es ir ~1 intervalo
 * por detrás del GPS, que es lo que hacen las apps de navegación.
 */
const MIN_SEGMENT_MS = 800;
const MAX_SEGMENT_MS = 8000;
const TURN_MS = 600; // el giro se resuelve rápido: el vehículo "apunta" y avanza
const TELEPORT_M = 1500; // salto mayor que esto = reubicación GPS, no movimiento
const TRAIL_POINTS = 24; // estela: últimas ~2 min a 5 s por posición
const STOPPED_KMH = 1; // por debajo, el vehículo se considera detenido
const JITTER_M = 15; // detenido: movimientos menores son ruido del GPS, no desplazamiento

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInCubic = (t) => t * t * t;
const linear = (t) => t;

function metersBetween(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

/** Interpolación angular por el camino corto (350° → 10° gira 20°, no 340°). */
function lerpAngle(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

export default function VehicleMap({
  device,
  position,
  loading,
  failed,
  error,
  stale,
  nextAttemptAt,
  retryDelay,
  failures,
  inFlight,
  onRetry,
  pollInterval = 5000,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const trailRef = useRef(null);
  const animRef = useRef(freshAnim());
  const followRef = useRef(true);
  const programmaticRef = useRef(false);
  const [follow, setFollow] = useState(true);
  // Las teselas tardan en llegar: el esqueleto cubre el mapa hasta que pintan (o 4 s como máximo).
  const [tilesReady, setTilesReady] = useState(false);
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
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
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
    // Un <div> genérico no puede llevar aria-label (ARIA 1.2): le damos rol de región
    // con descripción de rol "mapa" para que el lector lo presente como tal.
    container.setAttribute('role', 'region');
    container.setAttribute('aria-roledescription', 'mapa');
    container.setAttribute(
      'aria-label',
      'Mapa del vehículo. Usa las flechas para desplazarte y las teclas más y menos para acercar o alejar.',
    );

    // Leaflet dibuja los botones de zoom como <a role="button">: responden a Enter
    // pero no a Space, como exige el patrón de botón. Lo completamos.
    container.querySelectorAll('.leaflet-control-zoom a').forEach((a) => {
      a.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          a.click();
        }
      });
    });

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
      trailRef.current = null;
      animRef.current = freshAnim();
    };
  }, []);

  // Capa base única; el tema se aplica con --map-filter (ver tokens.css).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const layer = L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    const done = () => setTilesReady(true);
    layer.on('load', done);
    const fallback = setTimeout(done, 4000); // sin red de teselas: mejor un mapa liso que un esqueleto eterno
    return () => {
      clearTimeout(fallback);
      layer.off('load', done);
      map.removeLayer(layer);
    };
  }, []);

  // Posición nueva → el marcador se desliza hasta ella.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position || !device) return;

    const anim = animRef.current;
    const speed = knotsToKmh(position.speed) ?? 0;
    const target = {
      lat: position.latitude,
      lon: position.longitude,
      // Detenido, Traccar suele reportar rumbo 0: conservamos el último rumbo real para
      // que la flecha no gire de golpe hacia el norte cada vez que el vehículo para.
      course: speed < STOPPED_KMH && anim.lat != null ? anim.course : position.course ?? anim.course,
      speed,
      fix: position.fixTime ?? '',
    };
    const kmh = Math.round(target.speed);
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

      // Teclado sobre el marcador (role="button"):
      //  - al recibir el foco muestra la misma información que al pasar el ratón;
      //  - Enter o Space centran el mapa en el vehículo y reactivan el seguimiento;
      //  - Escape oculta la etiqueta sin mover el foco (WCAG 1.4.13).
      const mel = marker.getElement();
      if (mel) {
        mel.addEventListener('focus', () => marker.openTooltip());
        mel.addEventListener('blur', () => marker.closeTooltip());
        mel.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            e.stopPropagation();
            recenterRef.current();
          } else if (e.key === 'Escape') {
            marker.closeTooltip();
          }
        });
      }
    }
    let trail = trailRef.current;
    if (!trail) {
      trail = L.polyline([], { className: 'vehicle-trail', interactive: false }).addTo(map);
      trailRef.current = trail;
    }

    const el = marker.getElement();
    if (el) {
      el.setAttribute(
        'aria-label',
        `${device.name}: ${status.label.toLowerCase()}, ${kmh} kilómetros por hora${dir ? `, rumbo ${dir.long}` : ''}. ` +
          'Pulsa Enter para centrar el mapa en el vehículo.',
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
    // La estela termina siempre en la punta del marcador, también a mitad de tramo.
    const drawTrail = (lat, lon) => trail.setLatLngs([...anim.trail, [lat, lon]]);

    const place = (lat, lon, course) => {
      anim.lat = lat;
      anim.lon = lon;
      anim.course = course;
      marker.setLatLng([lat, lon]);
      setCourse(course);
      drawTrail(lat, lon);
    };

    const switched = anim.deviceId !== device.id;
    if (switched || anim.lat == null) {
      // Vehículo nuevo: no deslizamos el marcador a través de la ciudad; volamos la cámara.
      cancelAnimationFrame(anim.frame);
      Object.assign(anim, freshAnim(), { deviceId: device.id, fix: target.fix, speed: target.speed, arrivedAt: performance.now() });
      place(target.lat, target.lon, target.course);
      setFollow(true);
      programmaticRef.current = true;
      if (reduced) map.setView([target.lat, target.lon], FOLLOW_ZOOM, { animate: false });
      else map.flyTo([target.lat, target.lon], FOLLOW_ZOOM, { duration: 0.9 });
      map.once('moveend', () => {
        programmaticRef.current = false;
      });
      return;
    }

    // Misma posición de antes (el polling repite el dato o solo cambió el estado): nada que animar.
    if (target.fix && target.fix === anim.fix) return;

    // Ritmo real de llegada de datos (media móvil): define la duración del tramo.
    // Se mide con cada dato nuevo, también con los que luego no mueven el marcador.
    const nowMs = performance.now();
    if (anim.arrivedAt) {
      const measured = nowMs - anim.arrivedAt;
      anim.interval = anim.interval ? anim.interval * 0.6 + measured * 0.4 : measured;
    }
    anim.arrivedAt = nowMs;

    // Posición sin fix GPS válido (valid: false en Traccar): no movemos el marcador a un
    // punto poco fiable; seguimos mostrando el último bueno.
    if (position.valid === false) {
      anim.fix = target.fix;
      return;
    }

    // Vehículo detenido y desplazamiento de pocos metros: es la deriva típica del GPS.
    // Moverlo haría "temblar" el marcador en el sitio; lo dejamos quieto.
    const lastLat = anim.targetLat ?? anim.lat;
    const lastLon = anim.targetLon ?? anim.lon;
    if (target.speed < STOPPED_KMH && metersBetween({ lat: lastLat, lon: lastLon }, target) < JITTER_M) {
      anim.fix = target.fix;
      anim.speed = target.speed;
      return;
    }

    const duration = Math.min(MAX_SEGMENT_MS, Math.max(MIN_SEGMENT_MS, anim.interval || pollInterval));

    // El punto anterior pasa a la estela.
    anim.trail.push([anim.targetLat ?? anim.lat, anim.targetLon ?? anim.lon]);
    if (anim.trail.length > TRAIL_POINTS) anim.trail.shift();
    anim.targetLat = target.lat;
    anim.targetLon = target.lon;

    cancelAnimationFrame(anim.frame);
    const from = { lat: anim.lat, lon: anim.lon, course: anim.course };
    const prevSpeed = anim.speed;
    anim.speed = target.speed;
    anim.fix = target.fix;

    // Salto imposible para un vehículo (reubicación del GPS): reaparece en el sitio nuevo
    // con un fundido, en vez de "volar" sobre los edificios.
    const jump = metersBetween(from, target) > TELEPORT_M;
    if (jump) anim.trail = [];
    if (jump && el && !reduced) {
      // Se apaga donde estaba, se reubica y reaparece.
      el.classList.add('is-relocating');
      anim.frame = requestAnimationFrame(() => {
        setTimeout(() => {
          place(target.lat, target.lon, target.course);
          if (followRef.current) centerOn(target.lat, target.lon);
          el.classList.remove('is-relocating');
        }, 250);
      });
      return;
    }
    if (reduced || jump) {
      place(target.lat, target.lon, target.course);
      if (followRef.current) centerOn(target.lat, target.lon);
      return;
    }

    // Curva según lo que hace el vehículo: arranca (acelera), frena (desacelera) o
    // circula (velocidad constante, la que se ve más natural en un mapa).
    const ease = prevSpeed < 1 && target.speed >= 1 ? easeInCubic : target.speed < 1 ? easeOutCubic : linear;

    const start = nowMs;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      const lat = from.lat + (target.lat - from.lat) * k;
      const lon = from.lon + (target.lon - from.lon) * k;
      const course = lerpAngle(from.course, target.course, easeOutCubic(Math.min(1, (now - start) / TURN_MS)));
      place(lat, lon, course);
      if (followRef.current) centerOn(lat, lon);
      if (t < 1) anim.frame = requestAnimationFrame(step);
    };
    anim.frame = requestAnimationFrame(step);
  }, [position, device, reduced, pollInterval]);

  // Datos detenidos → marcador en gris y sin pulso.
  useEffect(() => {
    markerRef.current?.getElement()?.classList.toggle('is-stale', !!stale);
  }, [stale, position]);

  // Volver a seguir el vehículo recentra suavemente.
  const recenterRef = useRef(() => {});
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
  recenterRef.current = recenter;


  // Si el vehículo deja de tener posición, retiramos el marcador anterior.
  useEffect(() => {
    if ((position === null || failed) && markerRef.current && mapRef.current) {
      cancelAnimationFrame(animRef.current.frame);
      markerRef.current.remove();
      markerRef.current = null;
      trailRef.current?.remove();
      trailRef.current = null;
      animRef.current = freshAnim();
    }
  }, [position, failed]);

  const ready = !loading && !failed && position;
  const name = device?.name ?? 'el vehículo';
  const now = useNow(1000);
  const live = ready && device?.status === 'online' && !stale;
  const covering = loading || (ready && !tilesReady);
  // Si Traccar tarda más de 5 s, el esqueleto lo explica (sin alarmar antes de tiempo).
  const slow = useSlow(loading, 5000);
  const retryIn = nextAttemptAt ? Math.max(0, Math.ceil((nextAttemptAt - now) / 1000)) : null;
  const fix = position?.fixTime ? new Date(position.fixTime) : null;

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <header className="map-toolbar">
        <div className="map-toolbar__title">
          <span className={`live-dot ${live ? 'live-dot--online' : ''}`} aria-hidden="true" />
          <span>
            <h2 id="map-title">{loading ? 'Cargando ubicación' : live ? 'Ubicación en tiempo real' : 'Última ubicación conocida'}</h2>
            <small>
              {loading
                ? 'Conectando con el dispositivo…'
                : stale
                  ? 'Conexión interrumpida · mostrando el último dato recibido'
                  : live
                  ? `Se actualiza sola cada 5 s · ${name}`
                  : `Esperando conexión de ${name}`}
            </small>
          </span>
        </div>
        {fix && !loading && (
          <time className="map-toolbar__updated" dateTime={fix.toISOString()}>
            {relativeTime(fix, now)}
          </time>
        )}
      </header>

      <div className="map-stage">
      {/* className FIJO: Leaflet añade sus propias clases a este nodo (leaflet-container,
          que recorta el mapa con overflow:hidden). Si React cambiara el className, las
          borraría y las teselas se saldrían por encima de la barra superior del mapa. */}
      <div ref={containerRef} className="map" />
        {ready && (
        <div className="map-panel__controls">
          <button type="button" className="map-chip" aria-pressed={follow} onClick={follow ? () => setFollow(false) : recenter}>
            <CrosshairIcon width={18} height={18} />
            {follow ? 'Siguiendo vehículo' : 'Seguir vehículo'}
          </button>
        </div>
      )}

        <MapSkeleton
          hidden={!covering}
          hint={slow ? 'Traccar está respondiendo más lento de lo normal. Esperamos hasta 12 s antes de avisarte de un error.' : null}
          label={loading ? (device ? `Ubicando ${device.name}…` : 'Cargando vehículos…') : 'Cargando mapa…'}
        />

        {stale && ready && (
          <div className="map-toast" role="status">
            <span className="map-toast__text">
              <strong>Sin conexión con Traccar.</strong> Mostramos la última posición conocida;{' '}
              {inFlight ? 'reintentando…' : retryIn > 0 ? `nuevo intento en ${retryIn} s.` : 'reintentando…'}
            </span>
            <button
              type="button"
              className="button button--small button--primary"
              onClick={inFlight ? undefined : onRetry}
              aria-disabled={inFlight || undefined}
            >
              {inFlight ? <span className="spinner" aria-hidden="true" /> : <RetryIcon width={16} height={16} />}
              {inFlight ? 'Reintentando…' : 'Reintentar ahora'}
            </button>
          </div>
        )}

        {!loading && failed && (
        <div className="map-overlay">
          <ErrorState
            error={error}
            onRetry={onRetry}
            nextAttemptAt={nextAttemptAt}
            retryDelay={retryDelay}
            failures={failures}
            inFlight={inFlight}
            compact
          />
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
      </div>
    </section>
  );
}

function freshAnim() {
  return {
    frame: 0,
    deviceId: null,
    lat: null,
    lon: null,
    course: 0,
    speed: 0,
    fix: null,
    arrivedAt: 0,
    interval: 0,
    targetLat: null,
    targetLon: null,
    trail: [],
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
