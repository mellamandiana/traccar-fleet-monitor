import { useCallback, useEffect, useState } from 'react';
import { createTraccarClient } from './api/traccar.js';
import { createSimulatedClient } from './api/simulator.js';
import { DEFAULT_SERVER_ID, serverById } from './config.js';
import { useTheme } from './hooks/useEnvironment.js';
import LoginScreen from './components/LoginScreen.jsx';
import Monitor from './components/Monitor.jsx';
import { BootSkeleton } from './components/Skeletons.jsx';

const SESSION_KEY = 'fm-server';

/**
 * Máquina de estados de alto nivel:
 *   boot → (sesión recuperada) → monitor
 *        → (sin sesión)        → login → monitor
 */
export default function App() {
  const { theme, toggle } = useTheme();
  const [session, setSession] = useState({ phase: 'boot' });
  const [notice, setNotice] = useState(null);

  // Intenta recuperar una sesión previa (la cookie de Traccar puede seguir viva).
  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem(SESSION_KEY);
    } catch {
      /* sin almacenamiento */
    }
    if (!stored) {
      setSession({ phase: 'login' });
      return undefined;
    }
    const controller = new AbortController();
    const client = createTraccarClient(stored);
    client
      .restoreSession(controller.signal)
      .then((user) => setSession({ phase: 'monitor', client, user, server: serverById(stored), simulated: false }))
      .catch((err) => {
        if (err?.name !== 'AbortError') setSession({ phase: 'login', serverId: stored });
      });
    return () => controller.abort();
  }, []);

  const handleLogin = useCallback(async ({ serverId, email, password, simulated }) => {
    const client = simulated ? createSimulatedClient() : createTraccarClient(serverId);
    const user = await client.login(email, password); // los errores los muestra el formulario
    if (!simulated) {
      try {
        localStorage.setItem(SESSION_KEY, serverId);
      } catch {
        /* sin almacenamiento */
      }
    }
    setNotice(null);
    setSession({ phase: 'monitor', client, user, server: simulated ? null : serverById(serverId), simulated: !!simulated });
  }, []);

  const handleLogout = useCallback(
    async (reason) => {
      if (session.phase === 'monitor') await session.client.logout();
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* sin almacenamiento */
      }
      setNotice(reason === 'expired' ? 'Tu sesión en Traccar venció. Inicia sesión de nuevo para seguir monitoreando.' : null);
      setSession({ phase: 'login', serverId: session.server?.id });
    },
    [session],
  );

  if (session.phase === 'boot') return <BootSkeleton />;

  if (session.phase === 'login') {
    return (
      <LoginScreen
        initialServerId={session.serverId ?? DEFAULT_SERVER_ID}
        notice={notice}
        onSubmit={handleLogin}
        theme={theme}
        onToggleTheme={toggle}
      />
    );
  }

  return (
    <Monitor
      client={session.client}
      user={session.user}
      server={session.server}
      simulated={session.simulated}
      theme={theme}
      onToggleTheme={toggle}
      onLogout={handleLogout}
    />
  );
}
