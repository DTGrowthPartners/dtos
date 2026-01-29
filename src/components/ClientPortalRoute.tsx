import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';
import { ShieldAlert } from 'lucide-react';

interface ClientPortalRouteProps {
  children: React.ReactNode;
}

export default function ClientPortalRoute({ children }: ClientPortalRouteProps) {
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

  // Verify user has client role
  const userRole = user?.role?.toLowerCase();
  if (userRole !== 'client') {
    // If logged in but not a client, redirect to main dashboard
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="rounded-full bg-destructive/10 p-4">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Acceso Restringido</h1>
          <p className="text-muted-foreground max-w-md">
            Esta sección está reservada para clientes del portal.
            Si eres un empleado, accede al dashboard principal.
          </p>
          <a
            href="/"
            className="mt-4 text-primary hover:underline"
          >
            Ir al Dashboard Principal
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
