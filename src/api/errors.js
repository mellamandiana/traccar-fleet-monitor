/**
 * Errores tipados de la API. Cada tipo tiene su propio micro-copy en la UI,
 * porque "algo salió mal" no le dice al operador qué hacer.
 */
export const ErrorKind = {
  AUTH: 'auth', // 401: credenciales incorrectas o sesión vencida
  NETWORK: 'network', // fetch rechazado: servidor caído, sin conexión o CORS
  TIMEOUT: 'timeout', // el servidor no respondió a tiempo
  SERVER: 'server', // 5xx
  NOT_FOUND: 'not-found', // dispositivo o recurso inexistente
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

export function fromResponse(res) {
  if (res.status === 401 || res.status === 403) {
    return new ApiError(ErrorKind.AUTH, 'Credenciales rechazadas', { status: res.status });
  }
  if (res.status === 404) {
    return new ApiError(ErrorKind.NOT_FOUND, 'Recurso no encontrado', { status: res.status });
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
  [ErrorKind.NETWORK]: {
    title: 'No hay conexión con el servidor de Traccar',
    body: 'El servidor de demostración puede estar caído o bloqueando la conexión. Tus datos siguen a salvo; reintenta en unos segundos o prueba con otro servidor.',
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
  [ErrorKind.UNKNOWN]: {
    title: 'No pudimos cargar los datos',
    body: 'Ocurrió un error inesperado al hablar con Traccar. Reintenta; si persiste, cambia de servidor.',
    action: 'Reintentar conexión',
  },
};
