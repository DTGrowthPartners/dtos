import { google } from 'googleapis';
import path from 'path';

const CREDENTIALS_PATH = path.join(__dirname, '../../..', 'credencials.json');

// Calendar ID - uses the service account's primary calendar by default
// You can change this to a specific calendar ID if needed
const CALENDAR_ID = 'primary';

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startDateTime: string; // ISO 8601 format
  endDateTime: string;   // ISO 8601 format
  attendees?: string[];  // Email addresses
  location?: string;
  meetLink?: string;     // Google Meet link (auto-generated)
  clientId?: string;     // Reference to CRM client
  dealId?: string;       // Reference to CRM deal
  createdBy?: string;    // User who created the event
}

export interface CreateEventDto {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
  location?: string;
  createMeetLink?: boolean;
  clientId?: string;
  dealId?: string;
  createdBy?: string;
}

export class GoogleCalendarService {
  private calendar: any;
  private auth: any;

  constructor() {
    this.initAuth();
  }

  private async initAuth() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async createEvent(eventData: CreateEventDto): Promise<CalendarEvent> {
    try {
      const event: any = {
        summary: eventData.title,
        description: this.buildDescription(eventData),
        start: {
          dateTime: eventData.startDateTime,
          timeZone: 'America/Bogota',
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: 'America/Bogota',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 },      // 30 minutes before
          ],
        },
      };

      // Add location if provided
      if (eventData.location) {
        event.location = eventData.location;
      }

      // Add attendees if provided
      if (eventData.attendees && eventData.attendees.length > 0) {
        event.attendees = eventData.attendees.map(email => ({ email }));
      }

