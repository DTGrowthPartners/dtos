// uiDriver — el "copiloto de navegación" del chat (María).
// Traduce una acción de UI del bot ({vista, params, highlight}) a navegación real:
// lleva al usuario a la vista correcta con el formulario/detalle precargado
// (cada página lee sus query params) y, opcionalmente, señala un elemento
// marcado con data-tour="..." estilo tour.js.

export interface UiAction {
  vista: string;
  params?: Record<string, any>;
  highlight?: string;
}

type NavigateFn = (to: string) => void;

/** Construye la URL interna para una acción de UI. null si la vista no existe. */
export function buildUiUrl(a: UiAction): string | null {
  const p = a.params || {};
  const set = (q: URLSearchParams, key: string, v: any) => {
    if (v != null && v !== '') q.set(key, String(v));
  };

  switch (a.vista) {
    case 'tareas.nueva': {
      const q = new URLSearchParams({ action: 'new' });
      set(q, 'titulo', p.titulo ?? p.title);
      set(q, 'descripcion', p.descripcion ?? p.description);
      set(q, 'asignado', p.asignado ?? p.assignee);
      set(q, 'prioridad', p.prioridad ?? p.priority);
      set(q, 'fechaFin', p.fechaFin ?? p.dueDate);
      return `/tareas?${q.toString()}`;
    }
    case 'cuentas-cobro.nueva': {
      const q = new URLSearchParams({ nueva: '1' });
      set(q, 'cliente', p.cliente ?? p.nombre_cliente ?? p.nombre);
      set(q, 'concepto', p.concepto);
      const items = p.servicios ?? p.items;
      if (Array.isArray(items) && items.length) q.set('items', JSON.stringify(items));
      return `/cuentas-cobro?${q.toString()}`;
    }
    case 'clientes.detalle': {
      const q = new URLSearchParams();
      set(q, 'cliente', p.nombre ?? p.cliente ?? p.name);
      return `/clientes?${q.toString()}`;
    }
    case 'clientes': return '/clientes';
    case 'tareas': return '/tareas';
    case 'cuentas-cobro': return '/cuentas-cobro';
    case 'cobros': return '/cobros';
    case 'crm': case 'ventas': return '/crm';
    case 'finanzas': return p.tab ? `/finanzas?tab=${encodeURIComponent(String(p.tab))}` : '/finanzas';
    case 'finanzas.reportes': return '/finanzas?tab=reportes';
    case 'dashboard': return '/';
    default: return null;
  }
}

/**
 * Señala un elemento marcado con data-tour="<id>": espera a que exista (la vista
 * puede estar cargando), hace scroll hasta él y lo pulsa con un halo azul.
 */
export function highlightElement(tourId: string, maxTries = 25) {
  let tries = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${tourId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate(
        [
          { boxShadow: '0 0 0 0 rgba(59,130,246,0.85)', borderRadius: '12px' },
          { boxShadow: '0 0 0 14px rgba(59,130,246,0)', borderRadius: '12px' },
        ],
        { duration: 1100, iterations: 4, easing: 'ease-out' }
      );
      return;
    }
    if (++tries < maxTries) setTimeout(tick, 300);
  };
  // pequeño delay inicial para dar tiempo a montar la vista tras navegar
  setTimeout(tick, 400);
}

/** Ejecuta una acción de UI: navega y/o resalta. Devuelve true si hizo algo. */
export function driveTo(action: UiAction, navigate: NavigateFn): boolean {
  if (!action || typeof action.vista !== 'string') return false;
  const url = buildUiUrl(action);
  if (url) navigate(url);
  if (action.highlight) highlightElement(action.highlight);
  return !!url || !!action.highlight;
}
