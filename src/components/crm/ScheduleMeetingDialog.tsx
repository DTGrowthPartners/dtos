import { useState } from 'react';
import { Calendar, Clock, MapPin, Video, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId?: string;
  dealName?: string;
  contactEmail?: string;
  onSuccess?: (event: CalendarEvent) => void;
}

interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
  location?: string;
  meetLink?: string;
  clientId?: string;
  dealId?: string;
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  dealId,
  dealName,
  contactEmail,
  onSuccess,
}: ScheduleMeetingDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState(dealName ? `Reunión - ${dealName}` : '');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState(contactEmail || '');
  const [createMeetLink, setCreateMeetLink] = useState(true);

  const resetForm = () => {
    setTitle(dealName ? `Reunión - ${dealName}` : '');
    setDescription('');
    setDate('');
    setStartTime('10:00');
    setEndTime('11:00');
    setLocation('');
    setAttendees(contactEmail || '');
    setCreateMeetLink(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !date || !startTime || !endTime) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    // Validate times
    if (startTime >= endTime) {
      toast({
        title: 'Error',
        description: 'La hora de inicio debe ser anterior a la hora de fin',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Format dates to ISO 8601
      const startDateTime = `${date}T${startTime}:00`;
      const endDateTime = `${date}T${endTime}:00`;

      // Parse attendees (comma or space separated emails)
      const attendeeList = attendees
        .split(/[,\s]+/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));

      const eventData = {
        title,
        description,
        startDateTime,
        endDateTime,
        attendees: attendeeList.length > 0 ? attendeeList : undefined,
        location: location || undefined,
        createMeetLink,
        dealId,
      };

      const endpoint = dealId
        ? `/api/calendar/deal/${dealId}/meeting`
        : '/api/calendar';

      const event = await apiClient.post<CalendarEvent>(endpoint, eventData);

      toast({
        title: 'Cita agendada',
        description: createMeetLink && event.meetLink
          ? 'Se ha creado el evento con enlace de Google Meet'
          : 'El evento ha sido creado en el calendario',
      });

      onSuccess?.(event);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error scheduling meeting:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo agendar la cita',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendar Cita
          </DialogTitle>
          <DialogDescription>
            {dealName
              ? `Programa una reunión para ${dealName}`
              : 'Programa una reunión en Google Calendar'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título de la reunión *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Presentación de propuesta"
              required
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Fecha *
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Inicio *
              </Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Fin *
              </Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label htmlFor="attendees" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Participantes (emails)
            </Label>
            <Input
              id="attendees"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="email@ejemplo.com, otro@ejemplo.com"
            />
            <p className="text-xs text-muted-foreground">
              Separa múltiples emails con comas
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Ubicación (opcional)
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Oficina principal, Calle 123..."
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda de la reunión, temas a tratar..."
              rows={3}
            />
          </div>

          {/* Google Meet toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <Video className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-sm">Google Meet</p>
                <p className="text-xs text-muted-foreground">
                  Crear enlace de videollamada
                </p>
              </div>
            </div>
            <Switch
              checked={createMeetLink}
              onCheckedChange={setCreateMeetLink}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Agendar Cita
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