      // Add Google Meet link if requested
      if (eventData.createMeetLink) {
        event.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const response = await this.calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: event,
        conferenceDataVersion: eventData.createMeetLink ? 1 : 0,
        sendUpdates: eventData.attendees?.length ? 'all' : 'none',
      });

      console.log('Calendar event created:', response.data.id);

      return this.mapEventToCalendarEvent(response.data, eventData);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('No se pudo crear el evento en el calendario');
    }
  }

  async getEvents(options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
  }): Promise<CalendarEvent[]> {
    try {
      const params: any = {
        calendarId: CALENDAR_ID,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: options?.maxResults || 50,
      };

      if (options?.timeMin) {
        params.timeMin = options.timeMin;
      } else {
        // Default to today
        params.timeMin = new Date().toISOString();
      }

      if (options?.timeMax) {
        params.timeMax = options.timeMax;
      }

      if (options?.query) {
        params.q = options.query;
      }

      const response = await this.calendar.events.list(params);

      return (response.data.items || []).map((event: any) => this.mapEventToCalendarEvent(event));
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw new Error('No se pudieron obtener los eventos del calendario');
    }
  }

  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const response = await this.calendar.events.get({
        calendarId: CALENDAR_ID,
        eventId,
      });

      return this.mapEventToCalendarEvent(response.data);
    } catch (error) {
      console.error('Error fetching calendar event:', error);
      return null;
    }
  }

  async updateEvent(eventId: string, eventData: Partial<CreateEventDto>): Promise<CalendarEvent> {
    try {
      // First get the existing event
      const existingEvent = await this.calendar.events.get({
        calendarId: CALENDAR_ID,
        eventId,
      });

      const event: any = {
        summary: eventData.title || existingEvent.data.summary,
        description: eventData.description !== undefined
          ? this.buildDescription(eventData as CreateEventDto)
          : existingEvent.data.description,
      };

      if (eventData.startDateTime) {
        event.start = {
          dateTime: eventData.startDateTime,
          timeZone: 'America/Bogota',
        };
      }

      if (eventData.endDateTime) {
        event.end = {
          dateTime: eventData.endDateTime,
          timeZone: 'America/Bogota',
        };
      }

      if (eventData.location !== undefined) {
        event.location = eventData.location;
      }

      if (eventData.attendees) {
        event.attendees = eventData.attendees.map(email => ({ email }));
      }

      const response = await this.calendar.events.patch({
        calendarId: CALENDAR_ID,
        eventId,
        requestBody: event,
        sendUpdates: 'all',
      });

      console.log('Calendar event updated:', eventId);

      return this.mapEventToCalendarEvent(response.data, eventData as CreateEventDto);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('No se pudo actualizar el evento');
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: CALENDAR_ID,
        eventId,
        sendUpdates: 'all',
      });

      console.log('Calendar event deleted:', eventId);
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('No se pudo eliminar el evento');
    }
  }

  async getEventsByClient(clientId: string): Promise<CalendarEvent[]> {
    try {
      // Search for events with the client ID in the description
      const events = await this.getEvents({
        query: `clientId:${clientId}`,
        maxResults: 100,
      });

      return events.filter(event =>
        event.description?.includes(`clientId:${clientId}`) ||
        event.clientId === clientId
      );
    } catch (error) {
      console.error('Error fetching events by client:', error);
      return [];
    }
  }

  async getEventsByDeal(dealId: string): Promise<CalendarEvent[]> {
    try {
      const events = await this.getEvents({
        query: `dealId:${dealId}`,
        maxResults: 100,
      });

      return events.filter(event =>
        event.description?.includes(`dealId:${dealId}`) ||
        event.dealId === dealId
      );
    } catch (error) {
      console.error('Error fetching events by deal:', error);
      return [];
    }
  }

  private buildDescription(eventData: CreateEventDto): string {
    let description = eventData.description || '';

    // Add metadata as hidden tags at the end
    const metadata: string[] = [];
    if (eventData.clientId) {
      metadata.push(`clientId:${eventData.clientId}`);
    }
    if (eventData.dealId) {
      metadata.push(`dealId:${eventData.dealId}`);
    }
    if (eventData.createdBy) {
      metadata.push(`createdBy:${eventData.createdBy}`);
    }

    if (metadata.length > 0) {
      description += `\n\n---\n[${metadata.join(' | ')}]`;
    }

    return description;
  }

  private parseDescription(description: string): {
    cleanDescription: string;
    clientId?: string;
    dealId?: string;
    createdBy?: string;
  } {
    if (!description) return { cleanDescription: '' };

    // Extract metadata from description
    const metadataMatch = description.match(/\n\n---\n\[(.+)\]$/);
    let cleanDescription = description;
    let clientId: string | undefined;
    let dealId: string | undefined;
    let createdBy: string | undefined;

    if (metadataMatch) {
      cleanDescription = description.replace(/\n\n---\n\[.+\]$/, '');
      const metadata = metadataMatch[1];

      const clientMatch = metadata.match(/clientId:(\S+)/);
      if (clientMatch) clientId = clientMatch[1];

      const dealMatch = metadata.match(/dealId:(\S+)/);
      if (dealMatch) dealId = dealMatch[1];

      const createdByMatch = metadata.match(/createdBy:(\S+)/);
      if (createdByMatch) createdBy = createdByMatch[1];
    }

    return { cleanDescription, clientId, dealId, createdBy };
  }

  private mapEventToCalendarEvent(googleEvent: any, originalData?: CreateEventDto): CalendarEvent {
    const { cleanDescription, clientId, dealId, createdBy } = this.parseDescription(googleEvent.description || '');

    return {
      id: googleEvent.id,
      title: googleEvent.summary || '',
      description: cleanDescription,
      startDateTime: googleEvent.start?.dateTime || googleEvent.start?.date,
      endDateTime: googleEvent.end?.dateTime || googleEvent.end?.date,
      attendees: googleEvent.attendees?.map((a: any) => a.email) || [],
      location: googleEvent.location,
      meetLink: googleEvent.hangoutLink || googleEvent.conferenceData?.entryPoints?.[0]?.uri,
      clientId: originalData?.clientId || clientId,
      dealId: originalData?.dealId || dealId,
      createdBy: originalData?.createdBy || createdBy,
    };
  }
}

export const googleCalendarService = new GoogleCalendarService();
