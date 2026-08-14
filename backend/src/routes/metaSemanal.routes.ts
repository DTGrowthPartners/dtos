import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { metaSemanalService } from '../services/metaSemanal.service';

/**
 * Reporte SEMANAL de Meta Ads — lo consume la pestaña homónima de DTOS.
 * Proxy con JWT sobre el API interno de /home/ubuntu/meta-weekly-report
 * (pm2 `meta-semanal-api`, 127.0.0.1:3077).
 *
 * GET  /api/meta-semanal/semanas                   selector de semanas
 * GET  /api/meta-semanal/portafolio[?semana=]      dashboard
 * GET  /api/meta-semanal/reportes[?semana=]        estado por cliente
 * GET  /api/meta-semanal/reportes/:slug[?semana=]  detalle + datos del PDF
 * GET  /api/meta-semanal/reportes/:slug/pdf        PDF (inline o ?descargar=1)
 * GET  /api/meta-semanal/reportes/:slug/html       HTML para previsualizar
 * GET  /api/meta-semanal/clientes[?semana=]        portafolio + destinatarios
 * PUT  /api/meta-semanal/clientes/:adAccountId     a dónde se envía / activo
 * GET  /api/meta-semanal/config                    modo de envío
 * PUT  /api/meta-semanal/config                    cambiar modo / buzón / bcc
 * POST /api/meta-semanal/generar                   genera (202 + job)
 * POST /api/meta-semanal/enviar                    envía lo generado (202 + job)
 * GET  /api/meta-semanal/jobs[/:id]                estado y log del job
 * GET  /api/meta-semanal/envios[?semana=]          historial de correos
 * GET  /api/meta-semanal/grupos-whatsapp[?buscar=] grupos del bot de Dairo
 * PUT  /api/meta-semanal/clientes/:aid/whatsapp    grupo destino del reporte
 * POST /api/meta-semanal/clientes/:aid/whatsapp-prueba  envía el PDF al grupo ya
 * GET  /api/meta-semanal/cron                      estado del cron de los lunes
 */
const router = Router();
router.use(authMiddleware);

const semanaDe = (req: any): string | undefined =>
  typeof req.query.semana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.semana) ? req.query.semana : undefined;

// El API de Python distingue 4xx (dato malo, 409 job en curso) de 5xx. Se
// respeta el código para que la pestaña muestre el mensaje correcto en vez de
// un 502 genérico.
const fallar = (res: any, e: any, msg: string) => {
  const status = e?.response?.status;
  const cuerpo = e?.response?.data;
  if (status && status < 500 && cuerpo) return res.status(status).json(cuerpo);
  res.status(502).json({ ok: false, error: e?.message || msg });
};

router.get('/semanas', async (_req, res) => {
  try {
    res.json(await metaSemanalService.semanas());
  } catch (e: any) {
    fallar(res, e, 'reporte semanal no disponible');
  }
});

