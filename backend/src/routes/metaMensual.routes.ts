import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { metaMensualService } from '../services/metaMensual.service';

/**
 * Reporte MENSUAL de Meta Ads — lo consume la sub-pestaña homónima de DTOS.
 * Proxy con JWT sobre el API interno de /home/ubuntu/meta-monthly-report
 * (pm2 `meta-mensual-api`, 127.0.0.1:3078).
 *
 * GET  /api/meta-mensual/meses                          selector de meses
 * GET  /api/meta-mensual/portafolio[?mes=]              todos los clientes del mes
 * GET  /api/meta-mensual/clientes[?mes=]                idem (alias)
 * GET  /api/meta-mensual/clientes/:aid[?mes=]           panel de la sub-pestaña
 * PUT  /api/meta-mensual/clientes/:aid                  activo / motivo / nota
 * PUT  /api/meta-mensual/clientes/:aid/whatsapp         grupo destino
 * PUT  /api/meta-mensual/clientes/:aid/ig-follows       seguidores IG de un mes
 * POST /api/meta-mensual/clientes/:aid/generar          extracción + PDF (202)
 * POST /api/meta-mensual/clientes/:aid/enviar           al grupo (202 + job)
 * POST /api/meta-mensual/clientes/:aid/enviar-correo    por correo (202 + job)
 * GET  /api/meta-mensual/clientes/:aid/pdf[?descargar=1]
 * GET  /api/meta-mensual/clientes/:aid/historial
 * GET  /api/meta-mensual/grupos-whatsapp[?buscar=]      grupos del bot de Dairo
 * GET|PUT /api/meta-mensual/config                      resumen al celular
 * POST /api/meta-mensual/generar                        masivo (202 + job)
 * POST /api/meta-mensual/enviar                         masivo (202 + job)
 * GET  /api/meta-mensual/jobs[/:id]                     estado y log del job
 * GET  /api/meta-mensual/cron                           estado del cron del día 1
 */
const router = Router();
router.use(authMiddleware);

const mesDe = (req: any): string | undefined =>
  typeof req.query.mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes) ? req.query.mes : undefined;

// El API de Python distingue 4xx (dato malo, 409 job en curso) de 5xx. Se
// respeta el código para que la pestaña muestre el mensaje correcto —"el
// cliente está pausado", "el reporte está bloqueado"— en vez de un 502 genérico.
const fallar = (res: any, e: any, msg: string) => {
  const status = e?.response?.status;
  const cuerpo = e?.response?.data;
  if (status && status < 500 && cuerpo) return res.status(status).json(cuerpo);
  res.status(502).json({ ok: false, error: e?.message || msg });
};

router.get('/meses', async (_req, res) => {
  try {
    res.json(await metaMensualService.meses());
  } catch (e: any) {
    fallar(res, e, 'reporte mensual no disponible');
  }
});

router.get('/portafolio', async (req, res) => {
  try {
    res.json(await metaMensualService.portafolio(mesDe(req)));
  } catch (e: any) {
    fallar(res, e, 'portafolio mensual no disponible');
  }
});

router.get('/grupos-whatsapp', async (req, res) => {
  try {
    const limite = Number(req.query.limite) || undefined;
    res.json(await metaMensualService.gruposWhatsapp(req.query.buscar as string | undefined, limite));
  } catch (e: any) {
    fallar(res, e, 'no se pudieron listar los grupos');
  }
});

router.get('/config', async (_req, res) => {
  try {
    res.json(await metaMensualService.config());
  } catch (e: any) {
    fallar(res, e, 'configuración no disponible');
  }
});

router.put('/config', async (req, res) => {
  try {
    const r = await metaMensualService.actualizarConfig(req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar la configuración');
  }
});

router.post('/generar', async (req, res) => {
  try {
    const r = await metaMensualService.generarTodos(req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar la generación');
  }
});

router.post('/enviar', async (req, res) => {
  try {
    const r = await metaMensualService.enviarTodos(req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar el envío');
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    res.json(await metaMensualService.job(req.params.id, req.query.log === '1'));
  } catch (e: any) {
    fallar(res, e, 'job no disponible');
  }
});

router.get('/jobs', async (req, res) => {
  try {
    res.json(await metaMensualService.jobs(Number(req.query.limite) || undefined));
  } catch (e: any) {
    fallar(res, e, 'jobs no disponibles');
  }
});

router.get('/cron', async (_req, res) => {
  try {
    res.json(await metaMensualService.cron());
  } catch (e: any) {
    fallar(res, e, 'estado del cron no disponible');
  }
});

// El PDF va ANTES del genérico /:aid para que Express no se coma "pdf" como
// parte del ad_account_id.
router.get('/clientes/:aid/pdf', async (req, res) => {
  try {
    const archivo = await metaMensualService.pdf(req.params.aid, mesDe(req), req.query.descargar === '1');
    if (archivo.status >= 400) {
      return res.status(archivo.status).json(JSON.parse(archivo.buffer.toString() || '{}'));
    }
    res.setHeader('Content-Type', archivo.contentType);
    if (archivo.contentDisposition) res.setHeader('Content-Disposition', archivo.contentDisposition);
    res.send(archivo.buffer);
  } catch (e: any) {
    fallar(res, e, 'PDF no disponible');
  }
});

router.get('/clientes/:aid/historial', async (req, res) => {
  try {
    res.json(await metaMensualService.historial(req.params.aid, Number(req.query.limite) || undefined));
  } catch (e: any) {
    fallar(res, e, 'historial no disponible');
  }
});

router.put('/clientes/:aid/whatsapp', async (req, res) => {
  try {
    const r = await metaMensualService.guardarWhatsapp(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar el grupo');
  }
});

router.put('/clientes/:aid/ig-follows', async (req, res) => {
  try {
    const r = await metaMensualService.guardarIgFollows(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudieron guardar los seguidores');
  }
});

router.post('/clientes/:aid/generar', async (req, res) => {
  try {
    const r = await metaMensualService.generar(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar la generación');
  }
});

router.post('/clientes/:aid/enviar', async (req, res) => {
  try {
    const r = await metaMensualService.enviar(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar el envío');
  }
});

router.post('/clientes/:aid/enviar-correo', async (req, res) => {
  try {
    const r = await metaMensualService.enviarCorreo(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar el envío por correo');
  }
});

router.put('/clientes/:aid', async (req, res) => {
  try {
    const r = await metaMensualService.actualizarCliente(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar el cliente');
  }
});

router.get('/clientes/:aid', async (req, res) => {
  try {
    res.json(await metaMensualService.panel(req.params.aid, mesDe(req)));
  } catch (e: any) {
    fallar(res, e, 'panel mensual no disponible');
  }
});

router.get('/clientes', async (req, res) => {
  try {
    res.json(await metaMensualService.portafolio(mesDe(req)));
  } catch (e: any) {
    fallar(res, e, 'clientes no disponibles');
  }
});

export default router;
