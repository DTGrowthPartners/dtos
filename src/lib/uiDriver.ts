// uiDriver — el "copiloto de navegación" del chat (María).
// Traduce una acción de UI del bot ({vista, params, highlight}) a navegación real:
// lleva al usuario a la vista correcta con el formulario/detalle precargado
// (cada página lee sus query params) y, opcionalmente, señala un elemento
// marcado con data-tour="..." estilo tour.js.

export interface TourStep {
  el: string;     // id de data-tour del elemento a señalar
  texto: string;  // explicación que se muestra en el popover
}

export interface UiAction {
  vista: string;
  params?: Record<string, any>;
  highlight?: string;
  tour?: TourStep[];
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
    case 'crm.deal-nuevo': {
      const q = new URLSearchParams({ nuevo: '1' });
      set(q, 'nombre', p.nombre ?? p.name);
      set(q, 'empresa', p.empresa ?? p.company);
      set(q, 'telefono', p.telefono ?? p.phone);
      set(q, 'email', p.email);
      set(q, 'valor', p.valor ?? p.valorEstimado ?? p.estimatedValue);
      return `/crm?${q.toString()}`;
    }
    case 'finanzas.ingreso':
    case 'finanzas.gasto': {
      const q = new URLSearchParams({ registrar: a.vista === 'finanzas.ingreso' ? 'ingreso' : 'gasto' });
      set(q, 'importe', p.importe ?? p.valor ?? p.monto);
      set(q, 'descripcion', p.descripcion);
      set(q, 'categoria', p.categoria);
      set(q, 'entidad', p.entidad ?? p.tercero ?? p.cliente);
      set(q, 'cuenta', p.cuenta);
      return `/finanzas?${q.toString()}`;
    }
    case 'cobros': {
      const q = new URLSearchParams();
      set(q, 'buscar', p.cliente ?? p.nombre ?? p.buscar);
      const qs = q.toString();
      return qs ? `/cobros?${qs}` : '/cobros';
    }
    case 'clientes': return '/clientes';
    case 'tareas': return '/tareas';
    case 'cuentas-cobro': return '/cuentas-cobro';
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

/**
 * Tour multi-paso estilo driver.js: señala elementos data-tour en secuencia con
 * un popover flotante (texto + contador + Siguiente/Cerrar). Sin dependencias.
 */
export function runTour(steps: TourStep[]) {
  const valid = (steps || []).filter((s) => s && s.el && s.texto);
  if (!valid.length) return;

  let idx = 0;
  let card: HTMLDivElement | null = null;

  const cleanup = () => { card?.remove(); card = null; };

  const showStep = (tries = 0) => {
    cleanup();
    const step = valid[idx];
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.el}"]`);
    if (!el) {
      // la vista puede estar cargando; reintenta un rato y si no, salta el paso
      if (tries < 20) { setTimeout(() => showStep(tries + 1), 300); return; }
      idx++;
      if (idx < valid.length) showStep();
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [
        { boxShadow: '0 0 0 0 rgba(59,130,246,0.85)', borderRadius: '12px' },
        { boxShadow: '0 0 0 14px rgba(59,130,246,0)', borderRadius: '12px' },
      ],
      { duration: 1100, iterations: 30, easing: 'ease-out' }
    );

    card = document.createElement('div');
    card.style.cssText = [
      'position:fixed', 'z-index:9999', 'max-width:300px', 'padding:12px 14px',
      'background:#1e293b', 'color:#f1f5f9', 'border:1px solid #334155',
      'border-radius:12px', 'box-shadow:0 8px 30px rgba(0,0,0,.45)',
      'font-size:13px', 'line-height:1.45', 'font-family:inherit',
    ].join(';');

    const isLast = idx === valid.length - 1;
    card.innerHTML =
      `<div style="margin-bottom:10px">${step.texto}</div>` +
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">` +
      `<span style="font-size:11px;color:#94a3b8">${idx + 1} de ${valid.length}</span>` +
      `<span style="display:flex;gap:6px">` +
      `<button data-t="close" style="background:transparent;color:#94a3b8;border:none;font-size:12px;cursor:pointer;padding:4px 8px">Cerrar</button>` +
      `<button data-t="next" style="background:#3b82f6;color:#fff;border:none;font-size:12px;cursor:pointer;padding:5px 12px;border-radius:8px;font-weight:600">${isLast ? 'Listo ✓' : 'Siguiente →'}</button>` +
      `</span></div>`;

    card.querySelector<HTMLButtonElement>('[data-t="close"]')!.onclick = cleanup;
    card.querySelector<HTMLButtonElement>('[data-t="next"]')!.onclick = () => {
      idx++;
      if (idx < valid.length) showStep();
      else cleanup();
    };

    document.body.appendChild(card);
    // Posiciona el popover debajo del elemento (o encima si no cabe), tras el scroll suave.
    setTimeout(() => {
      if (!card) return;
      const r = el.getBoundingClientRect();
      const ch = card.offsetHeight, cw = card.offsetWidth;
      let top = r.bottom + 10;
      if (top + ch > window.innerHeight - 10) top = Math.max(10, r.top - ch - 10);
      let left = Math.min(Math.max(10, r.left), window.innerWidth - cw - 10);
      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
    }, 450);
  };

  // delay inicial para que la vista monte tras la navegación
  setTimeout(() => showStep(), 500);
}

/** Ejecuta una acción de UI: navega, resalta y/o corre un tour. Devuelve true si hizo algo. */
export function driveTo(action: UiAction, navigate: NavigateFn): boolean {
  if (!action || typeof action.vista !== 'string') return false;
  const url = buildUiUrl(action);
  if (url) navigate(url);
  if (action.tour && action.tour.length) runTour(action.tour);
  else if (action.highlight) highlightElement(action.highlight);
  return !!url || !!action.highlight || !!(action.tour && action.tour.length);
}