router.get('/portafolio', async (req, res) => {
  try {
    res.json(await metaSemanalService.portafolio(semanaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'portafolio semanal no disponible');
  }
});

router.get('/reportes', async (req, res) => {
  try {
    res.json(await metaSemanalService.reportes(semanaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'reportes no disponibles');
  }
});

// Los dos de archivo van ANTES del genérico /:slug para que Express no se coma
// "pdf"/"html" como parte del slug.
router.get('/reportes/:slug/:formato(pdf|html)', async (req, res) => {
  try {
    const formato = req.params.formato as 'pdf' | 'html';
    const archivo = await metaSemanalService.archivo(req.params.slug, formato, semanaDe(req), req.query.descargar === '1');
    if (archivo.status >= 400) {
      return res.status(archivo.status).json(JSON.parse(archivo.buffer.toString() || '{}'));
    }
    res.setHeader('Content-Type', archivo.contentType);
    if (archivo.contentDisposition) res.setHeader('Content-Disposition', archivo.contentDisposition);
    res.send(archivo.buffer);
  } catch (e: any) {
    fallar(res, e, 'archivo no disponible');
  }
});

router.get('/reportes/:slug', async (req, res) => {
  try {
    res.json(await metaSemanalService.reporte(req.params.slug, semanaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'reporte no disponible');
  }
});

router.get('/clientes', async (req, res) => {
  try {
    res.json(await metaSemanalService.clientes(semanaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'clientes no disponibles');
  }
});

// --- pestaña "Reportes" de un cliente (se entra con Client.metaAdAccountId) ---

router.get('/clientes/:adAccountId', async (req, res) => {
  try {
    res.json(await metaSemanalService.panel(req.params.adAccountId, semanaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'panel del cliente no disponible');
  }
});

router.put('/clientes/:adAccountId', async (req, res) => {
  try {
    res.json(await metaSemanalService.actualizarCliente(req.params.adAccountId, req.body || {}));
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar el destinatario');
  }
});

router.put('/clientes/:adAccountId/config', async (req, res) => {
  try {
    res.json(await metaSemanalService.guardarConfigCliente(req.params.adAccountId, req.body || {}));
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar la configuración');
  }
});

router.put('/clientes/:adAccountId/destinatarios', async (req, res) => {
  try {
    const cuerpo = Array.isArray(req.body) ? req.body : req.body?.destinatarios || [];
    res.json(await metaSemanalService.guardarDestinatarios(req.params.adAccountId, cuerpo));
  } catch (e: any) {
    fallar(res, e, 'no se pudieron guardar los destinatarios');
  }
});

router.get('/grupos-whatsapp', async (req, res) => {
  try {
    const buscar = typeof req.query.buscar === 'string' ? req.query.buscar : undefined;
    const limite = Number(req.query.limite) || undefined;
    res.json(await metaSemanalService.gruposWhatsapp(buscar, limite));
  } catch (e: any) {
    fallar(res, e, 'no se pudieron listar los grupos');
  }
});

router.put('/clientes/:adAccountId/whatsapp', async (req, res) => {
  try {
    res.json(await metaSemanalService.guardarWhatsapp(req.params.adAccountId, req.body || {}));
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar el grupo');
  }
});

router.post('/clientes/:adAccountId/whatsapp-prueba', async (req, res) => {
  try {
    res.json(await metaSemanalService.probarWhatsapp(req.params.adAccountId, semanaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'no se pudo enviar la prueba');
  }
});

router.put('/clientes/:adAccountId/metas', async (req, res) => {
  try {
    res.json(await metaSemanalService.guardarMetas(req.params.adAccountId, req.body || {}));
  } catch (e: any) {
    fallar(res, e, 'no se pudieron guardar las metas');
  }
});

router.post('/clientes/:adAccountId/borrador', async (req, res) => {
  try {
    const r = await metaSemanalService.generarBorrador(req.params.adAccountId, req.body || {});
    res.status(r.ok ? 202 : 409).json(r);
  } catch (e: any) {
    fallar(res, e, 'no se pudo generar el borrador');
  }
});

router.post('/clientes/:adAccountId/aprobar', async (req, res) => {
  try {
    // Queda registrado quién aprobó: si el front no lo manda, va el usuario del JWT.
    const por = req.body?.por || (req as any).user?.email;
    const r = await metaSemanalService.aprobar(req.params.adAccountId, { ...(req.body || {}), por, semana: semanaDe(req) });
    res.status(r.ok === false ? 400 : r.job ? 202 : 200).json(r);
  } catch (e: any) {
    fallar(res, e, 'no se pudo aprobar el reporte');
  }
});

router.post('/clientes/:adAccountId/rechazar', async (req, res) => {
  try {
    const por = req.body?.por || (req as any).user?.email;
    res.json(await metaSemanalService.rechazar(req.params.adAccountId, { ...(req.body || {}), por, semana: semanaDe(req) }));
  } catch (e: any) {
    fallar(res, e, 'no se pudo rechazar el reporte');
  }
});

router.get('/clientes/:adAccountId/historial', async (req, res) => {
  try {
    const limite = Number(req.query.limite) || undefined;
    res.json(await metaSemanalService.historialCliente(req.params.adAccountId, limite));
  } catch (e: any) {
    fallar(res, e, 'historial no disponible');
  }
});

router.get('/config', async (_req, res) => {
  try {
    res.json(await metaSemanalService.config());
  } catch (e: any) {
    fallar(res, e, 'config no disponible');
  }
});

router.put('/config', async (req, res) => {
  try {
    res.json(await metaSemanalService.actualizarConfig(req.body || {}));
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar la config');
  }
});

router.post('/generar', async (req, res) => {
  try {
    const r = await metaSemanalService.generar(req.body || {});
    res.status(r.ok ? 202 : 409).json(r);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar la generación');
  }
});

router.post('/enviar', async (req, res) => {
  try {
    const r = await metaSemanalService.enviar(req.body || {});
    res.status(r.ok ? 202 : 409).json(r);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar el envío');
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const limite = Number(req.query.limite) || undefined;
    res.json(await metaSemanalService.jobs(limite));
  } catch (e: any) {
    fallar(res, e, 'jobs no disponibles');
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    res.json(await metaSemanalService.job(req.params.id, req.query.log !== '0'));
  } catch (e: any) {
    fallar(res, e, 'job no disponible');
  }
});

router.get('/envios', async (req, res) => {
  try {
    const limite = Number(req.query.limite) || undefined;
    res.json(await metaSemanalService.historialEnvios(semanaDe(req), limite));
  } catch (e: any) {
    fallar(res, e, 'historial no disponible');
  }
});

router.get('/cron', async (_req, res) => {
  try {
    res.json(await metaSemanalService.cron());
  } catch (e: any) {
    fallar(res, e, 'cron no disponible');
  }
});

export default router;
