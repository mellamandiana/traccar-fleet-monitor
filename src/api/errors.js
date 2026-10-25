/**
 * Errores tipados de la API. Cada tipo tiene su propio micro-copy en la UI,
 * porque "algo salió mal" no le dice al operador qué hacer.
 */
export const ErrorKind = {
  AUTH: 'auth', // 401: credenciales incorrectas o sesión vencida
  OFFLINE: 'offline', // el propio equipo no tiene internet
  NETWORK: 'network', // fetch rechazado: servidor caído o bloqueo CORS
  TIMEOUT: 'timeout', // el servidor no respondió a tiempo
  SERVER: 'server', // 5xx
  NOT_FOUND: 'not-found', // dispositivo inexistente
  API_MISSING: 'api-missing', // la dirección responde, pero no es la API de Traccar (proxy ausente)
  UNKNOWN: 'unknown',
};

export class ApiError extends Error {
  constructor(kind, message, { status, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.cause = cause;
  }
}

export function fromResponse(res, path = '') {
  if (res.status === 401 || res.status === 403) {
    return new ApiError(ErrorKind.AUTH, 'Credenciales rechazadas', { status: res.status });
  }
  if (res.status === 404) {
    // Un 404 en /positions es un vehículo que ya no existe; en /session o /devices
    // significa que en esta dirección no hay API de Traccar (p. ej. proxy sin configurar).
    return path.startsWith('/positions')
      ? new ApiError(ErrorKind.NOT_FOUND, 'Recurso no encontrado', { status: 404 })
      : new ApiError(ErrorKind.API_MISSING, `No hay API de Traccar en ${path || 'esta ruta'}`, { status: 404 });
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    // El proxy no logró llegar a Traccar: para el operador es "servidor caído".
    return new ApiError(ErrorKind.NETWORK, `Pasarela sin respuesta (${res.status})`, { status: res.status });
  }
  if (res.status >= 500) {
    return new ApiError(ErrorKind.SERVER, `El servidor respondió ${res.status}`, { status: res.status });
  }
  return new ApiError(ErrorKind.UNKNOWN, `Respuesta inesperada (${res.status})`, { status: res.status });
}

/** Textos orientados a la acción para cada tipo de error. */
export const ERROR_COPY = {
  [ErrorKind.AUTH]: {
    title: 'El servidor no aceptó tus credenciales',
    body: 'Revisa el correo y la contraseña. En los servidores de demostración de Traccar cada cuenta se crea en la propia web del servidor.',
    action: 'Volver a iniciar sesión',
  },
  [ErrorKind.OFFLINE]: {
    title: 'Tu equipo perdió la conexión a internet',
    body: 'No es un problema de Traccar. En cuanto vuelva la red reintentaremos solos; no hace falta recargar la página.',
    action: 'Reintentar ahora',
  },
  [ErrorKind.NETWORK]: {
    title: 'No logramos comunicarnos con Traccar',
    body: 'El servidor de demostración no respondió: puede estar caído o rechazando conexiones desde este sitio. No es un problema de tu equipo. Reintentaremos solos; también puedes probar con otro servidor.',
    action: 'Reintentar conexión',
  },
  [ErrorKind.TIMEOUT]: {
    title: 'El servidor está tardando demasiado',
    body: 'Traccar no respondió en 12 segundos. Suele ser saturación temporal del servidor de demostración.',
    action: 'Reintentar conexión',
  },
  [ErrorKind.SERVER]: {
    title: 'El servidor de Traccar tuvo un fallo interno',
    body: 'El problema está del lado del servidor, no en tu equipo. Reintenta en unos segundos o cambia de servidor.',
    action: 'Reintentar conexión',
  },
  [ErrorKind.NOT_FOUND]: {
    title: 'Este vehículo ya no está disponible',
    body: 'Puede que lo hayan eliminado o que tu cuenta ya no tenga acceso a él. Elige otro vehículo de la lista.',
    action: 'Recargar vehículos',
  },
  [ErrorKind.API_MISSING]: {
    title: 'No encontramos el servicio de Traccar en esta dirección',
    body: 'El servidor respondió, pero no con los datos de Traccar. Es un problema de configuración del sitio, no de tu cuenta. Prueba con otro servidor o con la flota simulada.',
    action: 'Reintentar conexión',
  },
  [ErrorKind.UNKNOWN]: {
    title: 'No pudimos cargar los datos',
    body: 'Ocurrió un error inesperado al hablar con Traccar. Reintenta; si persiste, cambia de servidor.',
    action: 'Reintentar conexión',
  },
};

/**
 * En el login no hay reintento automático (no tiene sentido reenviar credenciales
 * sin que el usuario lo pida), así que los textos que lo prometen se ajustan.
 */
export const LOGIN_COPY_OVERRIDES = {
  [ErrorKind.NETWORK]: {
    body: 'El servidor de demostración no respondió: puede estar caído o rechazando conexiones desde este sitio. No es un problema de tu equipo. Reintenta en unos segundos o prueba con otro servidor.',
  },
  [ErrorKind.OFFLINE]: {
    body: 'No es un problema de Traccar. Cuando vuelva la red, pulsa Reintentar; tus datos del formulario se conservan.',
  },
};

export function loginCopy(kind) {
  return { ...(ERROR_COPY[kind] ?? ERROR_COPY[ErrorKind.UNKNOWN]), ...(LOGIN_COPY_OVERRIDES[kind] ?? {}) };
}
