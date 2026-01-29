import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string; // Permiso requerido para acceder a esta ruta
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { firebaseUser, user, isLoading } = useAuthStore();

  // Wait for Firebase to initialize before checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role?.toLowerCase();

  // Client users should only access the portal, not the main app
  if (userRole === 'client') {
    return <Navigate to="/portal/dashboard" replace />;
  }

  // Verificar permisos si se requiere uno específico
  if (requiredPermission) {
    const userPermissions = user?.permissions || [];

    // Admin siempre tiene acceso a todo
    const isAdmin = userRole === 'admin';

    // Verificar si tiene el permiso específico
    const hasPermission = isAdmin || userPermissions.includes(requiredPermission);

    if (!hasPermission) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="rounded-full bg-destructive/10 p-4">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Acceso Denegado</h1>
            <p className="text-muted-foreground max-w-md">
              No tienes permisos para acceder a esta sección.
              Contacta al administrador si crees que esto es un error.
            </p>
            <a
              href="/"
              className="mt-4 text-primary hover:underline"
            >
              Volver al inicio
            </a>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
