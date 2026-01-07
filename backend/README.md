# Backend - DTOS Growth Hub

## Descripción

Backend para el sistema DTOS Growth Hub construido con Node.js, Express y TypeScript.

## Tecnologías

- **Node.js** con **Express**
- **TypeScript**
- **JWT** para autenticación
- **Prisma ORM** para base de datos
- **PostgreSQL** (recomendado)
- **bcrypt** para hashing de contraseñas

## Instalación

```bash
# Instalar dependencias
npm install

# Copiar archivo de configuración
hcp .env.example .env

# Editar .env con tus configuraciones

# Generar cliente Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate
```

## Ejecución

### Desarrollo

```bash
# Modo desarrollo
npm run dev

# El servidor se iniciará en http://localhost:3001
```

### Producción

```bash
# Compilar
npm run build

# Ejecutar
npm start
```

## Endpoints

### Autenticación

- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/refresh` - Refrescar token
- `POST /api/auth/logout` - Cerrar sesión

### Usuarios

- `GET /api/users` - Listar usuarios (Admin)
- `GET /api/users/:id` - Obtener usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario (Admin)

### Modelos

- `GET /api/models` - Listar modelos
- `POST /api/models` - Crear modelo
- `GET /api/models/:id` - Obtener modelo
- `PUT /api/models/:id` - Actualizar modelo
- `DELETE /api/models/:id` - Eliminar modelo

## Estructura

```
src/
├── config/          # Configuraciones
├── controllers/      # Controladores
├── middlewares/      # Middlewares
├── models/          # Modelos de datos
├── services/        # Servicios
├── dtos/            # Data Transfer Objects
├── routes/          # Rutas
├── app.ts           # Configuración de Express
└── server.ts        # Punto de entrada
```

## Configuración

### Variables de entorno

Crea un archivo `.env` basado en `.env.example` y configura:

- `PORT`: Puerto del servidor
- `JWT_SECRET`: Secret para JWT
- `DATABASE_URL`: URL de conexión a la base de datos
- `ALLOWED_ORIGINS`: Orígenes permitidos para CORS

## Base de datos

Se recomienda usar PostgreSQL. Configura la URL de conexión en `.env`:

```
DATABASE_URL="postgresql://username:password@localhost:5432/dtos_db?schema=public"
```

## Prisma

Para gestionar la base de datos:

```bash
# Generar cliente Prisma
npm run prisma:generate

# Crear migración
npm run prisma:migrate

# Abrir Prisma Studio
npm run prisma:studio
```

## Seguridad

- Validación de JWT en cada endpoint protegido
- Middleware de roles para verificar permisos
- Helmet para headers de seguridad
- CORS configurado para dominios específicos

## Próximos pasos

1. Configurar base de datos con Prisma
2. Implementar autenticación JWT
3. Crear sistema de roles y permisos
4. Conectar frontend con backend
5. Implementar protección de rutas en frontend
