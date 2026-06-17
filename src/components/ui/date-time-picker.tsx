import * as React from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ===== Helpers de conversión (se trabaja con strings locales, sin desfase de TZ) =====

// 'YYYY-MM-DD' -> Date (medianoche local). '' -> undefined.
const strToDate = (s: string): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

// Date -> 'YYYY-MM-DD' (local).
const dateToStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 'HH:mm' (24h) -> etiqueta 12h en español, p.ej. "02:30 p. m."
const timeLabel = (s: string): string => {
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return s;
  const d = new Date(2000, 0, 1, h, m);
  return format(d, 'hh:mm a', { locale: es });
};

// ===== DatePicker =====

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD' o ''
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, disabled, placeholder = 'Elegir fecha', className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = strToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-80 shrink-0" />
          {selected ? format(selected, "d 'de' MMM yyyy", { locale: es }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            onChange(d ? dateToStr(d) : '');
            setOpen(false);
          }}
          initialFocus
        />
        {selected && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Quitar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ===== TimePicker =====

interface TimePickerProps {
  value: string; // 'HH:mm' o ''
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Paso en minutos para las opciones (default 15). */
  step?: number;
}

export function TimePicker({ value, onChange, disabled, placeholder = '--:--', className, step = 15 }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Genera las opciones de hora (00:00 .. 23:45). Incluye el valor actual si no cae en el paso.
  const options = React.useMemo(() => {
    const list: string[] = [];
    for (let mins = 0; mins < 24 * 60; mins += step) {
      const h = String(Math.floor(mins / 60)).padStart(2, '0');
      const m = String(mins % 60).padStart(2, '0');
      list.push(`${h}:${m}`);
    }
    if (value && !list.includes(value)) {
      list.push(value);
      list.sort();
    }
    return list;
  }, [step, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 opacity-80 shrink-0" />
          {value ? timeLabel(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        <div className="max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                'w-full rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                value === opt && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
              )}
            >
              {timeLabel(opt)}
            </button>
          ))}
        </div>
        {value && (
          <div className="border-t mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full rounded-sm px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-accent"
            >
              Quitar hora
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
