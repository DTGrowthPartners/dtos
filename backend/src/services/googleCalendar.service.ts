import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

/**
 * Google Calendar para las citas de ventas.
 *
 * Usa la MISMA cuenta de servicio que ya lee las hojas de finanzas
 * (credencials.json). Eso evita la pantalla de consentimiento de OAuth y su
 * verificacion: a una cuenta de servicio no le aplica el "modo produccion".
 * Solo hacen falta dos cosas, ambas fuera del codigo:
 *
 *   1. Habilitar la Google Calendar API en el proyecto de Google.
 *   2. Compartir el calendario con el correo de la cuenta de servicio dandole
 *      "Hacer cambios en los eventos", y poner su ID en GOOGLE_CALENDAR_ID.
 *
 * Mientras eso no este listo, todo sigue funcionando: la cita se guarda en
 * DT-OS y simplemente no se copia a Google. Nunca tumba el agendamiento.
 */

const CREDENTIALS_PATH = path.join(__dirname, '../../..', 'credencials.json');
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '';
const TZ = process.env.GOOGLE_CALENDAR_TZ || 'America/Bogota';

const log = (msg: string) => console.log(`[google-calendar] ${msg}`);

export interface EventoGoogle {
  googleEventId: string;
  htmlLink: string | null;
  meetLink: string | null;
}

export interface DatosEvento {
  titulo: string;
  descripcion?: string;
  inicio: Date;
  fin: Date;
  ubicacion?: string;
  /** Correos de los invitados. Ver la nota sobre invitaciones mas abajo. */
  invitados?: string[];
  crearMeet?: boolean;
}

let clienteCache: any = null;

const cliente = () => {
  if (clienteCache) return clienteCache;
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  clienteCache = google.calendar({ version: 'v3', auth: auth as any });
  return clienteCache;
};

/** Si falta configuracion no se intenta nada: se guarda solo en DT-OS. */
export const estaConfigurado = (): boolean =>
  Boolean(CALENDAR_ID) && fs.existsSync(CREDENTIALS_PATH);

export const estado = async () => {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return { ok: false, motivo: 'No esta el archivo de credenciales de Google en el servidor' };
  }
  if (!CALENDAR_ID) {
    return { ok: false, motivo: 'Falta GOOGLE_CALENDAR_ID en el .env del backend' };
  }
  try {
    const r = await cliente().calendars.get({ calendarId: CALENDAR_ID });
    return { ok: true, calendario: r.data.summary, id: CALENDAR_ID, zona: TZ };
  } catch (e: any) {
    const msg = e?.errors?.[0]?.message || e?.message || String(e);
    if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) {
      return { ok: false, motivo: 'Falta habilitar la Google Calendar API en el proyecto de Google' };
    }
    if (/notFound|404/i.test(msg)) {
      return { ok: false, motivo: `El calendario ${CALENDAR_ID} no existe o no esta compartido con la cuenta de servicio` };
    }
    return { ok: false, motivo: msg };
  }
};

/**
 * Crea el evento en Google. Devuelve null (sin lanzar) si no esta configurado o
 * si Google falla: la cita ya quedo guardada en DT-OS y no se pierde nada.
 */
export const crearEvento = async (d: DatosEvento): Promise<EventoGoogle | null> => {
  if (!estaConfigurado()) return null;
  try {
    // Una cuenta de servicio no puede ENVIAR invitaciones sin delegacion a nivel
    // de dominio (Google lo rechaza con "cannot invite attendees"). Se intenta con
    // invitados y, si Google los rechaza, se reintenta sin ellos dejandolos escritos
    // en la descripcion: mejor un evento sin invitacion que ningun evento.
    const base: any = {
      summary: d.titulo,
      description: d.descripcion || undefined,
      location: d.ubicacion || undefined,
      start: { dateTime: d.inicio.toISOString(), timeZone: TZ },
      end: { dateTime: d.fin.toISOString(), timeZone: TZ },
    };
    if (d.crearMeet) {
      base.conferenceData = {
        createRequest: {
          requestId: `dtos-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const invitados = (d.invitados || []).filter((c) => c && c.includes('@'));
    const enviar = async (conInvitados: boolean) =>
      cliente().events.insert({
        calendarId: CALENDAR_ID,
        conferenceDataVersion: d.crearMeet ? 1 : 0,
        requestBody: conInvitados && invitados.length
          ? { ...base, attendees: invitados.map((email) => ({ email })) }
          : {
              ...base,
              description: invitados.length
                ? `${base.description ? base.description + '\n\n' : ''}Participantes: ${invitados.join(', ')}`
                : base.description,
            },
      });

    let r;
    try {
      r = await enviar(invitados.length > 0);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e?.message || '';
      if (invitados.length && /invite attendees|Domain-Wide Delegation|forbiddenForServiceAccounts/i.test(msg)) {
        log('Google no deja invitar desde una cuenta de servicio; el evento se crea con los correos en la descripcion');
        r = await enviar(false);
      } else {
        throw e;
      }
    }

    const ev = r.data;
    const meet =
      ev.hangoutLink ||
      ev.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === 'video')?.uri ||
      null;
    log(`evento creado: ${ev.id} (${d.titulo})`);
    return { googleEventId: ev.id!, htmlLink: ev.htmlLink || null, meetLink: meet };
  } catch (e: any) {
    log(`no se pudo crear el evento: ${e?.errors?.[0]?.message || e?.message}`);
    return null;
  }
};

export const actualizarEvento = async (googleEventId: string, d: Partial<DatosEvento>): Promise<boolean> => {
  if (!estaConfigurado() || !googleEventId) return false;
  try {
    const cuerpo: any = {};
    if (d.titulo) cuerpo.summary = d.titulo;
    if (d.descripcion !== undefined) cuerpo.description = d.descripcion;
    if (d.ubicacion !== undefined) cuerpo.location = d.ubicacion;
    if (d.inicio) cuerpo.start = { dateTime: d.inicio.toISOString(), timeZone: TZ };
    if (d.fin) cuerpo.end = { dateTime: d.fin.toISOString(), timeZone: TZ };
    await cliente().events.patch({ calendarId: CALENDAR_ID, eventId: googleEventId, requestBody: cuerpo });
    log(`evento actualizado: ${googleEventId}`);
    return true;
  } catch (e: any) {
    log(`no se pudo actualizar ${googleEventId}: ${e?.errors?.[0]?.message || e?.message}`);
    return false;
  }
};

export const eliminarEvento = async (googleEventId: string): Promise<boolean> => {
  if (!estaConfigurado() || !googleEventId) return false;
  try {
    await cliente().events.delete({ calendarId: CALENDAR_ID, eventId: googleEventId });
    log(`evento eliminado: ${googleEventId}`);
    return true;
  } catch (e: any) {
    // Si ya no existe en Google, para DT-OS es lo mismo que si lo hubieramos borrado
    const msg = e?.errors?.[0]?.message || e?.message || '';
    if (/notFound|deleted|410/i.test(msg)) return true;
    log(`no se pudo eliminar ${googleEventId}: ${msg}`);
    return false;
  }
};

export default { estaConfigurado, estado, crearEvento, actualizarEvento, eliminarEvento };
