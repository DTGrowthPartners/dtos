import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Crear roles
  const adminRole = await prisma.role.upsert({
    where: { id: 'admin' },
    update: {},
    create: {
      id: 'admin',
      name: 'admin',
      description: 'Administrador del sistema',
      permissions: ['create:user', 'read:user', 'update:user', 'delete:user', 'create:model', 'read:model', 'update:model', 'delete:model'],
    },
  });

  const userRole = await prisma.role.upsert({
    where: { id: 'user' },
    update: {},
    create: {
      id: 'user',
      name: 'user',
      description: 'Usuario estándar',
      permissions: ['read:model', 'create:model', 'update:model'],
    },
  });

  // Roles adicionales
  const devRole = await prisma.role.upsert({
    where: { id: 'dev' },
    update: {},
    create: {
      id: 'dev',
      name: 'dev',
      description: 'Desarrollador',
      permissions: ['read:model', 'create:model', 'update:model'],
    },
  });

  const contadorRole = await prisma.role.upsert({
    where: { id: 'contador' },
    update: {},
    create: {
      id: 'contador',
      name: 'contador',
      description: 'Contador',
      permissions: ['read:model', 'create:model'],
    },
  });

  const comercialRole = await prisma.role.upsert({
    where: { id: 'comercial' },
    update: {},
    create: {
      id: 'comercial',
      name: 'comercial',
      description: 'Comercial/Ventas',
      permissions: ['read:model', 'create:model', 'update:model'],
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { id: 'manager' },
    update: {},
    create: {
      id: 'manager',
      name: 'manager',
      description: 'Manager/Gerente',
      permissions: ['read:model', 'create:model', 'update:model', 'delete:model'],
    },
  });

  const designerRole = await prisma.role.upsert({
    where: { id: 'designer' },
    update: {},
    create: {
      id: 'designer',
      name: 'designer',
      description: 'Diseñador',
      permissions: ['read:model', 'create:model', 'update:model'],
    },
  });

  const soporteRole = await prisma.role.upsert({
    where: { id: 'soporte' },
    update: {},
    create: {
      id: 'soporte',
      name: 'soporte',
      description: 'Soporte técnico',
      permissions: ['read:model', 'create:model', 'update:model'],
    },
  });

  const marketingRole = await prisma.role.upsert({
    where: { id: 'marketing' },
    update: {},
    create: {
      id: 'marketing',
      name: 'marketing',
      description: 'Marketing',
      permissions: ['read:model', 'create:model', 'update:model'],
    },
  });

  const specialistRole = await prisma.role.upsert({
    where: { id: 'specialist' },
    update: {},
    create: {
      id: 'specialist',
      name: 'specialist',
      description: 'Especialista',
      permissions: ['read:model', 'create:model', 'update:model'],
    },
  });

  // Crear usuario admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dtos.com' },
    update: {},
    create: {
      email: 'admin@dtos.com',
      password: await bcrypt.hash('admin123', 10),
      firstName: 'Admin',
      lastName: 'DTOS',
      roleId: adminRole.id,
    },
  });

  // Crear usuario dairo
  const dairoUser = await prisma.user.upsert({
    where: { email: 'dairo@dtos.com' },
    update: {},
    create: {
      email: 'dairo@dtos.com',
      password: await bcrypt.hash('demodtgrowth', 10),
      firstName: 'Dairo',
      lastName: 'Usuario',
      roleId: userRole.id,
    },
  });

  // Crear 6 tareas de prueba para el usuario admin
  const tasks = [
    {
      title: 'Diseñar nueva landing page',
      description: 'Crear diseños mockups para la nueva página de inicio con enfoque en conversión',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date('2025-01-15'),
      position: 0,
      color: '#f87171',
      createdBy: adminUser.id,
    },
    {
      title: 'Implementar autenticación de dos factores',
      description: 'Añadir 2FA utilizando Google Authenticator y códigos SMS',
      status: 'pending',
      priority: 'high',
      dueDate: new Date('2025-01-20'),
      position: 1,
      color: '#ef4444',
      createdBy: adminUser.id,
    },
    {
      title: 'Actualizar documentación de API',
      description: 'Documentar nuevos endpoints y actualizar ejemplos de uso',
      status: 'pending',
      priority: 'medium',
      dueDate: new Date('2025-01-10'),
      position: 2,
      color: '#fbbf24',
      createdBy: adminUser.id,
    },
    {
      title: 'Optimizar consultas de base de datos',
      description: 'Revisar y optimizar queries lentas identificadas en el monitoring',
      status: 'in_progress',
      priority: 'medium',
      dueDate: new Date('2025-01-12'),
      position: 3,
      createdBy: adminUser.id,
    },
    {
      title: 'Configurar CI/CD pipeline',
      description: 'Implementar pipeline automático con GitHub Actions para testing y deployment',
      status: 'completed',
      priority: 'high',
      dueDate: new Date('2024-12-28'),
      position: 4,
      color: '#10b981',
      createdBy: adminUser.id,
    },
    {
      title: 'Crear componentes de UI reutilizables',
      description: 'Desarrollar biblioteca de componentes base para uso en toda la aplicación',
      status: 'completed',
      priority: 'low',
      dueDate: new Date('2024-12-25'),
      position: 5,
      color: '#93c5fd',
      createdBy: adminUser.id,
    },
  ];

  // Eliminar tareas existentes del admin para evitar duplicados
  await prisma.task.deleteMany({
    where: {
      createdBy: adminUser.id,
    },
  });

  // Crear nuevas tareas
  for (const task of tasks) {
    await prisma.task.create({
      data: task,
    });
    console.log(`Created task: ${task.title}`);
  }

  // Seed services
  const servicesData = [
    {
      name: "Meta Ads orientado a performance",
      description: "Gestión y optimización de campañas enfocadas en resultados.",
      price: 0,
      currency: "USD",
      icon: "Target",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Google Ads",
      description: "Campañas de búsqueda y performance para captar demanda.",
      price: 0,
      currency: "USD",
      icon: "Search",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Estrategia de Crecimiento (Growth)",
      description: "Plan de crecimiento basado en datos y prioridades claras.",
      price: 0,
      currency: "USD",
      icon: "TrendingUp",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Auditoría de cuentas publicitarias",
      description: "Diagnóstico y plan de mejoras accionable.",
      price: 0,
      currency: "USD",
      icon: "ClipboardCheck",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Creativos para performance",
      description: "Creativos diseñados para escalar resultados.",
      price: 0,
      currency: "USD",
      icon: "Palette",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Desarrollo Web a Medida",
      description: "Webs y plataformas con stack moderno.",
      price: 0,
      currency: "USD",
      icon: "Code",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Landing Pages de Conversión",
      description: "Landing pages enfocadas en conversión.",
      price: 0,
      currency: "USD",
      icon: "FileText",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "E-commerce en Shopify",
      description: "Tiendas optimizadas para vender.",
      price: 0,
      currency: "USD",
      icon: "ShoppingCart",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Optimización CRO",
      description: "Mejoras para aumentar conversiones.",
      price: 0,
      currency: "USD",
      icon: "BarChart3",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Tracking y Analítica",
      description: "Eventos, píxeles y medición avanzada.",
      price: 0,
      currency: "USD",
      icon: "Database",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Dashboards de métricas",
      description: "Visualización clara de KPIs.",
      price: 0,
      currency: "USD",
      icon: "BarChart",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Automatización de procesos",
      description: "Flujos para escalar operaciones.",
      price: 0,
      currency: "USD",
      icon: "Zap",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Integraciones",
      description: "Conexión entre herramientas clave.",
      price: 0,
      currency: "USD",
      icon: "Link",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Desarrollo de Chatbots para WhatsApp",
      description: "Chatbots para captación y cierre.",
      price: 0,
      currency: "USD",
      icon: "MessageCircle",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Desarrollo de Chatbots para Web",
      description: "Chatbots web orientados a conversión.",
      price: 0,
      currency: "USD",
      icon: "Globe",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Sistemas de cotización automática",
      description: "Cotiza productos o servicios en minutos.",
      price: 0,
      currency: "USD",
      icon: "Calculator",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Agendamiento automático",
      description: "Agenda citas sin fricción.",
      price: 0,
      currency: "USD",
      icon: "Calendar",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Email marketing",
      description: "Secuencias automatizadas de venta.",
      price: 0,
      currency: "USD",
      icon: "Mail",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Infraestructura y despliegue",
      description: "Hosting, dominios y performance.",
      price: 0,
      currency: "USD",
      icon: "Server",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Mantenimiento Web",
      description: "Soporte y mejoras continuas.",
      price: 0,
      currency: "USD",
      icon: "Wrench",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Consultoría estratégica",
      description: "Decisiones para escalar el negocio.",
      price: 0,
      currency: "USD",
      icon: "Briefcase",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Optimización de funnel",
      description: "Del lead a la venta.",
      price: 0,
      currency: "USD",
      icon: "Funnel",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Diseño UX/UI",
      description: "Interfaces claras y accionables.",
      price: 0,
      currency: "USD",
      icon: "Layout",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Branding funcional",
      description: "Marca pensada para vender.",
      price: 0,
      currency: "USD",
      icon: "Star",
      status: "active",
      createdBy: adminUser.id,
    },
    {
      name: "Comisión",
      description: "Porcentaje sobre inversión o resultados.",
      price: 0,
      currency: "USD",
      icon: "Percent",
      status: "active",
      createdBy: adminUser.id,
    },
  ];

  for (const service of servicesData) {
    try {
      await prisma.service.create({
        data: service,
      });
    } catch (error) {
      // Skip if already exists
      console.log(`Service ${service.name} already exists, skipping`);
    }
  }

  console.log('Seed completado');
  console.log('Roles creados: admin, user, dev, contador, comercial, manager, designer, soporte, marketing, specialist');
  console.log('Admin:', adminUser.email);
  console.log('Dairo:', dairoUser.email);
  console.log('Tareas creadas: 6');
  console.log('Servicios creados:', servicesData.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });