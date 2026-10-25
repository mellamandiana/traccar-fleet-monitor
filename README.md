# Monitor de flota · Traccar

Monitor de vehículo en tiempo real para una central de operaciones. Se conecta a la API pública de [Traccar](https://www.traccar.org/), lista los dispositivos de la cuenta y muestra la posición del vehículo elegido en un mapa, con una tarjeta de estado que se actualiza cada 5 segundos.

**App desplegada:** https://traccarmellamandiana.netlify.app/ (Netlify, con el proxy hacia Traccar de `public/_redirects`).

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

**Estilo visual (Figma Make «Real-Time Vehicle Monitor»).** Lenguaje Material: barra superior índigo `#1a237e`, Roboto, tarjetas blancas con elevación suave y radio de 6 px, acento índigo `#3f51b5`, panel de velocidad sobre índigo claro `#e8eaf6` y filas de telemetría con icono en círculo. Los valores salen del `index.css` del Figma y viven en `src/styles/tokens.css`. Ajustes para cumplir AA: texto secundario `#616161` en vez de `#757575`, verde de estado `#2e7d32` como texto, tamaño mínimo de 12 px y una barra superior índigo profunda en modo oscuro (el `#aab6fe` del Figma con texto blanco no llega a 2:1). Se quitaron a propósito las barras de acento laterales del Figma (panel de velocidad, fila seleccionada, avisos), un recurso demasiado genérico: la selección se marca con fondo, contorno fino y nombre en negrita, y los avisos con un borde tenue completo.

**Barra superior (Figma), toda funcional.** En el Figma estos controles son decorativos; aquí cada uno hace algo real:
- **Búsqueda:** lleva el foco al buscador de vehículos. Atajo `/` (`aria-keyshortcuts`).
- **Notificaciones:** registro de eventos de la flota, derivado de los datos que ya se consultan (sin llamadas extra): un vehículo se desconecta, deja de reportar o vuelve a estar en línea; el seleccionado se detiene o se pone en marcha; batería baja; conexión con Traccar perdida o recuperada. El punto rojo marca los eventos sin leer (el nombre accesible dice «Notificaciones, 2 sin leer»), y al pulsar un evento se selecciona ese vehículo. En la flota simulada, la moto pierde la señal un minuto cada tres, como al cruzar un túnel, para que haya eventos reales en la demo.
- **Tema:** interruptor con sol y luna a los lados.
- **Operador:** avatar con iniciales, nombre y rol (Administrador u Operador de flota, según Traccar). Abre un panel con la cuenta, el origen de los datos y «Cerrar sesión».
- Los paneles siguen el patrón *disclosure* de WAI-ARIA: `aria-expanded` y `aria-controls`, el panel justo después del botón (Tab entra en él), Esc cierra y devuelve el foco, y un clic fuera también cierra. En móvil se anclan a la ventana para no salirse de la pantalla. A 320 px se ocultan la lupa (el buscador queda a un desplazamiento) y los iconos del interruptor, para que todo quepa sin scroll horizontal.

**Iconos por tipo de vehículo.** Cada vehículo muestra su silueta de perfil, dibujada con el mismo trazo que la iconografía del Figma: camión, furgón, camioneta, bus, moto, automóvil y uno genérico de respaldo (`src/components/VehicleIcon.jsx`). Las siluetas se distinguen por la forma (caja de carga, ventanillas, dos ruedas) y se leen bien a 20 px. El tipo sale del campo `category` de Traccar (`truck`, `van`, `pickup`, `bus`, `motorcycle`, `car`, `scooter`…). Si viene vacío, se deduce del nombre («Moto 31», «Bus 22»…). En la lista, el icono va en un avatar con el estado de conexión en la esquina; en la tarjeta, en la insignia, con el tipo también como texto («Camión»), porque la información no puede depender solo del dibujo. El marcador del mapa conserva la flecha, que muestra el rumbo.

**Jerarquía de la tarjeta.** Nombre → conexión → velocidad (la cifra más grande: es lo que cambia y lo que más se vigila) → datos de contexto (última actualización, rumbo, batería, coordenadas) en una `<dl>`.

**Estados críticos** (medidos con Playwright; ver «Herramientas de prueba»).

*Carga (skeleton).*
- **Arranque sin pantalla vacía:** mientras se recupera la sesión guardada se pinta la estructura completa de la app (barra, tarjeta, mapa y lista) con sus esqueletos, en lugar de un spinner sobre fondo en blanco. Cuando llegan los datos, cada pieza se reemplaza en su sitio.
- **Revelación progresiva:** si Traccar tarda más de 5 s, el esqueleto lo explica («Traccar está respondiendo más lento de lo normal…»). Los primeros segundos no se muestra nada que alarme.
- Esqueletos con las mismas medidas que el contenido final (la tarjeta reserva 528 px). CLS medido: **0,001** en escritorio con 2,5 s de latencia y **0** en móvil.
- Un solo brillo recorre todos los esqueletos a la vez (`background-attachment: fixed`), en vez de veinte destellos sueltos.
- El esqueleto del mapa (calles esbozadas y una baliza) **se queda hasta que pintan las teselas** y luego se desvanece. No hay salto a un mapa gris a medio cargar; si las teselas no llegan en 4 s, se retira igual.
- El contenido real entra con un fundido de 320 ms. Solo cambia la opacidad, nunca el tamaño ni la posición.

*Error.*
- **La app nunca queda en blanco:** un `ErrorBoundary` captura cualquier excepción de React y muestra una pantalla de error con la misma estética y el foco en el título. «Volver a cargar la vista» reconstruye el monitor **sin pedir login otra vez**, porque la sesión vive fuera del límite.
- **API no encontrada:** un 404 en `/session` o `/devices`, o una página HTML donde debía llegar JSON (típico al desplegar sin el proxy, por ejemplo en GitHub Pages), tiene su propio mensaje en lugar de un «vehículo no encontrado» que no aplica.
- **Login:** el aviso de error trae acciones. Si el servidor falla, «Reintentar» (con «Reintentando…» sobre el mismo aviso, sin que el formulario salte) y «Usar la flota simulada». Si las credenciales fallan, «Corregir la contraseña» lleva el foco al campo. Un reintento que vuelve a fallar no le quita el foco al botón: se anuncia «Intento 2…».
- Cada fallo tiene su propio texto: credenciales, servidor caído o bloqueo CORS, **equipo sin internet** (`navigator.onLine`), tiempo de espera, 5xx y recurso inexistente. Cada texto dice qué pasó, de quién es el problema y qué hacer.
- Reintento automático con espera exponencial (5 s → 60 s) y **barra de cuenta atrás**. Cuando el equipo recupera la red se reintenta al instante.
- Al pulsar «Reintentar» la tarjeta **no se desmonta**: el botón pasa a «Reintentando…» con `aria-disabled` en vez de `disabled`, así el foco del teclado se queda en el botón. Los intentos fallidos se anuncian con `aria-live="polite"`.
- *Degradado:* si un refresco falla después de tener datos, se conserva la última posición. La tarjeta y el marcador pierden el color, y un aviso **flotante sobre el mapa** (fuera del flujo, con CLS 0,0001) ofrece reintentar. En la tarjeta, el aviso reemplaza la hora en la misma línea.

*Movimiento del marcador.*
- **Interpolación continua:** cada posición nueva es el destino de un tramo que dura lo mismo que el intervalo real entre datos (media móvil). El marcador llega justo cuando llega el siguiente dato, así que nunca se detiene a esperar. Medido: en movimiento el **99 %** del tiempo, con una pausa máxima de 100 ms. Antes eran tramos de 1,4 s seguidos de unos 3,6 s quieto.
- La curva depende de lo que hace el vehículo: velocidad constante al circular, acelera al arrancar y desacelera al frenar. El giro se resuelve en 600 ms por el camino corto.
- **Estela de ruta reciente** (unas 24 posiciones) que termina siempre en la punta del marcador.
- Si el GPS salta más de 1,5 km (reubicación), el marcador se apaga y reaparece en el sitio nuevo en vez de cruzar la ciudad. Lo mismo pasa al cambiar de vehículo: la cámara vuela hasta él.
- **Datos reales de Traccar:**
  - Cuando el vehículo se detiene, Traccar suele enviar rumbo 0. La flecha **conserva el último rumbo real** en vez de girar de golpe al norte.
  - Con el vehículo parado, los movimientos de menos de 15 m son deriva del GPS, así que el marcador **no tiembla**.
  - Las posiciones con `valid: false` no mueven el marcador.
- Con `prefers-reduced-motion` las posiciones se colocan sin animación.

*Seguimiento.* El mapa se centra solo en cada posición. Si el operador arrastra o usa las flechas, deja de seguir hasta que pulse «Seguir vehículo».

**Accesibilidad (WCAG 2.1 AA).** Verificada con **axe-core 4.10** (reglas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `best-practice`): **0 fallos** en login, monitor claro y oscuro, móvil a 320 px y pantalla de error. Además se probó a mano todo el recorrido con teclado.

*Estructura semántica*
- La tarjeta de estado es un `<section>` con un `<h2>`, y **todos** sus pares etiqueta-valor van en `<dl>/<dt>/<dd>`: velocidad, actualización, rumbo, batería y ubicación, más el identificador y la conexión de la cabecera (sus `<dt>` están ocultos a la vista pero el lector los lee). `<time datetime>` para la hora y `<abbr title>` para «km/h» y los puntos cardinales.
- Un solo `<h1>` («Monitor de flota») y un `<h2>` por sección (vehículo, mapa, lista). Hay landmarks `header`/`main`, enlaces para saltar a la tarjeta y a la lista, y el título de la pestaña nombra el vehículo (2.4.2).
- El selector de vehículos usa radios nativos dentro de `<fieldset>/<legend>`.

*Teclado (Tab, Space, Enter)*
| Control | Teclas |
| --- | --- |
| Tema oscuro (`<button aria-pressed>`) | Space / Enter |
| Selector de vehículos (grupo de radios) | Tab entra al grupo · ↑ ↓ cambian de vehículo |
| Buscar y «Solo en línea» | Tab · Space |
| Mapa | Tab · flechas desplazan · + / − acercan |
| Zoom de Leaflet | Enter **y Space** (Leaflet solo traía Enter en sus `<a role="button">`; se añadió Space) |
| Marcador del vehículo (`role="button"`) | Al enfocarlo muestra la etiqueta · Enter / Space centran el mapa · Esc oculta la etiqueta (1.4.13) |
| Seguir vehículo (`aria-pressed`) | Space / Enter |
| Reintentar | Space / Enter. Usa `aria-disabled` mientras reintenta, así el foco no se pierde |

*Indicadores de foco*
- Anillo de 3 px, separado 2 px del control y con un halo suave: índigo `#3f51b5` (6,9:1) en claro, `#aab6fe` (8,6:1) en oscuro y blanco (13:1) sobre la barra superior. En el marcador y en «Seguir vehículo» sigue la forma redonda del control.
- **No hay `outline: none` en todo el CSS.** El anillo solo aparece con teclado gracias a `:focus-visible`. Hay un respaldo para navegadores sin ese selector, y el modo de alto contraste de Windows usa el color del sistema.

*Atributos accesibles y anuncios*
- `aria-live="polite"` **dentro de la tarjeta**, como primer hijo y montado desde el esqueleto, para que el lector anuncie los cambios. Solo anuncia lo que cambia una decisión: vehículo elegido, cambio de conexión, arranque o parada, cambios de velocidad de 20 km/h o más (como mucho uno cada 20 s), batería baja, y pérdida o recuperación de los datos en vivo. Leer la velocidad cada 5 s sería ruido.
- Marcador con `aria-label` dinámico: «Furgón 12: en línea, 41 kilómetros por hora, rumbo sur. Pulsa Enter para centrar el mapa en el vehículo».
- El mapa es `role="region"` con `aria-roledescription="mapa"` e instrucciones de teclado en su `aria-label`.
- Errores con `role="alert"`. En el login, los campos apuntan al mensaje de error con `aria-invalid` y `aria-describedby`.

*Más allá de lo mínimo*
- **El estado no depende solo del color (1.4.1):** en línea es un círculo con pulso, sin señal un anillo y desconectado un cuadrado, además del texto.
- **Reflujo a 320 px sin scroll horizontal (1.4.10).** Los textos ocultos en móvil siguen disponibles para el lector.
- Contraste de texto ≥ 4,5:1 verificado por script en ambos temas. Los objetivos táctiles miden al menos 40–44 px. Se respeta `prefers-reduced-motion`.

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

Con la flota simulada, estos parámetros en la URL muestran cada estado. Sirven para el video y se pueden combinar:

| URL | Qué muestra |
| --- | --- |
| `/?latencia=3000` | Cada respuesta tarda 3 s más: se ven los esqueletos y el fundido de entrada |
| `/?caido=1` | El servidor está caído: pantalla de error con cuenta atrás y reintento |
| `/?fallos=0.5` | Falla la mitad de las consultas de posición: estado degradado con el aviso flotante |
| `/?fallos=1` | Fallan todas las consultas de posición: error dentro del mapa |
| `/?parado=1` | Los vehículos circulan 8 s y se detienen con deriva GPS y rumbo 0: el marcador queda quieto y la flecha conserva el rumbo |
| `/?romper=1` | Falla el render del monitor: pantalla del ErrorBoundary y recuperación sin login |

El estado «sin internet» se ve al desactivar el Wi-Fi con la app abierta. Al reactivarlo, la app reintenta sola.
