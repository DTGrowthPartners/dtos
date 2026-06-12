import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { MainLayout } from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import ExecutiveDashboard from "@/pages/ExecutiveDashboard";
import Clientes from "@/pages/Clientes";
import Servicios from "@/pages/Servicios";
import Tareas from "@/pages/Tareas";
import MisTareas from "@/pages/MisTareas";
import Reportes from "@/pages/Reportes";
import Equipo from "@/pages/Equipo";
import Productos from "@/pages/Productos";
import Finanzas from "@/pages/Finanzas";
import CRM from "@/pages/CRM";
import Terceros from "@/pages/Terceros";
import CuentasCobro from "@/pages/CuentasCobro";
import Apps from "@/pages/Apps";
import Agentes from "@/pages/Agentes";
import Crons from "@/pages/Crons";
import Procesos from "@/pages/Procesos";
import Vps from "@/pages/Vps";
import Logs from "@/pages/Logs";
// import Brief from "@/pages/Brief"; // Moved to Tareas
// import Proveedores from "@/pages/Proveedores"; // Temporalmente oculto
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";

// Client Portal
import ClientPortalRoute from "@/components/ClientPortalRoute";
import { ClientPortalLayout } from "@/components/layout/ClientPortalLayout";
import ClientDashboard from "@/pages/portal/ClientDashboard";
import ClientCampaigns from "@/pages/portal/ClientCampaigns";
import ClientBudgetSales from "@/pages/portal/ClientBudgetSales";
import ClientServices from "@/pages/portal/ClientServices";
import ClientReports from "@/pages/portal/ClientReports";

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

            {/* Client Portal Routes */}
            <Route element={<ClientPortalRoute><ClientPortalLayout /></ClientPortalRoute>}>
              <Route path="/portal" element={<ClientDashboard />} />
              <Route path="/portal/dashboard" element={<ClientDashboard />} />
              <Route path="/portal/campaigns" element={<ClientCampaigns />} />
              <Route path="/portal/budget" element={<ClientBudgetSales />} />
              <Route path="/portal/services" element={<ClientServices />} />
              <Route path="/portal/reports" element={<ClientReports />} />
            </Route>

            {/* Main App Routes */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/" element={<ExecutiveDashboard />} />
              <Route path="/dashboard" element={<ExecutiveDashboard />} />
              <Route path="/dashboard-classic" element={<Dashboard />} />
              <Route path="/clientes" element={<ProtectedRoute requiredPermission="clientes"><Clientes /></ProtectedRoute>} />
              <Route path="/servicios" element={<ProtectedRoute requiredPermission="servicios"><Servicios /></ProtectedRoute>} />
              <Route path="/tareas" element={<ProtectedRoute requiredPermission="tareas"><Tareas /></ProtectedRoute>} />
              <Route path="/mis-tareas" element={<MisTareas />} />
              <Route path="/reportes" element={<ProtectedRoute requiredPermission="reportes"><Reportes /></ProtectedRoute>} />
              <Route path="/equipo" element={<ProtectedRoute requiredPermission="equipo"><Equipo /></ProtectedRoute>} />
              <Route path="/productos" element={<ProtectedRoute requiredPermission="productos"><Productos /></ProtectedRoute>} />
              <Route path="/finanzas" element={<ProtectedRoute requiredPermission="finanzas"><Finanzas /></ProtectedRoute>} />
              <Route path="/cuentas-cobro" element={<ProtectedRoute requiredPermission="finanzas"><CuentasCobro /></ProtectedRoute>} />
              {/* <Route path="/proveedores" element={<Proveedores />} /> // Temporalmente oculto */}
              <Route path="/crm" element={<ProtectedRoute requiredPermission="crm"><CRM /></ProtectedRoute>} />
              <Route path="/terceros" element={<ProtectedRoute requiredPermission="terceros"><Terceros /></ProtectedRoute>} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/agentes" element={<ProtectedRoute requiredPermission="agentes"><Agentes /></ProtectedRoute>} />
              <Route path="/crons" element={<ProtectedRoute requiredPermission="crons"><Crons /></ProtectedRoute>} />
              <Route path="/procesos" element={<ProtectedRoute requiredPermission="procesos"><Procesos /></ProtectedRoute>} />
              <Route path="/vps" element={<ProtectedRoute requiredPermission="vps"><Vps /></ProtectedRoute>} />
              <Route path="/logs" element={<ProtectedRoute requiredPermission="logs"><Logs /></ProtectedRoute>} />
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
