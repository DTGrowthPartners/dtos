// Mock data for DT-OS Dashboard

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'active' | 'inactive' | 'prospect';
  services: string[];
  monthlyBudget: number;
  startDate: string;
  lastInteraction: string;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed';
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  client?: string;
  dueDate: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  client: string;
  platform: 'meta' | 'google' | 'tiktok';
  status: 'active' | 'paused' | 'review' | 'completed';
  budget: number;
  spent: number;
  results: number;
  cpa: number;
  roas: number;
  startDate: string;
  endDate?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'specialist' | 'designer';
  avatar?: string;
  activeTasks: number;
  status: 'available' | 'busy' | 'away';
}

export interface Product {
  id: string;
  name: string;
  description: string;
  status: 'development' | 'beta' | 'live';
  progress: number;
  users?: number;
  icon: string;
}

export interface FinanceData {
  month: string;
  income: number;
  expenses: number;
  projected: number;
}

export const clients: Client[] = [
  {
    id: '1',
    name: 'María García',
    email: 'maria@equilibrioclinic.com',
    phone: '+34 612 345 678',
    company: 'Equilibrio Clinic',
    status: 'active',
    services: ['Meta Ads', 'SEO', 'Social Media'],
    monthlyBudget: 3500,
    startDate: '2024-01-15',
    lastInteraction: '2024-12-26',
  },
  {
    id: '2',
    name: 'Carlos Mendoza',
    email: 'carlos@santaalejandria.com',
    phone: '+34 623 456 789',
    company: 'Hoteles Santa Alejandría',
    status: 'active',
    services: ['Meta Ads', 'Google Ads', 'Email Marketing'],
    monthlyBudget: 8000,
    startDate: '2023-06-01',
    lastInteraction: '2024-12-25',
  },
  {
    id: '3',
    name: 'Laura Martínez',
    email: 'laura@techstart.io',
    phone: '+34 634 567 890',
    company: 'TechStart',
    status: 'active',
    services: ['Meta Ads', 'Landing Pages'],
    monthlyBudget: 2500,
    startDate: '2024-03-10',
    lastInteraction: '2024-12-24',
  },
  {
    id: '4',
    name: 'Pedro Sánchez',
    email: 'pedro@fitzone.es',
    phone: '+34 645 678 901',
    company: 'FitZone Gym',
    status: 'active',
    services: ['Meta Ads', 'Social Media'],
    monthlyBudget: 1800,
    startDate: '2024-08-20',
    lastInteraction: '2024-12-23',
  },
  {
    id: '5',
    name: 'Ana Torres',
    email: 'ana@bellezanatural.com',
    phone: '+34 656 789 012',
    company: 'Belleza Natural',
    status: 'prospect',
    services: [],
    monthlyBudget: 0,
    startDate: '',
    lastInteraction: '2024-12-20',
  },
  {
    id: '6',
    name: 'Roberto Díaz',
    email: 'roberto@constructora-rd.com',
    phone: '+34 667 890 123',
    company: 'Constructora RD',
    status: 'inactive',
    services: ['Meta Ads'],
    monthlyBudget: 0,
    startDate: '2023-01-15',
    lastInteraction: '2024-09-15',
  },
];

