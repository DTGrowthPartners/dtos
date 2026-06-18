// Genera el HTML de una propuesta con la plantilla de marca DT Growth Partners,
// a partir del JSON estructurado que produce la IA. Se usa para el preview (iframe)
// y para exportar a PDF (abrir e imprimir). Basado en el formato de las propuestas
// de ejemplo de DTGP.

export interface ProposalItem { concepto: string; valor: string }
export interface ProposalTable { items: ProposalItem[]; total?: string }
export interface ProposalData {
  cliente: string;
  titulo: string;
  subtitulo?: string;
  fecha?: string;
  resumenEjecutivo?: string;
  diagnostico?: { intro?: string; puntos?: string[] };
  oportunidad?: string;
  solucion?: string;
  capacidades?: { icon?: string; titulo: string; descripcion: string }[];
  fases?: { titulo: string; descripcion: string }[];
  inversion?: { implementacion?: ProposalTable; mensual?: ProposalTable; oferta?: string };
  roi?: { texto?: string; cifras?: { label: string; valor: string }[] };
  porQue?: string[];
  notaPrecios?: string;
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const priceTable = (t?: ProposalTable): string => {
  if (!t || !t.items || t.items.length === 0) return '';
  const rows = t.items
    .map((it) => `<tr><td>${esc(it.concepto)}</td><td>${esc(it.valor)}</td></tr>`)
    .join('');
  const total = t.total
    ? `<tr class="total-row"><td><strong>Total</strong></td><td><strong>${esc(t.total)}</strong></td></tr>`
    : '';
  return `<table class="price-table"><tr><th>Concepto</th><th>Valor</th></tr>${rows}${total}</table>`;
};

export function buildProposalHTML(d: ProposalData): string {
  const capacidades = (d.capacidades || [])
    .map(
      (c) =>
        `<div class="benefit-card"><h4>${esc(c.icon || '✅')} ${esc(c.titulo)}</h4><p>${esc(c.descripcion)}</p></div>`
    )
    .join('');

  const fases = (d.fases || [])
    .map(
      (f, i) =>
        `<div class="phase"><div class="phase-num">${i + 1}</div><div class="phase-content"><h4>${esc(
          f.titulo
        )}</h4><p>${esc(f.descripcion)}</p></div></div>`
    )
    .join('');

  const diagPuntos = (d.diagnostico?.puntos || []).map((p) => `<li>${esc(p)}</li>`).join('');
  const porQue = (d.porQue || []).map((p) => `<li>${esc(p)}</li>`).join('');

  const impl = priceTable(d.inversion?.implementacion);
  const mensual = priceTable(d.inversion?.mensual);
  const oferta = d.inversion?.oferta
    ? `<div class="highlight-box"><strong>🎁 Oferta:</strong> ${esc(d.inversion.oferta)}</div>`
    : '';

  const roiCifras = (d.roi?.cifras || [])
    .map((c) => `<div class="label">${esc(c.label)}</div><div class="big-number">${esc(c.valor)}</div>`)
    .join('');
  const roiBlock =
    d.roi && (d.roi.texto || roiCifras)
      ? `<h2>Retorno de Inversión (ROI)</h2>${
          roiCifras ? `<div class="roi-box">${roiCifras}</div>` : ''
        }${d.roi.texto ? `<p>${esc(d.roi.texto)}</p>` : ''}`
      : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Propuesta ${esc(
    d.cliente
  )}</title><style>
@page { margin: 40px 50px; size: A4; }
* { box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; line-height: 1.6; margin: 0; padding: 0; }
.cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%); color: white; text-align: center; page-break-after: always; padding: 40px; }
.cover h1 { font-size: 36px; margin: 10px 0; letter-spacing: 2px; }
.cover h2 { font-size: 20px; font-weight: 300; margin: 0 0 10px; color: #7eb8e0; }
.cover .logo-text { font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #5a9fd4; margin-bottom: 40px; }
.cover .for { font-size: 16px; color: #c0d8ec; margin-top: 20px; }
.cover .client { font-size: 24px; color: #fff; font-weight: 600; margin-top: 6px; }
.cover .date { font-size: 14px; color: #8ab4d4; margin-top: 16px; }
.cover .divider { width: 80px; height: 3px; background: #5a9fd4; margin: 24px auto; }
.page { padding: 40px 50px; page-break-after: always; }
.page:last-child { page-break-after: avoid; }
h2 { color: #1a3a5c; font-size: 22px; border-bottom: 2px solid #5a9fd4; padding-bottom: 8px; margin-top: 35px; }
h3 { color: #2a5a8c; font-size: 16px; margin-top: 25px; }
.highlight-box { background: #f0f6fc; border-left: 4px solid #5a9fd4; padding: 15px 20px; margin: 15px 0; border-radius: 0 8px 8px 0; }
.highlight-box strong { color: #1a3a5c; }
.benefit-card { background: #fafcfe; border: 1px solid #d0e2f0; border-radius: 8px; padding: 15px 20px; margin: 10px 0; }
.benefit-card h4 { color: #1a3a5c; margin: 0 0 5px 0; font-size: 15px; }
.benefit-card p { margin: 0; font-size: 13px; color: #444; }
table { width: 100%; border-collapse: collapse; margin: 15px 0; }
th { background: #1a3a5c; color: white; padding: 10px 15px; text-align: left; font-size: 13px; }
td { padding: 10px 15px; border-bottom: 1px solid #e0e8f0; font-size: 13px; }
tr:nth-child(even) { background: #f5f9fc; }
.price-table td:last-child, .price-table th:last-child { text-align: right; }
.total-row { background: #1a3a5c !important; color: white; font-weight: bold; }
.total-row td { color: white; border: none; }
.phase { display: flex; margin: 15px 0; }
.phase-num { background: #1a3a5c; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; margin-right: 15px; margin-top: 3px; }
.phase-content h4 { margin: 0 0 5px 0; color: #1a3a5c; }
.phase-content p { margin: 0; font-size: 13px; color: #444; }
.roi-box { background: linear-gradient(135deg, #f0f6fc 0%, #e0edf8 100%); border: 2px solid #5a9fd4; border-radius: 10px; padding: 20px 25px; margin: 20px 0; text-align: center; }
.roi-box .big-number { font-size: 30px; font-weight: bold; color: #1a3a5c; }
.roi-box .label { font-size: 13px; color: #666; margin-top: 8px; }
.footer { text-align: center; color: #888; font-size: 11px; margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; }
ul { padding-left: 20px; } li { margin-bottom: 6px; font-size: 13px; }
.contact-box { background: #1a3a5c; color: white; border-radius: 10px; padding: 25px 30px; margin: 20px 0; }
.contact-box h3 { color: #7eb8e0; margin-top: 0; }
.contact-box p { margin: 5px 0; font-size: 14px; }
</style></head><body>

<div class="cover">
  <div class="logo-text">DT Growth Partners</div>
  <div class="divider"></div>
  <h1>${esc(d.titulo || 'Propuesta Comercial')}</h1>
  ${d.subtitulo ? `<h2>${esc(d.subtitulo)}</h2>` : ''}
  <div class="divider"></div>
  <div class="for">Preparado para</div>
  <div class="client">${esc(d.cliente)}</div>
  <div class="date">${esc(d.fecha || '')}</div>
</div>

<div class="page">
  ${d.resumenEjecutivo ? `<h2>1. Resumen Ejecutivo</h2><p>${esc(d.resumenEjecutivo)}</p>` : ''}
  ${
    d.diagnostico && (d.diagnostico.intro || diagPuntos)
      ? `<h2>2. Diagnóstico</h2>${d.diagnostico.intro ? `<p>${esc(d.diagnostico.intro)}</p>` : ''}${
          diagPuntos ? `<ul>${diagPuntos}</ul>` : ''
        }`
      : ''
  }
  ${d.oportunidad ? `<div class="highlight-box"><strong>Oportunidad:</strong> ${esc(d.oportunidad)}</div>` : ''}
  ${d.solucion ? `<h2>3. Solución Propuesta</h2><p>${esc(d.solucion)}</p>` : ''}
</div>

${
  capacidades || fases
    ? `<div class="page">
  ${capacidades ? `<h2>4. Capacidades / Alcance</h2>${capacidades}` : ''}
  ${fases ? `<h2>5. Plan de Implementación</h2>${fases}` : ''}
</div>`
    : ''
}

${
  impl || mensual || roiBlock
    ? `<div class="page">
  <h2>6. Inversión</h2>
  ${impl ? `<h3>Implementación (único)</h3>${impl}` : ''}
  ${mensual ? `<h3>Fee Mensual (recurrente)</h3>${mensual}` : ''}
  ${oferta}
  ${roiBlock}
</div>`
    : ''
}

<div class="page">
  ${porQue ? `<h2>7. ¿Por qué DT Growth Partners?</h2><ul>${porQue}</ul>` : ''}
  <div class="contact-box">
    <h3>Siguiente Paso</h3>
    <p>Agendemos una reunión para resolver dudas y definir los detalles.</p>
    <p style="margin-top:14px"><strong>Dairo Traslaviña Orozco</strong></p>
    <p>CEO — DT Growth Partners</p>
    <p>📞 +57 300 718 9383 &nbsp; ✉️ dairo@dtgrowthpartners.com</p>
    <p>🌐 dtgrowthpartners.com</p>
  </div>
  ${d.notaPrecios ? `<p style="font-size:11px;color:#888">* ${esc(d.notaPrecios)}</p>` : ''}
  <div class="footer">
    <p>DT Growth Partners © 2026 — Cartagena de Indias, Colombia</p>
    <p>Documento confidencial, destinado exclusivamente para ${esc(d.cliente)}.</p>
  </div>
</div>

</body></html>`;
}
