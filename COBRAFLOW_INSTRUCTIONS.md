# CobraFlow - Instrucciones para Crear Version Simplificada

## Descripcion del Proyecto

CobraFlow es una version simplificada del sistema DT Growth Hub, enfocada exclusivamente en la gestion de cuentas de cobro para freelancers y pequenas empresas.

### Repositorio Base
```
https://github.com/DTGrowthPartners/dtos.git
```

## Objetivo

Crear una aplicacion independiente llamada **CobraFlow** que contenga SOLO los siguientes modulos:
1. **Clientes** - Gestion de clientes
2. **Servicios** - Catalogo de servicios ofrecidos
3. **Cuentas de Cobro** - Generacion y seguimiento de facturas/cuentas de cobro

## Stack Tecnologico (Mantener)

### Frontend
- React 18 + TypeScript
- Vite como bundler
- TailwindCSS para estilos
- shadcn/ui como libreria de componentes
- React Router para navegacion
- Zustand para estado global
- Firebase Auth para autenticacion

### Backend
- Node.js + Express + TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- JWT para autenticacion

## Pasos para Crear CobraFlow

### 1. Clonar el Repositorio Base
```bash
git clone https://github.com/DTGrowthPartners/dtos.git cobraflow
cd cobraflow
```

### 2. Archivos del Frontend a MANTENER

```
src/
├── components/
│   ├── layout/
│   │   ├── AppSidebar.tsx (MODIFICAR - solo 3 items de menu)
│   │   └── Header.tsx
│   ├── ui/ (MANTENER TODO - componentes shadcn)
│   └── clients/ (MANTENER - ClientServicesManager)
├── contexts/
│   └── SidebarContext.tsx
├── hooks/
│   └── use-toast.ts
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   ├── firebase.ts
│   └── utils.ts
├── pages/
│   ├── Clientes.tsx (MANTENER)
│   ├── Servicios.tsx (MANTENER)
│   ├── CuentasCobro.tsx (MANTENER)
│   └── Login.tsx (MANTENER)
├── App.tsx (MODIFICAR - solo rutas necesarias)
├── index.css
└── main.tsx
```

### 3. Archivos del Frontend a ELIMINAR

```
src/pages/
├── Dashboard.tsx (ELIMINAR)
├── CRM.tsx (ELIMINAR)
├── Terceros.tsx (ELIMINAR)
├── Tareas.tsx (ELIMINAR)
├── Equipo.tsx (ELIMINAR)
├── Finanzas.tsx (ELIMINAR)

src/components/
├── dashboard/ (ELIMINAR carpeta completa)

src/lib/
├── firestoreTaskService.ts (ELIMINAR)

src/types/
├── taskTypes.ts (ELIMINAR)

src/data/
├── mockData.ts (ELIMINAR o limpiar)
```

### 4. Archivos del Backend a MANTENER

```
backend/
├── prisma/
│   └── schema.prisma (MODIFICAR - solo modelos necesarios)
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── clients.controller.ts
│   │   ├── services.controller.ts
│   │   ├── invoices.controller.ts
│   │   └── clientService.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── clients.service.ts
│   │   ├── services.service.ts
│   │   ├── invoices.service.ts
│   │   └── clientService.service.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── clients.routes.ts
│   │   ├── services.routes.ts
│   │   └── invoices.routes.ts
│   ├── middlewares/
│   │   └── auth.middleware.ts
│   ├── utils/
│   │   └── jwt.ts
│   └── app.ts (MODIFICAR - solo rutas necesarias)
```

### 5. Archivos del Backend a ELIMINAR

```
backend/src/
├── controllers/
│   ├── crm.controller.ts (ELIMINAR)
│   ├── terceros.controller.ts (ELIMINAR)
│   ├── finance.controller.ts (ELIMINAR)
│   └── users.controller.ts (ELIMINAR - o simplificar)
├── services/
│   ├── crm.service.ts (ELIMINAR)
│   ├── terceros.service.ts (ELIMINAR)
│   └── finance.service.ts (ELIMINAR)
├── routes/
│   ├── crm.routes.ts (ELIMINAR)
│   ├── terceros.routes.ts (ELIMINAR)
│   ├── finance.routes.ts (ELIMINAR)
│   └── users.routes.ts (ELIMINAR - o simplificar)
```

### 6. Modificar Schema de Prisma

