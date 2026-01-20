import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import esLocale from '@fullcalendar/core/locales/es';
import { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Calendar, Plus, Trash2, Edit2, MapPin, Clock, Users, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;
  type: string;
  location?: string;
  color?: string;
  clientId?: string;
  clientName?: string;
  dealId?: string;
  dealName?: string;
  terceroId?: string;
  terceroName?: string;
  attendees?: string;
  reminder?: number;
  status: string;
}

interface Client {
  id: string;
  name: string;
}

interface Deal {
  id: string;
  title: string;
}

interface Tercero {
  id: string;
  nombre: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

const EVENT_TYPES = [
  { value: 'meeting', label: 'Reunión', color: '#3b82f6' },
  { value: 'call', label: 'Llamada', color: '#22c55e' },
  { value: 'followup', label: 'Seguimiento', color: '#f59e0b' },
  { value: 'presentation', label: 'Presentación', color: '#8b5cf6' },
  { value: 'deadline', label: 'Fecha límite', color: '#ef4444' },
  { value: 'other', label: 'Otro', color: '#6b7280' },
];

const Calendario = () => {
  const { toast } = useToast();
  const calendarRef = useRef<FullCalendar>(null);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: '',
    end: '',
    allDay: false,
    type: 'meeting',
    location: '',
    color: '#3b82f6',
    clientId: '',
    dealId: '',
    terceroId: '',
    attendees: '',
    reminder: 30,
  });

  // Fetch events
  const fetchEvents = async () => {
    try {
      const response = await apiClient.get('/calendar');
      setEvents(response.data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      // Don't show error toast, just set empty events
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients
  const fetchClients = async () => {
    try {
      const response = await apiClient.get('/clients');
      setClients(response.data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  // Fetch deals
  const fetchDeals = async () => {
    try {
      const response = await apiClient.get('/crm/deals');
      setDeals(response.data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    }
  };

  // Fetch terceros
  const fetchTerceros = async () => {
    try {
      const response = await apiClient.get('/terceros');
      setTerceros(response.data || []);
    } catch (error) {
      console.error('Error fetching terceros:', error);
    }
  };

  // Fetch users for attendees
  const fetchUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchClients();
    fetchDeals();
    fetchTerceros();
    fetchUsers();
  }, []);

  // Handle date select (create new event)
  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setIsEditing(false);
    setSelectedEvent(null);
    setSelectedAttendees([]);

    const startDate = new Date(selectInfo.start);
    const endDate = new Date(selectInfo.end);

    setFormData({
      title: '',
      description: '',
      start: formatDateTimeLocal(startDate),
      end: formatDateTimeLocal(endDate),
      allDay: selectInfo.allDay,
      type: 'meeting',
      location: '',
      color: '#3b82f6',
      clientId: '',
      dealId: '',
      terceroId: '',
      attendees: '',
      reminder: 30,
    });
    setDialogOpen(true);
  };

  // Handle event click (edit event)
  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      setIsEditing(true);
      setSelectedEvent(event);
      setSelectedAttendees([]);
      setFormData({
        title: event.title,
        description: event.description || '',
        start: formatDateTimeLocal(new Date(event.start)),
        end: formatDateTimeLocal(new Date(event.end)),
        allDay: event.allDay,
        type: event.type,
        location: event.location || '',
        color: event.color || '#3b82f6',
        clientId: event.clientId || '',
        dealId: event.dealId || '',
        terceroId: event.terceroId || '',
        attendees: event.attendees || '',
        reminder: event.reminder || 30,
      });
      setDialogOpen(true);
    }
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { event } = dropInfo;
    try {
      await apiClient.put(`/calendar/${event.id}`, {
        start: event.start?.toISOString(),
        end: event.end?.toISOString(),
      });

      toast({
        title: 'Evento actualizado',
        description: 'El evento se movió correctamente',
      });
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      dropInfo.revert();
      toast({
        title: 'Error',
        description: 'No se pudo mover el evento',
        variant: 'destructive',
      });
    }
  };

  // Save event (create or update)
  const handleSaveEvent = async () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'El título es requerido',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Build attendees string from selected users
      const attendeesStr = selectedAttendees.length > 0
        ? users.filter(u => selectedAttendees.includes(u.id)).map(u => `${u.firstName} ${u.lastName}`).join(', ')
        : formData.attendees;

      const eventData = {
        ...formData,
        attendees: attendeesStr,
        clientId: formData.clientId || undefined,
        dealId: formData.dealId || undefined,
        terceroId: formData.terceroId || undefined,
      };

      if (isEditing) {
        await apiClient.put(`/calendar/${selectedEvent?.id}`, eventData);
      } else {
        await apiClient.post('/calendar', eventData);
      }

      toast({
        title: isEditing ? 'Evento actualizado' : 'Evento creado',
        description: isEditing ? 'El evento se actualizó correctamente' : 'El evento se creó correctamente',
      });

      setDialogOpen(false);
      setSelectedAttendees([]);
      fetchEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el evento',
        variant: 'destructive',
      });
    }
  };

  // Delete event
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      await apiClient.delete(`/calendar/${selectedEvent.id}`);

      toast({
        title: 'Evento eliminado',
        description: 'El evento se eliminó correctamente',
      });

      setDeleteDialogOpen(false);
      setDialogOpen(false);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el evento',
        variant: 'destructive',
      });
    }
  };

  // Toggle attendee selection
  const toggleAttendee = (userId: string) => {
    setSelectedAttendees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Format date for datetime-local input
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert events for FullCalendar
  const calendarEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    backgroundColor: event.color || EVENT_TYPES.find(t => t.value === event.type)?.color || '#3b82f6',
    borderColor: event.color || EVENT_TYPES.find(t => t.value === event.type)?.color || '#3b82f6',
    extendedProps: {
      description: event.description,
      type: event.type,
      location: event.location,
      clientName: event.clientName,
      dealName: event.dealName,
      terceroName: event.terceroName,
    },
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Calendario
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus citas y eventos con clientes y prospectos
          </p>
        </div>
        <Button onClick={() => {
          setIsEditing(false);
          setSelectedEvent(null);
          setSelectedAttendees([]);
          const now = new Date();
          const later = new Date(now.getTime() + 60 * 60 * 1000);
          setFormData({
            title: '',
            description: '',
            start: formatDateTimeLocal(now),
            end: formatDateTimeLocal(later),
            allDay: false,
            type: 'meeting',
            location: '',
            color: '#3b82f6',
            clientId: '',
            dealId: '',
            terceroId: '',
            attendees: '',
            reminder: 30,
          });
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Evento
        </Button>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            events={calendarEvents}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            height="auto"
            aspectRatio={1.8}
            eventDisplay="block"
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              meridiem: false,
              hour12: false,
            }}
          />
        </CardContent>
      </Card>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Reunión con cliente"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de evento</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => {
                  const eventType = EVENT_TYPES.find(t => t.value === value);
                  setFormData({
                    ...formData,
                    type: value,
                    color: eventType?.color || '#3b82f6',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* All Day Switch */}
            <div className="flex items-center gap-2">
              <Switch
                id="allDay"
                checked={formData.allDay}
                onCheckedChange={(checked) => setFormData({ ...formData, allDay: checked })}
              />
              <Label htmlFor="allDay">Todo el día</Label>
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Inicio
                </Label>
                <Input
                  id="start"
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  value={formData.allDay ? formData.start.split('T')[0] : formData.start}
                  onChange={(e) => setFormData({ ...formData, start: formData.allDay ? e.target.value + 'T00:00' : e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Fin</Label>
                <Input
                  id="end"
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  value={formData.allDay ? formData.end.split('T')[0] : formData.end}
                  onChange={(e) => setFormData({ ...formData, end: formData.allDay ? e.target.value + 'T23:59' : e.target.value })}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">
                <MapPin className="h-4 w-4 inline mr-1" />
                Ubicación
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ej: Oficina, Zoom, Google Meet..."
              />
            </div>

            {/* Related entities */}
            <div className="space-y-4">
              <Label className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Relacionado con
              </Label>

              {/* Client */}
              <Select
                value={formData.clientId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, clientId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Deal */}
              <Select
                value={formData.dealId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, dealId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar prospecto/deal (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin prospecto</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Tercero */}
              <Select
                value={formData.terceroId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, terceroId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tercero (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tercero</SelectItem>
                  {terceros.map((tercero) => (
                    <SelectItem key={tercero.id} value={tercero.id}>
                      {tercero.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notas adicionales sobre el evento..."
                rows={3}
              />
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <Label>Asistentes del equipo</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-32 overflow-y-auto">
                {users.length > 0 ? (
                  users.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`attendee-${user.id}`}
                        checked={selectedAttendees.includes(user.id)}
                        onCheckedChange={() => toggleAttendee(user.id)}
                      />
                      <label
                        htmlFor={`attendee-${user.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {user.firstName} {user.lastName}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground col-span-2">No hay usuarios disponibles</p>
                )}
              </div>
              {selectedAttendees.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedAttendees.length} asistente(s) seleccionado(s)
                </p>
              )}
            </div>

            {/* Additional attendees (external) */}
            <div className="space-y-2">
              <Label htmlFor="attendees">Otros asistentes (externos)</Label>
              <Input
                id="attendees"
                value={formData.attendees}
                onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                placeholder="Nombres separados por coma"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {isEditing && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEvent}>
                {isEditing ? 'Guardar cambios' : 'Crear evento'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p>¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteEvent}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendario;
