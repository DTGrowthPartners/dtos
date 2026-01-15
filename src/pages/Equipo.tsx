import { useState, useEffect } from 'react';
import { Mail, Plus, Pencil, Trash2, X, Users, UserPlus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const MODULE_PERMISSIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'crm', label: 'CRM' },
  { value: 'terceros', label: 'Terceros' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'campanas', label: 'Campañas' },
  { value: 'tareas', label: 'Tareas' },
  { value: 'reportes', label: 'Reportes' },
  { value: 'productos', label: 'Productos' },
  { value: 'equipo', label: 'Equipo' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'cuentas-cobro', label: 'Cuentas de Cobro' },
] as const;

// Permisos por defecto para nuevos usuarios (todos excepto finanzas y equipo)
const DEFAULT_USER_PERMISSIONS = [
  'dashboard',
  'clientes',
  'servicios',
  'campanas',
  'tareas',
  'reportes',
  'productos',
  'cuentas-cobro',
  'crm',
  'terceros',
];

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  roleId: string;
  firebaseUid?: string;
  createdAt: string;
  updatedAt?: string;
  role: {
    id: string;
    name: string;
    permissions?: string[];
  };
}

const roleConfig: Record<string, { label: string; className: string }> = {
  admin: { label: 'Administrador', className: 'bg-primary/10 text-primary border-primary/20' },
  manager: { label: 'Manager', className: 'bg-chart-4/10 text-chart-4 border-chart-4/20' },
  user: { label: 'Usuario', className: 'bg-success/10 text-success border-success/20' },
  specialist: { label: 'Especialista', className: 'bg-success/10 text-success border-success/20' },
  designer: { label: 'Diseñador', className: 'bg-warning/10 text-warning border-warning/20' },
};

export default function Equipo() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleId: '',
    permissions: [...DEFAULT_USER_PERMISSIONS] as string[],
  });

  useEffect(() => {
    const currentUser = authService.getUser();
    setIsAdmin(currentUser?.role === 'admin');
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        apiClient.get<User[]>('/api/users'),
        apiClient.get<Role[]>('/api/users/roles'),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      roleId: '',
      permissions: [...DEFAULT_USER_PERMISSIONS],
    });
  };

  const handleCreate = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.roleId) {
      toast({
        title: 'Error',
        description: 'Todos los campos son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      await apiClient.post('/api/users', formData);
      toast({
        title: 'Usuario creado',
        description: 'El usuario ha sido creado exitosamente',
      });
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el usuario',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;

    if (!formData.firstName || !formData.lastName || !formData.roleId) {
      toast({
        title: 'Error',
        description: 'Nombre, apellido y rol son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const updateData: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        roleId: formData.roleId,
        permissions: formData.permissions,
      };

      if (formData.email && formData.email !== selectedUser.email) {
        updateData.email = formData.email;
      }

      if (formData.password) {
        updateData.password = formData.password;
      }

      await apiClient.put(`/api/users/${selectedUser.id}`, updateData);
      toast({
        title: 'Usuario actualizado',
        description: 'El usuario ha sido actualizado exitosamente',
      });
      setShowEditModal(false);
      setSelectedUser(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el usuario',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      setIsSaving(true);
      await apiClient.delete(`/api/users/${selectedUser.id}`);
      toast({
        title: 'Usuario eliminado',
        description: 'El usuario ha sido eliminado exitosamente',
      });
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el usuario',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      permissions: user.permissions || [],
    });
    setShowEditModal(true);
  };

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const selectAllPermissions = () => {
    setFormData((prev) => ({
      ...prev,
      permissions: MODULE_PERMISSIONS.map((p) => p.value),
    }));
  };

  const clearAllPermissions = () => {
    setFormData((prev) => ({
      ...prev,
      permissions: [],
    }));
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  };

  const getRoleDisplay = (roleName: string) => {
    return roleConfig[roleName] || { label: roleName, className: 'bg-muted text-muted-foreground' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipo</h1>
          <p className="text-muted-foreground">Gestiona los miembros del equipo</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)} className="w-full md:w-auto">
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Team Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Usuarios</p>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Administradores</p>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.role.name === 'admin').length}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <Users className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usuarios</p>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.role.name !== 'admin').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => {
          const roleDisplay = getRoleDisplay(user.role.name);

          return (
            <div
              key={user.id}
              className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                    {getInitials(user.firstName, user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {user.firstName} {user.lastName}
                  </h3>
                  <Badge variant="outline" className={cn('text-xs mt-1', roleDisplay.className)}>
                    {roleDisplay.label}
                  </Badge>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.role.name !== 'admin' && user.permissions && user.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {user.permissions.slice(0, 4).map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {MODULE_PERMISSIONS.find((m) => m.value === perm)?.label || perm}
                        </Badge>
                      ))}
                      {user.permissions.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{user.permissions.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-border flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditModal(user)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => openDeleteDialog(user)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>Crea una nueva cuenta de usuario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-firstName">Nombre</Label>
                <Input
                  id="create-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-lastName">Apellido</Label>
                <Input
                  id="create-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Apellido"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Correo electronico</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Contraseña</Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Contraseña"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Rol</Label>
              <Select
                value={formData.roleId}
                onValueChange={(value) => setFormData({ ...formData, roleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {getRoleDisplay(role.name).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permisos por modulo - solo si no es admin */}
            {formData.roleId && roles.find(r => r.id === formData.roleId)?.name !== 'admin' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permisos de acceso
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllPermissions}
                    >
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllPermissions}
                    >
                      Ninguno
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg max-h-40 overflow-y-auto">
                  {MODULE_PERMISSIONS.map((module) => (
                    <div key={module.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`create-perm-${module.value}`}
                        checked={formData.permissions.includes(module.value)}
                        onCheckedChange={() => togglePermission(module.value)}
                      />
                      <label
                        htmlFor={`create-perm-${module.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {module.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecciona los modulos a los que el usuario tendra acceso.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Usuario
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modifica los datos del usuario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">Nombre</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Apellido</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Apellido"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Correo electronico</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Dejar vacio para mantener"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rol</Label>
              <Select
                value={formData.roleId}
                onValueChange={(value) => setFormData({ ...formData, roleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {getRoleDisplay(role.name).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permisos por modulo */}
            {selectedUser?.role.name !== 'admin' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permisos de acceso
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllPermissions}
                    >
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllPermissions}
                    >
                      Ninguno
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg">
                  {MODULE_PERMISSIONS.map((module) => (
                    <div key={module.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${module.value}`}
                        checked={formData.permissions.includes(module.value)}
                        onCheckedChange={() => togglePermission(module.value)}
                      />
                      <label
                        htmlFor={`perm-${module.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {module.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Los administradores tienen acceso a todos los modulos automaticamente.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente la cuenta de{' '}
              <strong>
                {selectedUser?.firstName} {selectedUser?.lastName}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
