import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { metaDiarioService } from '../services/metaDiario.service';

/**
 * Reporte DIARIO de Meta Ads — lo consume la sub-pestaña homónima de DTOS.
 * Proxy con JWT sobre el API interno de /home/ubuntu/meta-daily-report
 * (pm2 `meta-diario-api`, 127.0.0.1:3079).
 *
 * GET  /api/meta-diario/fechas                        selector de fechas
 * GET  /api/meta-diario/metricas                      catálogo de métricas
 * GET  /api/meta-diario/portafolio[?fecha=]           todas las cuentas del día
 * GET  /api/meta-diario/clientes[?fecha=]             idem (alias)
 * GET  /api/meta-diario/clientes/:aid[?fecha=]        panel de la sub-pestaña
 * PUT  /api/meta-diario/clientes/:aid                 nombre/métrica/correo/excluir
 * GET  /api/meta-diario/clientes/:aid/pdf[?descargar=1]
 * POST /api/meta-diario/clientes/:aid/generar         regenera su hoja (202)
 * GET  /api/meta-diario/maestro/pdf[?descargar=1]     consolidado + hojas
 * POST /api/meta-diario/generar                       regenera el día (202)
 * GET  /api/meta-diario/config                        destinatarios (lectura)
 * GET  /api/meta-diario/jobs[/:id]                    estado y log del job
 * GET  /api/meta-diario/cron                          estado de los dos crons
 */
const router = Router();
router.use(authMiddleware);

const fechaDe = (req: any): string | undefined =>
  typeof req.query.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha) ? req.query.fecha : undefined;

// El API de Python distingue 4xx (dato malo, 409 job en curso) de 5xx. Se
// respeta el código para que la pestaña muestre el mensaje correcto —"la cuenta
// está excluida", "el correo no tiene formato válido"— y no un 502 genérico.
const fallar = (res: any, e: any, msg: string) => {
  const status = e?.response?.status;
  const cuerpo = e?.response?.data;
  if (status && status < 500 && cuerpo) return res.status(status).json(cuerpo);
  res.status(502).json({ ok: false, error: e?.message || msg });
};

// Sirve un PDF que viene del motor como binario.
const servirPdf = async (res: any, cargar: () => Promise<any>, msg: string) => {
  try {
    const archivo = await cargar();
    if (archivo.status >= 400) {
      return res.status(archivo.status).json(JSON.parse(archivo.buffer.toString() || '{}'));
    }
    res.setHeader('Content-Type', archivo.contentType);
    if (archivo.contentDisposition) res.setHeader('Content-Disposition', archivo.contentDisposition);
    res.send(archivo.buffer);
  } catch (e: any) {
    fallar(res, e, msg);
  }
};

router.get('/fechas', async (_req, res) => {
  try {
    res.json(await metaDiarioService.fechas());
  } catch (e: any) {
    fallar(res, e, 'reporte diario no disponible');
  }
});

router.get('/metricas', async (_req, res) => {
  try {
    res.json(await metaDiarioService.metricas());
  } catch (e: any) {
    fallar(res, e, 'catálogo de métricas no disponible');
  }
});

router.get('/portafolio', async (req, res) => {
  try {
    res.json(await metaDiarioService.portafolio(fechaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'portafolio diario no disponible');
  }
});

router.get('/config', async (_req, res) => {
  try {
    res.json(await metaDiarioService.config());
  } catch (e: any) {
    fallar(res, e, 'configuración no disponible');
  }
});

router.post('/generar', async (req, res) => {
  try {
    const r = await metaDiarioService.generarDia(req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar la generación');
  }
});

router.get('/maestro/pdf', async (req, res) =>
  servirPdf(res, () => metaDiarioService.pdf('maestro', null, fechaDe(req), req.query.descargar === '1'),
    'PDF maestro no disponible'));

router.get('/jobs/:id', async (req, res) => {
  try {
    res.json(await metaDiarioService.job(req.params.id, req.query.log === '1'));
  } catch (e: any) {
    fallar(res, e, 'job no disponible');
  }
});

router.get('/jobs', async (req, res) => {
  try {
    res.json(await metaDiarioService.jobs(Number(req.query.limite) || undefined));
  } catch (e: any) {
    fallar(res, e, 'jobs no disponibles');
  }
});

router.get('/cron', async (_req, res) => {
  try {
    res.json(await metaDiarioService.cron());
  } catch (e: any) {
    fallar(res, e, 'estado del cron no disponible');
  }
});

// El PDF va ANTES del genérico /:aid para que Express no se coma "pdf" como
// parte del ad_account_id.
router.get('/clientes/:aid/pdf', async (req, res) =>
  servirPdf(res, () => metaDiarioService.pdf('cliente', req.params.aid, fechaDe(req), req.query.descargar === '1'),
    'PDF no disponible'));

router.post('/clientes/:aid/generar', async (req, res) => {
  try {
    const r = await metaDiarioService.generar(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo lanzar la generación');
  }
});

router.put('/clientes/:aid', async (req, res) => {
  try {
    const r = await metaDiarioService.actualizarCliente(req.params.aid, req.body || {});
    res.status(r.status).json(r.data);
  } catch (e: any) {
    fallar(res, e, 'no se pudo guardar la configuración');
  }
});

router.get('/clientes/:aid', async (req, res) => {
  try {
    res.json(await metaDiarioService.panel(req.params.aid, fechaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'panel diario no disponible');
  }
});

router.get('/clientes', async (req, res) => {
  try {
    res.json(await metaDiarioService.portafolio(fechaDe(req)));
  } catch (e: any) {
    fallar(res, e, 'clientes no disponibles');
  }
});

export default router;
