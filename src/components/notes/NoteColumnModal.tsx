import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProjectNoteColumn } from '@/types/taskTypes';

const COLUMN_COLORS = [
  { value: 'bg-purple-500', label: 'Morado' },
  { value: 'bg-blue-500', label: 'Azul' },
  { value: 'bg-cyan-500', label: 'Cian' },
  { value: 'bg-teal-500', label: 'Verde azulado' },
  { value: 'bg-green-500', label: 'Verde' },
  { value: 'bg-yellow-500', label: 'Amarillo' },
  { value: 'bg-orange-500', label: 'Naranja' },
  { value: 'bg-red-500', label: 'Rojo' },
  { value: 'bg-pink-500', label: 'Rosa' },
  { value: 'bg-gray-500', label: 'Gris' },
];

interface NoteColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => void;
  editingColumn?: ProjectNoteColumn | null;
  isSaving: boolean;
}

export default function NoteColumnModal({
  isOpen,
  onClose,
  onSave,
  editingColumn,
  isSaving,
}: NoteColumnModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('bg-purple-500');

  useEffect(() => {
    if (editingColumn) {
      setName(editingColumn.name);
      setColor(editingColumn.color);
    } else {
      setName('');
      setColor('bg-purple-500');
    }
  }, [editingColumn, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingColumn ? 'Editar columna' : 'Nueva columna de notas'}
          </DialogTitle>
          <DialogDescription>
            {editingColumn
              ? 'Modifica el nombre y color de la columna.'
              : 'Crea una nueva columna para organizar tus notas.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Recursos, Enlaces, Ideas..."
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-full ${c.value} transition-all ${
                      color === c.value
                        ? 'ring-2 ring-offset-2 ring-primary scale-110'
                        : 'hover:scale-105'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? 'Guardando...' : editingColumn ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
