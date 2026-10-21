# Monitor de flota · Traccar

Monitor de vehículo en tiempo real para una central de operaciones. Se conecta a la API pública de [Traccar](https://www.traccar.org/), lista los dispositivos de la cuenta y muestra la posición del vehículo elegido en un mapa, con una tarjeta de estado que se actualiza cada 5 segundos.

**Stack:** React 18 · Vite 5 · Leaflet 1.9 · CSS Custom Properties (sin framework de estilos).

---

## Ejecutar en local

Requisitos: Node 18 o superior.

```bash
npm install
npm run dev        # http://localhost:5173
```

Build de producción y vista previa (incluye el mismo proxy):

```bash
npm run build
npm run preview    # http://localhost:4173
```

### Cuenta para entrar

Los servidores de demostración de Traccar (`demo.traccar.org`, `demo2`, `demo3`, `demo4`) **no traen un usuario compartido**: cada persona crea su cuenta gratis en la web del servidor y añade ahí sus dispositivos. Pasos:

1. Abre https://demo4.traccar.org y pulsa *Registrarse*.
2. Entra en el monitor con ese correo y contraseña, eligiendo el mismo servidor.

Si el servidor está caído o tu cuenta no tiene vehículos en movimiento, usa **«Explorar con una flota simulada»**: cinco vehículos ficticios en Bogotá que recorren rutas reales, con la misma interfaz de datos que Traccar (velocidad en nudos, `course`, `batteryLevel`, `status`).

---

## Cómo se conecta a Traccar

| Paso | Llamada | Dónde |
| --- | --- | --- |
| 1. Autenticación | `POST /api/session` (form-urlencoded `email`, `password`) | `src/api/traccar.js → login` |
| — Recuperar sesión al recargar | `GET /api/session` | `restoreSession` |
| 2. Dispositivos | `GET /api/devices` (cada 30 s, para el estado online/offline) | `getDevices` |
| 3. Posición | `GET /api/positions?deviceId={id}` (cada 5 s) | `getLatestPosition` |
| Cerrar sesión | `DELETE /api/session` | `logout` |

La sesión viaja en la cookie `JSESSIONID` que emite Traccar (`credentials: 'include'`).

### Proxy y CORS

Los servidores de demostración no permiten peticiones con credenciales desde otros orígenes, así que el navegador **nunca llama directo a traccar.org**. Todas las peticiones van a `/proxy/<servidor>/api/...` en el mismo origen de la app:

- **Desarrollo:** el proxy de Vite (`vite.config.js`), que además reescribe el dominio de la cookie a `localhost`.
- **Vercel:** reglas `rewrites` en `vercel.json`.
- **Netlify:** reglas en `public/_redirects`.

Así la cookie de sesión es *first-party* y no hay bloqueo CORS.

### Variables de entorno (opcionales)

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `VITE_DEFAULT_SERVER` | `demo4` | Servidor preseleccionado en el login (`demo`, `demo2`, `demo3`, `demo4`) |
| `VITE_POSITION_POLL_MS` | `5000` | Intervalo de consulta de la posición |

Para añadir otro servidor Traccar: agrégalo en `src/config.js` y crea su regla de proxy en `vite.config.js`, `vercel.json` y `public/_redirects`.

---

## Desplegar

**Vercel:** importa el repositorio; detecta Vite (build `npm run build`, salida `dist`). `vercel.json` ya incluye el proxy y el fallback SPA.

**Netlify:** build `npm run build`, publish `dist`. `public/_redirects` se copia al build.

> GitHub Pages no sirve: es hosting estático sin proxy, y sin proxy el navegador bloquea la API por CORS.

---

## Decisiones de diseño

**Concepto «luz de sodio».** El acento ámbar viene del alumbrado vial nocturno; marca solo dos cosas: el vehículo y el foco del teclado. Todo lo demás es neutro azul pizarra para que el ojo del operador vaya directo al vehículo. La tipografía es **Barlow**, inspirada en la señalización de carreteras, con cifras tabulares para que las lecturas no «bailen» al cambiar.

**Jerarquía de la tarjeta.** Nombre → conexión → velocidad (la cifra más grande: es lo que cambia y lo que más se vigila) → datos de contexto (última actualización, rumbo, batería, coordenadas) en una `<dl>`.

**Estados críticos.**
- *Carga:* esqueletos con las mismas dimensiones que el contenido final (CLS medido ≈ 0,002). El mapa muestra calles esbozadas y una baliza que «busca señal».
- *Error:* cada tipo de fallo (credenciales, red/CORS, tiempo de espera, 5xx, recurso inexistente) tiene su propio texto con qué pasó y qué hacer. Reintento manual y automático con espera exponencial (5 s → 60 s) y cuenta atrás visible. Detalle técnico plegado.
- *Degradado:* si un refresco falla **después** de tener datos, no se pierde nada: se conserva la última posición, los colores de la tarjeta se apagan y aparece «Mostrando la última posición conocida».
- *Movimiento:* el marcador se desliza 1,4 s con *ease-in-out*; el giro se resuelve por el camino corto y termina antes que el desplazamiento. Al cambiar de vehículo la cámara vuela en lugar de cruzar el marcador por la ciudad.
- *Seguimiento:* el mapa se centra solo en cada posición; si el operador arrastra o usa las flechas, deja de seguir hasta que pulse «Seguir vehículo».

**Accesibilidad (WCAG 2.1 AA).**
- `<dl>/<dt>/<dd>` para los pares etiqueta-valor; `<time datetime>` para la marca de tiempo.
- Selector de vehículos con radios nativos en un `<fieldset>`: una sola parada de Tab y flechas ↑/↓ para cambiar.
- Contraste verificado por script: texto ≥ 5,1:1 en el tema claro y ≥ 5,0:1 en el oscuro.
- Foco visible de 3 px en color de acento sobre todos los controles (incluido el marcador y los controles de Leaflet); nunca `outline: none` sin reemplazo.
- `aria-live="polite"` que anuncia solo lo relevante (vehículo nuevo, cambio de conexión, arranque/parada) en vez de cada lectura cada 5 s.
- Marcador con `aria-label` («Furgón 12: en línea, 41 kilómetros por hora, rumbo sur»), enfocable y con tooltip.
- Enlace «Saltar a la tarjeta del vehículo», objetivos táctiles de 44 px, `prefers-reduced-motion` y `forced-colors` respetados.

---

## Estructura

```
src/
  api/          traccar.js (cliente), errors.js (tipos y textos), simulator.js (flota simulada)
  hooks/        usePolling.js (polling + reintentos + pausa en segundo plano), useEnvironment.js
  components/   Monitor, StatusCard, VehicleMap, DeviceList, ErrorState, Skeletons, LoginScreen…
  styles/       tokens.css (sistema de diseño claro/oscuro), app.css
  utils/        format.js (nudos→km/h, tiempo relativo, rumbo)
```

## Herramientas de prueba

- `?fallos=0.5` en la URL hace fallar el 50 % de las consultas de posición de la flota simulada, para ver el estado degradado y el reintento.
- Con `?fallos=1` se ve el estado de error del mapa.
