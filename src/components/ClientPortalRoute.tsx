import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth';

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
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
