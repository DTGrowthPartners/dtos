// Sistema de temas: claro, oscuro, aurora (vidrio sobre auroras) y liquid (Apple liquid glass).
export type Theme = 'light' | 'dark' | 'aurora' | 'liquid';

const STORAGE_KEY = 'theme';

/** Aplica el tema al <html> y lo persiste. */
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  // aurora, dark y liquid comparten la base oscura (.dark); aurora/liquid suman su capa de vidrio.
  root.classList.toggle('dark', theme === 'dark' || theme === 'aurora' || theme === 'liquid');
  root.classList.toggle('aurora', theme === 'aurora');
  root.classList.toggle('liquid', theme === 'liquid');
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
    if (t === 'aurora' || t === 'dark' || t === 'light' || t === 'liquid') return t;
    // sin valor: respeta preferencia del SO
    if (!t && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* noop */
  }
  return 'light';
};

/** Aplica el tema guardado (idempotente). Útil al montar la app. */
export const initTheme = () => applyTheme(getStoredTheme());
