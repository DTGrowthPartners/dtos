# 🚀 DT Growth Hub

**Sistema integral de gestión empresarial** desarrollado para DT Growth Partners. Plataforma completa para administrar clientes, servicios, tareas, facturación y operaciones de negocio.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24-green)](https://nodejs.org/)

🌐 **Demo:** [os.dtgrowthpartners.com](https://os.dtgrowthpartners.com)

---

## 📋 Características

### 🏢 Gestión de Clientes
- CRUD completo de clientes
- Perfiles con logo, NIT, contacto
- Vistas: Grid (1, 2, 3 columnas) y Lista
- Ocultar/mostrar clientes
- Búsqueda en tiempo real

### 💼 Gestión de Servicios
- Catálogo de servicios con precios
- Múltiples monedas (USD, COP)
- Iconos personalizados
- Estados activo/inactivo
- Descripción y duración

### ✅ Sistema de Tareas
- Tablero Kanban
- Estados: Pendiente, En progreso, Completado
- Prioridades: Alta, Media, Baja
- Colores personalizados
- Asignación de usuarios
- Fechas de vencimiento
- Integración con tareas externas (Firebase)

### 💰 Cuentas de Cobro
- Generación automática de PDFs
- Plantilla profesional personalizable
- Múltiples servicios por factura
- Cálculo automático de totales
- Numeración automática
- Descarga directa

### 🔐 Autenticación
- Firebase Authentication
- Registro con email/password
- Login persistente
- Protección de rutas
- JWT tokens para API

### 📊 Dashboard
- Métricas en tiempo real
- Clientes activos
- Servicios disponibles
- Tareas pendientes
- Facturas recientes

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite 5
- **UI:** shadcn/ui + Tailwind CSS
- **Routing:** React Router v6
- **State:** Zustand + React Query
- **Auth:** Firebase Authentication
- **Forms:** React Hook Form

### Backend
- **Runtime:** Node.js 24
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL 16
- **ORM:** Prisma 5
- **Auth:** Firebase Admin SDK + JWT
- **PDF Generation:** Python 3.12 + ReportLab

### Infraestructura
- **Web Server:** Nginx
- **SSL:** Let's Encrypt (Certbot)
- **Process Manager:** PM2
- **Hosting:** VPS Ubuntu 24.04
- **Domain:** os.dtgrowthpartners.com

---

## 🚀 Instalación y Configuración

### Prerequisitos

- Node.js 24+
- PostgreSQL 16+
- Python 3.12+ (para generación de PDFs)
- npm o bun

### 1. Clonar el repositorio

```bash
git clone https://github.com/DTGrowthPartners/dtos.git
cd dtos
```

### 2. Configurar Frontend

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales de Firebase
nano .env
```

**Variables de entorno del frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

```bash
# Iniciar desarrollo
npm run dev
```

### 3. Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env
nano .env
```

**Variables de entorno del backend (.env):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dtosdb
JWT_SECRET=your-super-secret-jwt-key
PORT=3001
NODE_ENV=development
```

```bash
# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate deploy

# Seed inicial (opcional)
npx prisma db seed

# Iniciar servidor
npm run dev
```

### 4. Instalar dependencias Python (PDFs)

```bash
pip3 install reportlab Pillow
```

### 5. Configurar Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilitar Authentication > Email/Password
3. Descargar credenciales para:
   - **Frontend:** Configuración web en Project Settings
   - **Backend:** Service Account JSON en Project Settings > Service Accounts

Colocar el service account JSON en:
```
backend/firebase-service-account.json
```

---

## 📦 Scripts Disponibles

### Frontend
```bash
npm run dev          # Desarrollo con hot reload
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # Linter
```

### Backend
```bash
npm run dev              # Desarrollo con ts-node
npm run build            # Compilar TypeScript + copiar assets
npm start                # Producción
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Crear migración
npm run prisma:studio    # UI para base de datos
npm run prisma:seed      # Poblar datos iniciales
```

---

## 🏗️ Estructura del Proyecto

```
dtos/
├── src/                          # Frontend source
│   ├── components/               # Componentes React
│   │   ├── layout/              # Layout components
│   │   ├── ui/                  # shadcn/ui components
│   │   └── external-tasks/      # Task integrations
│   ├── pages/                   # Páginas/Rutas
│   ├── lib/                     # Utilities
│   │   ├── api.ts              # API client
│   │   ├── auth.ts             # Auth service
│   │   └── firebase.ts         # Firebase config
│   ├── hooks/                   # Custom hooks
│   ├── styles/                  # CSS adicionales
│   └── utils/                   # Helpers
│
├── backend/                      # Backend source
│   ├── src/
│   │   ├── controllers/         # Route controllers
│   │   ├── services/            # Business logic
│   │   │   ├── generador.py    # PDF generator
│   │   │   ├── creadas/        # Generated PDFs
│   │   │   └── fuentes/        # Custom fonts
│   │   ├── routes/              # API routes
│   │   ├── middlewares/         # Express middlewares
│   │   ├── dtos/                # Data Transfer Objects
│   │   └── config/              # Configuration
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   ├── migrations/          # DB migrations
│   │   └── seed.ts              # Seed data
│   └── dist/                    # Compiled output
│
├── public/                       # Static assets
└── docs/                         # Documentation
```

---

## 🗄️ Base de Datos

### Modelos principales

```prisma
model User {
  id         String   @id @default(cuid())
  email      String   @unique
  firstName  String
  lastName   String
  firebaseUid String? @unique
  roleId     String?
  createdAt  DateTime @default(now())
}

model Client {
  id        String   @id @default(cuid())
  name      String
  email     String
  nit       String?
  phone     String?
  address   String?
  logo      String   @default("/placeholder.svg")
  status    String   @default("active")
  createdAt DateTime @default(now())
}

model Service {
  id          String   @id @default(cuid())
  name        String
  description String?
  price       Float    @default(0)
  currency    String   @default("USD")
  icon        String   @default("Briefcase")
  status      String   @default("active")
  createdAt   DateTime @default(now())
}

model Task {
  id          String    @id @default(cuid())
  title       String
  description String?
  status      String    @default("pending")
  priority    String    @default("medium")
  dueDate     DateTime?
  color       String?
  position    Int       @default(0)
  createdBy   String
  createdAt   DateTime  @default(now())
}

model Invoice {
  id            String   @id @default(cuid())
  invoiceNumber String   @unique
  clientName    String
  clientNit     String
  totalAmount   Float
  fecha         String
  concepto      String?
  servicio      String?
  pdfPath       String?
  createdAt     DateTime @default(now())
}
```

---

## 🔐 Autenticación y Seguridad

### Flow de Autenticación

1. **Registro/Login:** Usuario se autentica con Firebase
2. **ID Token:** Firebase genera token JWT
3. **Backend Sync:** Token se envía al backend
4. **Validación:** Firebase Admin SDK valida el token
5. **JWT Propio:** Backend genera su propio JWT
6. **Persistencia:** Token y usuario se guardan en Zustand + localStorage

### Protección de Rutas

```typescript
// Frontend
<Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
  <Route path="/dashboard" element={<Dashboard />} />
  {/* ... más rutas protegidas */}
</Route>

// Backend
router.get('/clients', authMiddleware, clientController.getAll);
```

### Permisos

Sistema de roles configurado en Prisma con:
- **Admin:** Acceso total
- **User:** Acceso limitado

---

## 🎨 Personalización

### Tema y Colores

Editar `src/index.css`:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  /* ... más variables */
}
```

### Agregar nueva página

1. Crear componente en `src/pages/NuevaPagina.tsx`
2. Agregar ruta en `src/App.tsx`:
```typescript
<Route path="/nueva-pagina" element={<NuevaPagina />} />
```
3. Agregar en sidebar `src/components/layout/AppSidebar.tsx`

---

## 🚀 Deployment

### Producción (VPS)

```bash
# Frontend
npm run build
# Archivos generados en dist/

# Backend
cd backend
npm run build
# Archivos compilados en dist/

# Copiar al servidor
scp -r dist/ user@server:/path/to/app/

# En el servidor
pm2 start dist/server.js --name dtos-backend
pm2 save
pm2 startup
```

### Nginx Config

```nginx
server {
    listen 80;
    server_name os.dtgrowthpartners.com;

    root /path/to/app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL con Certbot

```bash
sudo certbot --nginx -d os.dtgrowthpartners.com
```

---

## 📝 API Endpoints

### Autenticación
```
POST /api/auth/firebase-register  # Registro
POST /api/auth/firebase-login     # Login
```

### Clientes
```
GET    /api/clients          # Listar
POST   /api/clients          # Crear
GET    /api/clients/:id      # Obtener uno
PUT    /api/clients/:id      # Actualizar
DELETE /api/clients/:id      # Eliminar
```

### Servicios
```
GET    /api/services         # Listar
POST   /api/services         # Crear
PUT    /api/services/:id     # Actualizar
DELETE /api/services/:id     # Eliminar
```

### Tareas
```
GET    /api/tasks            # Listar
POST   /api/tasks            # Crear
PUT    /api/tasks/:id        # Actualizar
DELETE /api/tasks/:id        # Eliminar
```

### Facturas
```
POST   /api/invoices/generate    # Generar PDF
GET    /api/invoices             # Listar
GET    /api/invoices/:id         # Obtener
DELETE /api/invoices/:id         # Eliminar
```

---

## 🧪 Testing

```bash
# Frontend
npm run test

# Backend
cd backend
npm run test
```

---

## 🐛 Troubleshooting

### Backend no inicia
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Ver logs
pm2 logs dtos-backend

# Regenerar Prisma
npx prisma generate
```

### PDFs no se generan
```bash
# Verificar Python
python3 --version

# Instalar dependencias
pip3 install reportlab Pillow

# Verificar permisos
chmod +x backend/src/services/generador.py
```

### Firebase Auth falla
1. Verificar dominio en Firebase Console > Authentication > Settings > Authorized domains
2. Verificar credenciales en `.env`
3. Verificar service account JSON en backend

---

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add: Amazing Feature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles

---

## 👥 Equipo

**DT Growth Partners**
- 🌐 [dtgrowthpartners.com](https://dtgrowthpartners.com)
- 📧 info@dtgrowthpartners.com

---

## 🙏 Agradecimientos

- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Lucide](https://lucide.dev/) - Icons
- [Prisma](https://www.prisma.io/) - ORM
- [Firebase](https://firebase.google.com/) - Authentication

---

## 📊 Estado del Proyecto

- ✅ **MVP Completado**
- ✅ **En Producción**
- 🔄 **Mejoras Continuas**

**Última actualización:** Enero 2026
