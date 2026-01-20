import { Request, Response } from 'express';
import calendarService from '../services/calendar.service';

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
    await calendarService.delete(id);
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

export default {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getUpcomingEvents
};
