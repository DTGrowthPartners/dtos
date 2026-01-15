import { Request, Response } from 'express';
import { googleCalendarService, CreateEventDto } from '../services/googleCalendar.service';

// Get all events (with optional filters)
export const getEvents = async (req: Request, res: Response) => {
  try {
    const { timeMin, timeMax, maxResults, query } = req.query;

    const events = await googleCalendarService.getEvents({
      timeMin: timeMin as string,
      timeMax: timeMax as string,
      maxResults: maxResults ? parseInt(maxResults as string) : undefined,
      query: query as string,
    });

    res.json(events);
  } catch (error: any) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get a single event by ID
export const getEvent = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await googleCalendarService.getEvent(eventId);

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json(event);
  } catch (error: any) {
    console.error('Error getting event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new event
export const createEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const data: CreateEventDto = {
      ...req.body,
      createdBy: userId,
    };

    // Validate required fields
    if (!data.title || !data.startDateTime || !data.endDateTime) {
      return res.status(400).json({
        error: 'Campos requeridos: title, startDateTime, endDateTime',
      });
    }

    const event = await googleCalendarService.createEvent(data);
    res.status(201).json(event);
  } catch (error: any) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update an existing event
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const data: Partial<CreateEventDto> = req.body;

    const event = await googleCalendarService.updateEvent(eventId, data);
    res.json(event);
  } catch (error: any) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete an event
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    await googleCalendarService.deleteEvent(eventId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get events for a specific client
export const getEventsByClient = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const events = await googleCalendarService.getEventsByClient(clientId);
    res.json(events);
  } catch (error: any) {
    console.error('Error getting events by client:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get events for a specific deal
export const getEventsByDeal = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const events = await googleCalendarService.getEventsByDeal(dealId);
    res.json(events);
  } catch (error: any) {
    console.error('Error getting events by deal:', error);
    res.status(500).json({ error: error.message });
  }
};

// Schedule a meeting with a deal contact
export const scheduleMeeting = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { title, description, startDateTime, endDateTime, attendees, createMeetLink, location } = req.body;

    if (!title || !startDateTime || !endDateTime) {
      return res.status(400).json({
        error: 'Campos requeridos: title, startDateTime, endDateTime',
      });
    }

    const event = await googleCalendarService.createEvent({
      title,
      description,
      startDateTime,
      endDateTime,
      attendees,
      location,
      createMeetLink: createMeetLink !== false, // Default to true
      dealId,
      createdBy: userId,
    });

    res.status(201).json(event);
  } catch (error: any) {
    console.error('Error scheduling meeting:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsByClient,
  getEventsByDeal,
  scheduleMeeting,
};
