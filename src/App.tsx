import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { MainLayout } from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import Servicios from "@/pages/Servicios";
import Campanas from "@/pages/Campanas";
import Tareas from "@/pages/Tareas";
import MisTareas from "@/pages/MisTareas";
import Reportes from "@/pages/Reportes";
import Equipo from "@/pages/Equipo";
import Productos from "@/pages/Productos";
import Finanzas from "@/pages/Finanzas";
import CRM from "@/pages/CRM";
import Terceros from "@/pages/Terceros";
import Calendario from "@/pages/Calendario";
// import Proveedores from "@/pages/Proveedores"; // Temporalmente oculto
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SidebarProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/clientes" element={<ProtectedRoute requiredPermission="clientes"><Clientes /></ProtectedRoute>} />
              <Route path="/servicios" element={<ProtectedRoute requiredPermission="servicios"><Servicios /></ProtectedRoute>} />
              <Route path="/campanas" element={<ProtectedRoute requiredPermission="campanas"><Campanas /></ProtectedRoute>} />
              <Route path="/tareas" element={<ProtectedRoute requiredPermission="tareas"><Tareas /></ProtectedRoute>} />
              <Route path="/mis-tareas" element={<MisTareas />} />
              <Route path="/reportes" element={<ProtectedRoute requiredPermission="reportes"><Reportes /></ProtectedRoute>} />
              <Route path="/equipo" element={<ProtectedRoute requiredPermission="equipo"><Equipo /></ProtectedRoute>} />
              <Route path="/productos" element={<ProtectedRoute requiredPermission="productos"><Productos /></ProtectedRoute>} />
              <Route path="/finanzas" element={<ProtectedRoute requiredPermission="finanzas"><Finanzas /></ProtectedRoute>} />
              {/* <Route path="/proveedores" element={<Proveedores />} /> // Temporalmente oculto */}
              <Route path="/crm" element={<ProtectedRoute requiredPermission="crm"><CRM /></ProtectedRoute>} />
              <Route path="/terceros" element={<ProtectedRoute requiredPermission="terceros"><Terceros /></ProtectedRoute>} />
              <Route path="/calendario" element={<ProtectedRoute requiredPermission="calendario"><Calendario /></ProtectedRoute>} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SidebarProvider>
  </QueryClientProvider>
);

export default App;
