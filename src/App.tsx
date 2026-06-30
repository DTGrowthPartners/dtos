import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { MainLayout } from "@/components/layout/MainLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import ClientPortalRoute from "@/components/ClientPortalRoute";
import { ClientPortalLayout } from "@/components/layout/ClientPortalLayout";

// Páginas: carga diferida (code-splitting) para que el bundle inicial sea pequeño
// y la app abra rápido en móvil. Cada página llega en su propio chunk bajo demanda.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const SalesDashboard = lazy(() => import("@/pages/SalesDashboard"));
const ExecutiveDashboard = lazy(() => import("@/pages/ExecutiveDashboard"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const ClientesRedesign = lazy(() => import("@/pages/ClientesRedesign"));
const Servicios = lazy(() => import("@/pages/Servicios"));
const Tareas = lazy(() => import("@/pages/Tareas"));
const MisTareas = lazy(() => import("@/pages/MisTareas"));
const Reportes = lazy(() => import("@/pages/Reportes"));
const Equipo = lazy(() => import("@/pages/Equipo"));
const Productos = lazy(() => import("@/pages/Productos"));
const Finanzas = lazy(() => import("@/pages/Finanzas"));
const CRM = lazy(() => import("@/pages/CRM"));
const Terceros = lazy(() => import("@/pages/Terceros"));
const CuentasCobro = lazy(() => import("@/pages/CuentasCobro"));
const Apps = lazy(() => import("@/pages/Apps"));
const Agentes = lazy(() => import("@/pages/Agentes"));
const Crons = lazy(() => import("@/pages/Crons"));
const Procesos = lazy(() => import("@/pages/Procesos"));
const Vps = lazy(() => import("@/pages/Vps"));
const Logs = lazy(() => import("@/pages/Logs"));
const CobrosMRR = lazy(() => import("@/pages/CobrosMRR"));
const Propuestas = lazy(() => import("@/pages/Propuestas"));
const Dominios = lazy(() => import("@/pages/Dominios"));
const Webs = lazy(() => import("@/pages/Webs"));
const Profile = lazy(() => import("@/pages/Profile"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Portal de clientes
const ClientDashboard = lazy(() => import("@/pages/portal/ClientDashboard"));
const ClientCampaigns = lazy(() => import("@/pages/portal/ClientCampaigns"));
const ClientBudgetSales = lazy(() => import("@/pages/portal/ClientBudgetSales"));
const ClientServices = lazy(() => import("@/pages/portal/ClientServices"));
const ClientReports = lazy(() => import("@/pages/portal/ClientReports"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SidebarProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
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
                <Route path="/" element={<SalesDashboard />} />
                <Route path="/dashboard" element={<SalesDashboard />} />
                <Route path="/dashboard-clasico" element={<Dashboard />} />
                <Route path="/dashboard-executive" element={<ExecutiveDashboard />} />
                <Route path="/clientes" element={<ProtectedRoute requiredPermission="clientes"><Clientes /></ProtectedRoute>} />
                <Route path="/clientes-v2" element={<ProtectedRoute requiredPermission="clientes"><ClientesRedesign /></ProtectedRoute>} />
                <Route path="/servicios" element={<ProtectedRoute requiredPermission="servicios"><Servicios /></ProtectedRoute>} />
                <Route path="/tareas" element={<ProtectedRoute requiredPermission="tareas"><Tareas /></ProtectedRoute>} />
                <Route path="/mis-tareas" element={<MisTareas />} />
                <Route path="/reportes" element={<ProtectedRoute requiredPermission="reportes"><Reportes /></ProtectedRoute>} />
                <Route path="/equipo" element={<ProtectedRoute requiredPermission="equipo"><Equipo /></ProtectedRoute>} />
                <Route path="/productos" element={<ProtectedRoute requiredPermission="productos"><Productos /></ProtectedRoute>} />
                <Route path="/finanzas" element={<ProtectedRoute requiredPermission="finanzas"><Finanzas /></ProtectedRoute>} />
                <Route path="/cuentas-cobro" element={<ProtectedRoute requiredPermission="finanzas"><CuentasCobro /></ProtectedRoute>} />
                <Route path="/crm" element={<ProtectedRoute requiredPermission="crm"><CRM /></ProtectedRoute>} />
                <Route path="/terceros" element={<ProtectedRoute requiredPermission="terceros"><Terceros /></ProtectedRoute>} />
                <Route path="/apps" element={<Apps />} />
                <Route path="/agentes" element={<ProtectedRoute requiredPermission="agentes"><Agentes /></ProtectedRoute>} />
                <Route path="/crons" element={<ProtectedRoute requiredPermission="crons"><Crons /></ProtectedRoute>} />
                <Route path="/procesos" element={<ProtectedRoute requiredPermission="procesos"><Procesos /></ProtectedRoute>} />
                <Route path="/vps" element={<ProtectedRoute requiredPermission="vps"><Vps /></ProtectedRoute>} />
                <Route path="/logs" element={<ProtectedRoute requiredPermission="logs"><Logs /></ProtectedRoute>} />
                <Route path="/cobros" element={<ProtectedRoute requiredPermission="cobros"><CobrosMRR /></ProtectedRoute>} />
                <Route path="/propuestas" element={<ProtectedRoute requiredPermission="propuestas"><Propuestas /></ProtectedRoute>} />
                <Route path="/dominios" element={<ProtectedRoute requiredPermission="dominios"><Dominios /></ProtectedRoute>} />
                <Route path="/webs" element={<ProtectedRoute requiredPermission="webs"><Webs /></ProtectedRoute>} />
                <Route path="/perfil" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </SidebarProvider>
  </QueryClientProvider>
);

export default App;
