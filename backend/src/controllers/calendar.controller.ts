import { Request, Response } from 'express';
import calendarService from '../services/calendar.service';
import googleCalendar from '../services/googleCalendar.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all events
export const getEvents = async (req: Request, res: Response) => {
  try {
    const { start, end, clientId, dealId, terceroId } = req.query;

    const events = await calendarService.getAll({
      start: start ? new Date(start as string) : undefined,
      end: end ? new Date(end as string) : undefined,
      clientId: clientId as string,
      dealId: dealId as string,
      terceroId: terceroId as string
    });

    res.json(events);
  } catch (error: any) {
    console.error('Error getting calendar events:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single event
export const getEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const event = await calendarService.getById(id);

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json(event);
  } catch (error: any) {
    console.error('Error getting calendar event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create event
export const createEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { title, description, start, end, allDay, type, location, color, clientId, dealId, terceroId, attendees, reminder } = req.body;

    if (!title || !start || !end) {
      return res.status(400).json({ error: 'Título, fecha inicio y fecha fin son requeridos' });
    }

    const event = await calendarService.create({
      title,
      description,
      start: new Date(start),
      end: new Date(end),
      allDay,
      type,
      location,
      color,
      clientId: clientId || undefined,
      dealId: dealId || undefined,
      terceroId: terceroId || undefined,
      attendees,
      reminder,
      createdBy: userId
    });

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update event
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, start, end, allDay, type, location, color, clientId, dealId, terceroId, attendees, reminder, status } = req.body;

    const event = await calendarService.update(id, {
      title,
      description,
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      allDay,
      type,
      location,
      color,
      clientId,
      dealId,
      terceroId,
      attendees,
      reminder,
      status
    });

    // Reflejar el cambio en Google si la cita tiene copia alla
    const g = (event as any).googleEventId;
    if (g) {
      if (status === 'cancelled') {
        await googleCalendar.eliminarEvento(g);
      } else {
        await googleCalendar.actualizarEvento(g, {
          titulo: title,
          descripcion: description,
          ubicacion: location,
          inicio: start ? new Date(start) : undefined,
          fin: end ? new Date(end) : undefined,
        });
      }
    }

    res.json(event);
  } catch (error: any) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete event
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Leer el enlace antes de borrar: despues ya no se sabe cual evento quitar
    const previo = await prisma.calendarEvent.findUnique({ where: { id }, select: { googleEventId: true } });
    await calendarService.delete(id);
    if (previo?.googleEventId) await googleCalendar.eliminarEvento(previo.googleEventId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get upcoming events
export const getUpcomingEvents = async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const events = await calendarService.getUpcoming(limit ? parseInt(limit as string) : 5);
    res.json(events);
  } catch (error: any) {
    console.error('Error getting upcoming events:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/calendar/deal/:dealId/meeting
 * Agenda la cita de un prospecto: la guarda en DT-OS y la copia a Google Calendar.
 * Si Google no esta configurado o falla, la cita igual queda agendada aqui —
 * agendar nunca puede depender de que un servicio de afuera responda.
 */
export const createDealMeeting = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { title, description, startDateTime, endDateTime, attendees, location, createMeetLink } = req.body;

    if (!title || !startDateTime || !endDateTime) {
      return res.status(400).json({ error: 'Faltan el titulo, la hora de inicio o la de fin' });
    }
    const inicio = new Date(startDateTime);
    const fin = new Date(endDateTime);
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      return res.status(400).json({ error: 'Las fechas no son validas' });
    }
    if (fin <= inicio) {
      return res.status(400).json({ error: 'La cita no puede terminar antes de empezar' });
    }

    const deal = await prisma.deal.findFirst({
      where: { id: dealId, deletedAt: null },
      select: { id: true, name: true, company: true, email: true, phone: true, terceroId: true },
    });
    if (!deal) return res.status(404).json({ error: 'Prospecto no encontrado' });

    const invitados: string[] = Array.isArray(attendees) ? attendees.filter(Boolean) : [];
    // El contacto del prospecto entra como invitado aunque no lo escriban a mano
    if (deal.email && !invitados.includes(deal.email)) invitados.push(deal.email);

    const contexto = [
      `Prospecto: ${deal.name}${deal.company ? ` (${deal.company})` : ''}`,
      deal.phone ? `Telefono: ${deal.phone}` : '',
      description || '',
    ].filter(Boolean).join('\n');

    const enGoogle = await googleCalendar.crearEvento({
      titulo: title,
      descripcion: contexto,
      inicio,
      fin,
      ubicacion: location,
      invitados,
      crearMeet: createMeetLink === true,
    });

    const event = await calendarService.create({
      title,
      description: contexto,
      start: inicio,
      end: fin,
      type: 'meeting',
      location,
      dealId: deal.id,
      terceroId: deal.terceroId || undefined,
      attendees: invitados.join(', ') || undefined,
      createdBy: userId,
    });

    // El enlace de Google se guarda aparte: la cita ya existe pase lo que pase
    const completo = enGoogle
      ? await prisma.calendarEvent.update({
          where: { id: event.id },
          data: {
            googleEventId: enGoogle.googleEventId,
            googleHtmlLink: enGoogle.htmlLink,
            meetLink: enGoogle.meetLink,
          },
        })
      : event;

    res.status(201).json({
      ...completo,
      sincronizadoConGoogle: Boolean(enGoogle),
      meetLink: enGoogle?.meetLink || null,
    });
  } catch (error: any) {
    console.error('Error agendando la cita del prospecto:', error);
    res.status(500).json({ error: error.message });
  }
};

/** GET /api/calendar/google/estado — para saber que falta por configurar */
export const googleEstado = async (_req: Request, res: Response) => {
  res.json(await googleCalendar.estado());
};

export default {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingEvents,
  createDealMeeting,
  googleEstado
};