Mantener SOLO estos modelos en `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  password    String
  firstName   String
  lastName    String
  phone       String?
  photoUrl    String?
  companyName String?  // Nombre de la empresa del usuario
  companyLogo String?  // Logo de la empresa
  nit         String?  // NIT para las cuentas de cobro
  address     String?  // Direccion para las cuentas de cobro
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  clients     Client[]
  services    Service[]
  invoices    Invoice[]
}

model Client {
  id        String   @id @default(cuid())
  name      String
  email     String?
  phone     String?
  nit       String?
  address   String?
  logo      String?
  status    String   @default("active")
  notes     String?
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  services  ClientService[]
  invoices  Invoice[]
}

model Service {
  id          String   @id @default(cuid())
  name        String
  description String?
  price       Float
  currency    String   @default("COP")
  unit        String   @default("unidad") // hora, proyecto, mes, unidad
  isActive    Boolean  @default(true)
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  clients      ClientService[]
  invoiceItems InvoiceItem[]
}

model ClientService {
  id            String    @id @default(cuid())
  clientId      String
  serviceId     String
  client        Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)
  service       Service   @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  customPrice   Float?    // Precio personalizado para este cliente
  frequency     String    @default("mensual") // mensual, trimestral, semestral, anual, unico
  startDate     DateTime  @default(now())
  nextBillingDate DateTime?
  status        String    @default("activo") // activo, pausado, cancelado
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([clientId, serviceId])
}

model Invoice {
  id            String   @id @default(cuid())
  invoiceNumber String   @unique
  clientId      String
  client        Client   @relation(fields: [clientId], references: [id])
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  // Datos del emisor (copiados del user al momento de crear)
  issuerName    String
  issuerNit     String?
  issuerAddress String?
  issuerPhone   String?
  issuerEmail   String?
  issuerLogo    String?

  // Datos del cliente (copiados al momento de crear)
  clientName    String
  clientNit     String?
  clientAddress String?
  clientEmail   String?

  subtotal      Float
  tax           Float    @default(0)
  taxRate       Float    @default(0) // Porcentaje de IVA
  total         Float
  currency      String   @default("COP")

  status        String   @default("draft") // draft, sent, paid, overdue, cancelled
  issueDate     DateTime @default(now())
  dueDate       DateTime?
  paidDate      DateTime?
  notes         String?
  paymentMethod String?  // transferencia, efectivo, tarjeta
  bankAccount   String?  // Cuenta bancaria para pago

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  items         InvoiceItem[]
}

model InvoiceItem {
  id          String   @id @default(cuid())
  invoiceId   String
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  serviceId   String?
  service     Service? @relation(fields: [serviceId], references: [id])

  description String
  quantity    Float
  unitPrice   Float
  total       Float

  createdAt   DateTime @default(now())
}
```

### 7. Modificar AppSidebar.tsx

Cambiar los items de navegacion a solo 3:

```typescript
const navItems = [
  { title: 'Clientes', path: '/clientes', icon: Users },
  { title: 'Servicios', path: '/servicios', icon: Briefcase },
  { title: 'Cuentas de Cobro', path: '/cuentas-cobro', icon: FileText },
];
```

### 8. Modificar App.tsx

Simplificar las rutas:

```typescript
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<Navigate to="/clientes" replace />} />
    <Route path="/clientes" element={<Clientes />} />
    <Route path="/servicios" element={<Servicios />} />
    <Route path="/cuentas-cobro" element={<CuentasCobro />} />
  </Route>
</Routes>
```

### 9. Modificar app.ts del Backend

Registrar solo las rutas necesarias:

```typescript
import authRoutes from './routes/auth.routes';
import clientsRoutes from './routes/clients.routes';
import servicesRoutes from './routes/services.routes';
import invoicesRoutes from './routes/invoices.routes';

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/invoices', invoicesRoutes);
```

### 10. Cambios de Branding

1. **Nombre**: Cambiar "DT Growth Hub" por "CobraFlow" en:
   - `index.html` (title)
   - `AppSidebar.tsx` (logo/nombre)
   - Cualquier referencia en el codigo

2. **Colores** (opcional): Mantener o personalizar en `tailwind.config.js`

3. **Logo**: Crear nuevo logo para CobraFlow

### 11. Variables de Entorno

Crear nuevos archivos `.env`:

**Frontend (.env)**
```
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
```

**Backend (.env)**
```
DATABASE_URL=postgresql://...
JWT_SECRET=xxx
JWT_REFRESH_SECRET=xxx
PORT=3001
```

### 12. Funcionalidades Clave de Cuentas de Cobro

La pagina de Cuentas de Cobro debe permitir:

1. **Crear cuenta de cobro**:
   - Seleccionar cliente
   - Agregar items (servicios o descripcion libre)
   - Calcular subtotal, IVA y total
   - Generar numero consecutivo automatico

2. **Vista previa e impresion**:
   - Formato profesional para PDF
   - Datos del emisor y cliente
   - Detalle de items
   - Totales
   - Datos bancarios para pago

3. **Estados**:
   - Borrador
   - Enviada
   - Pagada
   - Vencida
   - Cancelada

4. **Filtros y busqueda**:
   - Por cliente
   - Por estado
   - Por fecha
   - Por rango de valores

### 13. Comando para Ejecutar

```bash
# Frontend
cd cobraflow
npm install
npm run dev

# Backend
cd cobraflow/backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Resumen de Archivos Finales

```
cobraflow/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── controllers/ (4 archivos)
│   │   ├── services/ (4 archivos)
│   │   ├── routes/ (4 archivos)
│   │   ├── middlewares/ (1 archivo)
│   │   ├── utils/ (1 archivo)
│   │   └── app.ts
│   └── package.json
├── src/
│   ├── components/
│   │   ├── layout/ (2 archivos)
│   │   ├── ui/ (todos los componentes shadcn)
│   │   └── clients/ (1 archivo)
│   ├── contexts/ (1 archivo)
│   ├── hooks/ (1 archivo)
│   ├── lib/ (4 archivos)
│   ├── pages/ (4 archivos: Login, Clientes, Servicios, CuentasCobro)
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

## Notas Adicionales

- El sistema debe ser multi-tenant (cada usuario ve solo sus datos)
- Mantener la autenticacion con Firebase
- El modelo User ahora incluye datos de la empresa para las cuentas de cobro
- Considerar agregar campo para datos bancarios del usuario
- La generacion de PDF puede hacerse con html2pdf.js o react-pdf