export const tasks: Task[] = [
  {
    id: '1',
    title: 'Optimizar campañas Meta - Equilibrio Clinic',
    description: 'Revisar y optimizar el rendimiento de las campañas de conversión',
    status: 'in_progress',
    priority: 'high',
    assignee: 'Dairo',
    client: 'Equilibrio Clinic',
    dueDate: '2024-12-27',
    createdAt: '2024-12-20',
  },
  {
    id: '2',
    title: 'Crear reporte mensual - Santa Alejandría',
    description: 'Generar reporte de diciembre con métricas y recomendaciones',
    status: 'todo',
    priority: 'high',
    assignee: 'Mariana',
    client: 'Hoteles Santa Alejandría',
    dueDate: '2024-12-28',
    createdAt: '2024-12-22',
  },
  {
    id: '3',
    title: 'Diseñar creativos navideños',
    description: 'Crear 5 variaciones de creativos para campaña de fin de año',
    status: 'review',
    priority: 'medium',
    assignee: 'Anderson',
    client: 'TechStart',
    dueDate: '2024-12-26',
    createdAt: '2024-12-18',
  },
  {
    id: '4',
    title: 'Configurar pixel en nueva landing',
    description: 'Implementar Meta Pixel y eventos de conversión',
    status: 'completed',
    priority: 'high',
    assignee: 'Stiven',
    client: 'FitZone Gym',
    dueDate: '2024-12-25',
    createdAt: '2024-12-15',
  },
  {
    id: '5',
    title: 'Auditoría de cuenta publicitaria',
    description: 'Revisar estructura de campañas y audiencias',
    status: 'todo',
    priority: 'medium',
    assignee: 'Dairo',
    client: 'Hoteles Santa Alejandría',
    dueDate: '2024-12-30',
    createdAt: '2024-12-23',
  },
  {
    id: '6',
    title: 'Preparar propuesta comercial',
    description: 'Crear propuesta de servicios para prospecto Belleza Natural',
    status: 'in_progress',
    priority: 'medium',
    assignee: 'Mariana',
    client: 'Belleza Natural',
    dueDate: '2024-12-29',
    createdAt: '2024-12-21',
  },
  {
    id: '7',
    title: 'Actualizar copy campañas Q1',
    description: 'Renovar textos publicitarios para primer trimestre 2025',
    status: 'todo',
    priority: 'low',
    assignee: 'Anderson',
    dueDate: '2025-01-05',
    createdAt: '2024-12-24',
  },
  {
    id: '8',
    title: 'Implementar A/B test',
    description: 'Configurar test de audiencias lookalike vs intereses',
    status: 'in_progress',
    priority: 'medium',
    assignee: 'Stiven',
    client: 'Equilibrio Clinic',
    dueDate: '2024-12-28',
    createdAt: '2024-12-19',
  },
  {
    id: '9',
    title: 'Revisar presupuestos enero',
    description: 'Planificar distribución de inversión para el próximo mes',
    status: 'todo',
    priority: 'high',
    assignee: 'Dairo',
    dueDate: '2024-12-31',
    createdAt: '2024-12-25',
  },
  {
    id: '10',
    title: 'Crear dashboard Looker Studio',
    description: 'Configurar dashboard automatizado para cliente',
    status: 'review',
    priority: 'medium',
    assignee: 'Stiven',
    client: 'TechStart',
    dueDate: '2024-12-27',
    createdAt: '2024-12-17',
  },
];

export const campaigns: Campaign[] = [
  {
    id: '1',
    name: 'Conversiones - Citas Online',
    client: 'Equilibrio Clinic',
    platform: 'meta',
    status: 'active',
    budget: 2500,
    spent: 1850,
    results: 145,
    cpa: 12.76,
    roas: 4.2,
    startDate: '2024-12-01',
  },
  {
    id: '2',
    name: 'Reservas Hotel - Temporada Alta',
    client: 'Hoteles Santa Alejandría',
    platform: 'meta',
    status: 'active',
    budget: 5000,
    spent: 4200,
    results: 89,
    cpa: 47.19,
    roas: 8.5,
    startDate: '2024-11-15',
  },
  {
    id: '3',
    name: 'Leads - Demo Producto',
    client: 'TechStart',
    platform: 'meta',
    status: 'active',
    budget: 1500,
    spent: 980,
    results: 42,
    cpa: 23.33,
    roas: 3.1,
    startDate: '2024-12-05',
  },
  {
    id: '4',
    name: 'Membresías Gym',
    client: 'FitZone Gym',
    platform: 'meta',
    status: 'active',
    budget: 1200,
    spent: 890,
    results: 28,
    cpa: 31.79,
    roas: 5.2,
    startDate: '2024-12-10',
  },
  {
    id: '5',
    name: 'Remarketing - Visitantes Web',
    client: 'Equilibrio Clinic',
    platform: 'meta',
    status: 'active',
    budget: 800,
    spent: 620,
    results: 35,
    cpa: 17.71,
    roas: 3.8,
    startDate: '2024-12-01',
  },
  {
    id: '6',
    name: 'Google Ads - Búsqueda Hotel',
    client: 'Hoteles Santa Alejandría',
    platform: 'google',
    status: 'active',
    budget: 3000,
    spent: 2450,
    results: 52,
    cpa: 47.12,
    roas: 9.2,
    startDate: '2024-11-01',
  },
  {
    id: '7',
    name: 'Awareness - Marca',
    client: 'TechStart',
    platform: 'meta',
    status: 'paused',
    budget: 500,
    spent: 480,
    results: 125000,
    cpa: 0,
    roas: 0,
    startDate: '2024-11-20',
  },
  {
    id: '8',
    name: 'Promoción Navidad',
    client: 'FitZone Gym',
    platform: 'meta',
    status: 'review',
    budget: 600,
    spent: 0,
    results: 0,
    cpa: 0,
    roas: 0,
    startDate: '2024-12-20',
  },
];

