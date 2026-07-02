import { useState, useEffect } from 'react';
import { Plus, MapPin, Phone, Edit, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface Sede {
  id: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  esPrincipal: boolean;
}

interface Props {
  client: { id: string; name: string };
}

const emptyForm = { nombre: '', direccion: '', ciudad: '', telefono: '', esPrincipal: false };

export default function ClientSedesManager({ client }: Props) {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sede | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSedes = async () => {
    try {
      setSedes(await apiClient.get<Sede[]>(`/api/clients/${client.id}/sedes`));
    } catch (e) {
      console.error('Error fetching sedes:', e);
    }
  };

  useEffect(() => {
    fetchSedes();
  }, [client.id]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setIsDialogOpen(true); };
  const openEdit = (s: Sede) => {
    setEditing(s);
    setForm({ nombre: s.nombre, direccion: s.direccion || '', ciudad: s.ciudad || '', telefono: s.telefono || '', esPrincipal: s.esPrincipal });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editing) {
        await apiClient.put(`/api/clients/${client.id}/sedes/${editing.id}`, form);
        toast({ title: 'Sede actualizada' });
      } else {
        await apiClient.post(`/api/clients/${client.id}/sedes`, form);
        toast({ title: 'Sede agregada' });
      }
      setIsDialogOpen(false);
      fetchSedes();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (s: Sede) => {
    if (!confirm(`¿Eliminar la sede "${s.nombre}"?`)) return;
    try {
      await apiClient.delete(`/api/clients/${client.id}/sedes/${s.id}`);
      toast({ title: 'Sede eliminada' });
      fetchSedes();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sedes.length} sede{sedes.length !== 1 ? 's' : ''} física{sedes.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Agregar sede
        </Button>
      </div>

      {sedes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <MapPin className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No hay sedes registradas</p>
            <Button variant="link" onClick={openNew} className="mt-2">Agregar primera sede</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sedes.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium truncate">{s.nombre}</span>
                      {s.esPrincipal && (
                        <Badge className="bg-primary/15 text-primary gap-1"><Star className="h-3 w-3" /> Principal</Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {s.direccion && <p>{s.direccion}{s.ciudad ? `, ${s.ciudad}` : ''}</p>}
                      {!s.direccion && s.ciudad && <p>{s.ciudad}</p>}
                      {s.telefono && (
                        <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {s.telefono}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
            <DialogDescription>{editing ? 'Actualiza los datos de la sede' : `Agregar sede a ${client.name}`}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre de la sede *</Label>
                <Input placeholder="Ej: La Castellana, Bocagrande" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input placeholder="Calle 00 # 00-00" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} disabled={isLoading} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input placeholder="Cartagena" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input placeholder="+57 300 123 4567" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} disabled={isLoading} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.esPrincipal} onChange={(e) => setForm({ ...form, esPrincipal: e.target.checked })} className="h-4 w-4 accent-primary" disabled={isLoading} />
                Marcar como sede principal
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>Cancelar</Button>
              <Button type="submit" disabled={isLoading || !form.nombre.trim()}>{isLoading ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
