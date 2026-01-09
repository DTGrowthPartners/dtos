# Integración con task.dtgrowthpartners.com

Este documento explica cómo está configurada la integración entre **DT Growth Hub (DTOS)** y **task.dtgrowthpartners.com**.

## 🎯 Objetivo

Permitir que cada usuario de DT Growth Hub vea **sus tareas** asignadas en task.dtgrowthpartners.com, sin tener que gestionar dos sistemas de tareas separados.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│  DT Growth Hub (DTOS)                   │
│  ┌───────────────────────────────────┐  │
│  │  Frontend                         │  │
│  │  - src/pages/MisTareas.tsx       │  │
│  │  - src/lib/firebase.ts            │  │
│  │  - src/lib/externalTasksService.ts│  │
│  └─────────────┬─────────────────────┘  │
│                │ Firebase SDK            │
│                │                         │
└────────────────┼─────────────────────────┘
                 │
                 │ Consulta directa
                 │ a Firestore
                 ▼
┌─────────────────────────────────────────┐
│  Firebase (Firestore)                   │
│  task.dtgrowthpartners.com              │
│  ┌───────────────────────────────────┐  │
│  │  Collections:                     │  │
│  │  - tasks                          │  │
│  │  - projects                       │  │
│  │  - completed_tasks                │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 📦 Componentes Creados

### 1. **src/lib/firebase.ts**
Configuración de Firebase SDK usando las credenciales del proyecto.

### 2. **src/lib/externalTasksService.ts**
Servicio que encapsula las operaciones de consulta a Firebase:
- `loadUserTasksFromExternal(assigneeName)`: Carga tareas filtradas por usuario
- `loadProjectsFromExternal()`: Carga todos los proyectos
- `getTaskExternalUrl(taskId)`: Genera URL para abrir tarea en task.dtgrowthpartners.com

### 3. **src/pages/MisTareas.tsx**
Página de **solo lectura** que muestra:
- Estadísticas (Pendiente, En Progreso, Completado)
- Lista de tareas con toda su metadata
- Botón para abrir cada tarea en task.dtgrowthpartners.com

## ⚙️ Configuración

### 1. Variables de Entorno

Copia `.env.example` a `.env` y configura las credenciales de Firebase:

```bash
cp .env.example .env
```

Actualiza las siguientes variables con los valores de tu proyecto Firebase:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### 2. Obtener Credenciales de Firebase

Las credenciales de Firebase se obtienen desde la consola de Firebase:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto (task.dtgrowthpartners.com)
3. Ve a **Project Settings** (⚙️ icono)
4. En la sección **Your apps**, selecciona tu aplicación web
5. Copia las credenciales del `firebaseConfig`

### 3. Mapeo de Usuarios

⚠️ **Importante**: El nombre del usuario en DT Growth Hub debe coincidir exactamente con el campo `assignee` en Firestore.

Por ejemplo, si en Firebase las tareas tienen:
```javascript
{
  assignee: "Edgardo",
  // ...
}
```

Entonces en DT Growth Hub, el usuario debe estar identificado como **"Edgardo"**.

#### Configuración Temporal

Actualmente el nombre de usuario está hardcodeado en `MisTareas.tsx`:

```typescript
const [userName, setUserName] = useState('Edgardo'); // TODO: Get from auth context
```

#### Configuración con Autenticación

Cuando implementes el sistema de autenticación completo, actualiza para obtener el nombre del contexto:

```typescript
import { useAuth } from '@/lib/auth';

const { user } = useAuth();
const userName = user?.name; // Debe coincidir con assignee de Firebase
```

## 🔒 Seguridad

### Reglas de Firestore

Asegúrate de que las reglas de Firestore permitan lectura a las tareas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read: if true; // O agrega lógica de autenticación
      allow write: if false; // Solo escritura desde task.dtgrowthpartners.com
    }

    match /projects/{projectId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

**Nota**: Las reglas actuales permiten lectura pública. Si quieres restringir, implementa autenticación de Firebase en ambas apps.

## 🚀 Uso

### Para el Usuario Final

1. El usuario inicia sesión en **DT Growth Hub**
2. Navega a **"Mis Tareas"** en el sidebar
3. Ve todas las tareas asignadas a él en task.dtgrowthpartners.com
4. Puede:
   - Ver detalles de las tareas
   - Filtrar por estado (Pendiente, En Progreso, Completado)
   - Hacer clic en el botón **"Abrir en task.dtgrowthpartners.com"** para gestionar la tarea

### Workflow Recomendado

```
┌─────────────────────────────────────────────┐
│ 1. Usuario ve sus tareas en DT Growth Hub  │
│    (Vista de solo lectura)                  │
└─────────────┬───────────────────────────────┘
              │
              │ Si necesita editar/gestionar
              ▼
┌─────────────────────────────────────────────┐
│ 2. Hace clic en "Abrir en task..."         │
│    Se abre task.dtgrowthpartners.com       │
└─────────────┬───────────────────────────────┘
              │
              │ Gestión completa de tarea
              ▼
┌─────────────────────────────────────────────┐
│ 3. Edita tarea en task.dtgrowthpartners.com│
│    (Drag & drop, comentarios, imágenes)    │
└─────────────┬───────────────────────────────┘
              │
              │ Cambios reflejados automáticamente
              ▼
┌─────────────────────────────────────────────┐
│ 4. Cambios visibles en DT Growth Hub       │
│    (Actualización en tiempo real)          │
└─────────────────────────────────────────────┘
```

## 📊 Diferencias entre Sistemas

### DT Growth Hub - Página "Tareas" (`/tareas`)
- Sistema **interno** de tareas de DTOS
- Kanban completo con drag & drop
- Relacionado con clientes, servicios, facturación
- Imágenes y comentarios integrados
- Base de datos: **PostgreSQL (backend propio)**

### DT Growth Hub - Página "Mis Tareas" (`/mis-tareas`)
- Vista **externa** de task.dtgrowthpartners.com
- Solo lectura (consulta)
- Tareas del equipo/proyectos
- Base de datos: **Firebase Firestore**

## 🛠️ Troubleshooting

### Error: "No se pudieron cargar las tareas"

1. Verifica que las variables de entorno están correctamente configuradas
2. Revisa la consola del navegador para errores de Firebase
3. Confirma que el proyecto de Firebase está activo
4. Verifica las reglas de Firestore permiten lectura

### Las tareas no aparecen

1. Verifica que el `userName` coincide con el `assignee` en Firestore
2. Revisa la consola de Firebase para ver si hay datos
3. Confirma que el usuario tiene tareas asignadas

### Errores de CORS

Si ves errores de CORS:
1. Agrega tu dominio a la lista de dominios autorizados en Firebase Console
2. Ve a **Authentication** > **Settings** > **Authorized domains**

## 📝 Próximos Pasos

### Mejoras Recomendadas

1. **Autenticación Unificada**
   - Usar Firebase Auth en ambas aplicaciones
   - Compartir tokens de autenticación

2. **Actualizaciones en Tiempo Real**
   - Implementar `onSnapshot` de Firestore para updates en vivo
   - Mostrar notificaciones cuando cambia una tarea

3. **Filtros Avanzados**
   - Filtrar por proyecto
   - Filtrar por prioridad
   - Filtrar por fecha de vencimiento

4. **Sincronización Bidireccional** (Opcional)
   - Permitir marcar tareas como completadas desde DTOS
   - Agregar comentarios rápidos desde DTOS

## 🤝 Soporte

Para dudas o problemas con la integración, contactar al equipo de desarrollo.

---

**Última actualización**: 2026-01-05
