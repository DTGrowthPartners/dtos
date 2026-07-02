import { useState, useEffect } from 'react';
import { Plus, User, Mail, Phone, Briefcase, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

interface Contacto {
  id: string;
  nombre: string;
  cargo?: string;
  email?: string;
  telefono?: string;
}

interface Props {
  client: { id: string; name: string };
}

const emptyForm = { nombre: '', cargo: '', email: '', telefono: '' };

export default function ClientContactsManager({ client }: Props) {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contacto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchContactos = async () => {
    try {
      setContactos(await apiClient.get<Contacto[]>(`/api/terceros?clientId=${client.id}`));
    } catch (e) {
      console.error('Error fetching contactos:', e);
    }
  };

  useEffect(() => {
    fetchContactos();
  }, [client.id]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setIsDialogOpen(true); };
  const openEdit = (c: Contacto) => {
    setEditing(c);
    setForm({ nombre: c.nombre, cargo: c.cargo || '', email: c.email || '', telefono: c.telefono || '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editing) {
        await apiClient.put(`/api/terceros/${editing.id}`, form);
        toast({ title: 'Contacto actualizado' });
      } else {
        await apiClient.post('/api/terceros', { ...form, clientId: client.id, esCliente: true });
        toast({ title: 'Contacto agregado' });
      }
      setIsDialogOpen(false);
      fetchContactos();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (c: Contacto) => {
    if (!confirm(`¿Eliminar el contacto "${c.nombre}"?`)) return;
    try {
      await apiClient.delete(`/api/terceros/${c.id}`);
      toast({ title: 'Contacto eliminado' });
      fetchContactos();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contactos.length} contacto{contactos.length !== 1 ? 's' : ''} (gerencia, contabilidad, etc.)
        </p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Agregar contacto
        </Button>
      </div>

      {contactos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <User className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No hay contactos registrados</p>
            <Button variant="link" onClick={openNew} className="mt-2">Agregar primer contacto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {contactos.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium truncate">{c.nombre}</span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {c.cargo && <p className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> {c.cargo}</p>}
                      {c.email && <p className="flex items-center gap-1.5 break-all"><Mail className="h-3 w-3 flex-shrink-0" /> {c.email}</p>}
                      {c.telefono && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.telefono}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogTitle>{editing ? 'Editar contacto' : 'Nuevo contacto'}</DialogTitle>
            <DialogDescription>{editing ? 'Actualiza los datos del contacto' : `Agregar contacto a ${client.name}`}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input placeholder="Nombre del contacto" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo / Rol</Label>
                  <Input placeholder="Gerencia, Contador…" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} disabled={isLoading} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="contacto@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input placeholder="+57 300 123 4567" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} disabled={isLoading} />
              </div>
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
