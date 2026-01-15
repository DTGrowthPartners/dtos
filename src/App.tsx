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
import CuentasCobro from "@/pages/CuentasCobro";
import CRM from "@/pages/CRM";
import Terceros from "@/pages/Terceros";
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
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/servicios" element={<Servicios />} />
              <Route path="/campanas" element={<Campanas />} />
              <Route path="/tareas" element={<Tareas />} />
              <Route path="/mis-tareas" element={<MisTareas />} />
              <Route path="/reportes" element={<Reportes />} />
              <Route path="/equipo" element={<Equipo />} />
              <Route path="/productos" element={<Productos />} />
              <Route path="/finanzas" element={<Finanzas />} />
              {/* <Route path="/proveedores" element={<Proveedores />} /> // Temporalmente oculto */}
              <Route path="/cuentas-cobro" element={<CuentasCobro />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/terceros" element={<Terceros />} />
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