export const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Dairo',
    email: 'dairo@dtgrowth.com',
    role: 'admin',
    activeTasks: 3,
    status: 'available',
  },
  {
    id: '2',
    name: 'Stiven',
    email: 'stiven@dtgrowth.com',
    role: 'specialist',
    activeTasks: 2,
    status: 'busy',
  },
  {
    id: '3',
    name: 'Mariana',
    email: 'mariana@dtgrowth.com',
    role: 'manager',
    activeTasks: 2,
    status: 'available',
  },
  {
    id: '4',
    name: 'Anderson',
    email: 'anderson@dtgrowth.com',
    role: 'designer',
    activeTasks: 2,
    status: 'away',
  },
];

export const products: Product[] = [
  {
    id: '1',
    name: 'DT-OS',
    description: 'Sistema operativo centralizado para gestión de agencia',
    status: 'development',
    progress: 35,
    icon: 'Layers',
  },
  {
    id: '2',
    name: 'CobraFlow',
    description: 'Sistema de gestión de cobros y facturación',
    status: 'beta',
    progress: 75,
    users: 12,
    icon: 'CreditCard',
  },
  {
    id: '3',
    name: 'ChatSuite',
    description: 'Plataforma de automatización de WhatsApp Business',
    status: 'development',
    progress: 20,
    icon: 'MessageSquare',
  },
];

export const financeData: FinanceData[] = [
  { month: 'Jul', income: 18500, expenses: 8200, projected: 17000 },
  { month: 'Ago', income: 21000, expenses: 9100, projected: 19000 },
  { month: 'Sep', income: 19800, expenses: 8800, projected: 20000 },
  { month: 'Oct', income: 24500, expenses: 10200, projected: 22000 },
  { month: 'Nov', income: 27800, expenses: 11500, projected: 25000 },
  { month: 'Dic', income: 31200, expenses: 12800, projected: 28000 },
];

export const pendingPayments = [
  { client: 'Equilibrio Clinic', amount: 3500, dueDate: '2024-12-30' },
  { client: 'TechStart', amount: 2500, dueDate: '2025-01-05' },
  { client: 'FitZone Gym', amount: 1800, dueDate: '2025-01-10' },
];

export const notifications = [
  { id: '1', type: 'alert', message: 'Campaña "Reservas Hotel" cerca del límite de presupuesto', time: '5 min' },
  { id: '2', type: 'task', message: 'Tarea "Crear reporte mensual" vence mañana', time: '1 hora' },
  { id: '3', type: 'success', message: 'Nuevo lead generado para Equilibrio Clinic', time: '2 horas' },
  { id: '4', type: 'info', message: 'Actualización disponible para CobraFlow', time: '3 horas' },
];
