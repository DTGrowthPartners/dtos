// Sistema de temas: claro, oscuro y aurora (vidrio sobre auroras, dark-only).
export type Theme = 'light' | 'dark' | 'aurora';

const STORAGE_KEY = 'theme';

/** Aplica el tema al <html> y lo persiste. */
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  // aurora y dark comparten la base oscura (.dark); aurora suma su capa de vidrio.
  root.classList.toggle('dark', theme === 'dark' || theme === 'aurora');
  root.classList.toggle('aurora', theme === 'aurora');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
};

/** Lee el tema guardado (compat con valores viejos 'dark'/'light'). */
export const getStoredTheme = (): Theme => {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === 'aurora' || t === 'dark' || t === 'light') return t;
    // sin valor: respeta preferencia del SO
    if (!t && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* noop */
  }
  return 'light';
};

/** Aplica el tema guardado (idempotente). Útil al montar la app. */
export const initTheme = () => applyTheme(getStoredTheme());
