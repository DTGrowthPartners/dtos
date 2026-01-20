import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateEventDto {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  type?: string;
  location?: string;
  color?: string;
  clientId?: string;
  dealId?: string;
  terceroId?: string;
  attendees?: string;
  reminder?: number;
  createdBy?: string;
}

export interface UpdateEventDto extends Partial<CreateEventDto> {
  status?: string;
}

const calendarService = {
  // Get all events with optional date range filter
  async getAll(params?: { start?: Date; end?: Date; clientId?: string; dealId?: string; terceroId?: string }) {
    const where: any = {};

    if (params?.start && params?.end) {
      where.OR = [
        {
          start: { gte: params.start, lte: params.end }
        },
        {
          end: { gte: params.start, lte: params.end }
        },
        {
          AND: [
            { start: { lte: params.start } },
            { end: { gte: params.end } }
          ]
        }
      ];
    }

    if (params?.clientId) {
      where.clientId = params.clientId;
    }

    if (params?.dealId) {
      where.dealId = params.dealId;
    }

    if (params?.terceroId) {
      where.terceroId = params.terceroId;
    }

    return prisma.calendarEvent.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true, logo: true }
        },
        deal: {
          select: { id: true, name: true, company: true }
        },
        tercero: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { start: 'asc' }
    });
  },

  // Get single event by ID
  async getById(id: string) {
    return prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true, logo: true, email: true, phone: true }
        },
        deal: {
          select: { id: true, name: true, company: true, phone: true, email: true }
        },
        tercero: {
          select: { id: true, nombre: true, email: true, telefono: true }
        }
      }
    });
  },

  // Create new event
  async create(data: CreateEventDto) {
    return prisma.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description,
        start: data.start,
        end: data.end,
        allDay: data.allDay || false,
        type: data.type || 'meeting',
        location: data.location,
        color: data.color,
        clientId: data.clientId || null,
        dealId: data.dealId || null,
        terceroId: data.terceroId || null,
        attendees: data.attendees,
        reminder: data.reminder,
        createdBy: data.createdBy,
        status: 'scheduled'
      },
      include: {
        client: { select: { id: true, name: true, logo: true } },
        deal: { select: { id: true, name: true, company: true } },
        tercero: { select: { id: true, nombre: true } }
      }
    });
  },

  // Update event
  async update(id: string, data: UpdateEventDto) {
    return prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.start !== undefined && { start: data.start }),
        ...(data.end !== undefined && { end: data.end }),
        ...(data.allDay !== undefined && { allDay: data.allDay }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.clientId !== undefined && { clientId: data.clientId || null }),
        ...(data.dealId !== undefined && { dealId: data.dealId || null }),
        ...(data.terceroId !== undefined && { terceroId: data.terceroId || null }),
        ...(data.attendees !== undefined && { attendees: data.attendees }),
        ...(data.reminder !== undefined && { reminder: data.reminder }),
        ...(data.status !== undefined && { status: data.status })
      },
      include: {
        client: { select: { id: true, name: true, logo: true } },
        deal: { select: { id: true, name: true, company: true } },
        tercero: { select: { id: true, nombre: true } }
      }
    });
  },

  // Delete event
  async delete(id: string) {
    return prisma.calendarEvent.delete({
      where: { id }
    });
  },

  // Get upcoming events (next 7 days)
  async getUpcoming(limit = 5) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return prisma.calendarEvent.findMany({
      where: {
        start: { gte: now, lte: weekFromNow },
        status: 'scheduled'
      },
      include: {
        client: { select: { id: true, name: true, logo: true } },
        deal: { select: { id: true, name: true, company: true } },
        tercero: { select: { id: true, nombre: true } }
      },
      orderBy: { start: 'asc' },
      take: limit
    });
  }
};

export default calendarService;
