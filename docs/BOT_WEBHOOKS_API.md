# DT-OS — API de Webhooks para Bots

Guía para conectar un bot (WhatsApp, Telegram, agente IA, etc.) a la API de DT-OS.
Todos los endpoints viven bajo el prefijo `/api/webhook` y están protegidos con una API key.

---

## 1. Configuración base

| Concepto | Valor |
|---|---|
| **Base URL (producción)** | `https://os.dtgrowthpartners.com/api/webhook` |
| **Autenticación** | Header `x-api-key: <BOT_API_KEY>` &nbsp;**o**&nbsp; query `?apiKey=<BOT_API_KEY>` |
| **API Key actual** | `dt-bot-secret-key-2024` |
| **Content-Type** (POST/PATCH) | `application/json` |

> ⚠️ **Seguridad:** la API key es secreta. No la publiques en repos públicos ni en el frontend.
> Para cambiarla, define `BOT_API_KEY` en `/home/ubuntu/dtos/backend/.env` y reinicia `pm2 restart dtos-backend`.

### Respuesta de error de autenticación
```json
{ "success": false, "error": "API key inválida o faltante" }   // HTTP 401
```

### Formato general de respuestas
- Éxito: siempre incluye `"success": true`.
- Error de validación: `"success": false` + `"error": "<mensaje>"` (HTTP 400).
- Error interno: `"success": false` + `"error"` + a veces `"details"` (HTTP 500).

### Convenciones útiles
- **Fechas**: formato `YYYY-MM-DD` (ej. `2026-05-13`).
- **Alias bilingües**: casi todos los campos aceptan nombre en español o inglés
  (`titulo`/`title`, `descripcion`/`description`, `importe`/`monto`/`amount`, etc.).
- **Montos**: números sin separadores de miles (`500000`, no `"500.000"`).

---

## 2. Índice de endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/bot/team` | Miembros del equipo válidos |
| GET | `/bot/projects` | Proyectos activos (Firestore) |
| POST | `/bot/tasks` | Crear tarea |
| GET | `/bot/tasks?usuario=` | Tareas de un usuario |
| GET | `/bot/tasks/all` | Tareas pendientes de todo el equipo |
| PATCH | `/bot/tasks/:id` | Actualizar tarea |
| GET | `/bot/clients` | Lista de clientes |
| GET | `/bot/clients/:id` | Detalle de un cliente |
| GET | `/bot/services` | Servicios contratados |
| GET | `/bot/finances?mes=` | Resumen financiero del mes |
| GET | `/bot/client-goals` | Metas de clientes |
| GET | `/bot/campaigns` | Campañas activas |
| GET | `/bot/crm` | Resumen del CRM |
| GET | `/bot/crm/deals` | Lista de oportunidades (deals) |
| POST | `/bot/crm/deals` | Crear deal |
| PATCH | `/bot/crm/deals/:id` | Actualizar deal |
| GET | `/bot/terceros` | Terceros (DB) |
| POST | `/bot/terceros` | Crear tercero |
| PATCH | `/bot/terceros/:id` | Actualizar tercero |
| GET | `/bot/sheets/terceros` | Terceros (Google Sheets) |
| GET | `/bot/sheets/nomina` | Registros de nómina |
| GET | `/bot/sheets/transacciones?tipo=` | Listar movimientos financieros |
| PATCH | `/bot/sheets/transacciones` | Editar un movimiento |
| POST | `/bot/sheets/gastos` | Registrar gasto |
| POST | `/bot/sheets/ingresos` | Registrar ingreso |
| GET | `/bot/sheets/personal-dairo` | Movimientos personales de Dairo |
| POST | `/bot/invoices/generate` | Generar cuenta de cobro (PDF) |
| GET | `/bot/invoices` | Listar cuentas de cobro |
| GET | `/bot/invoices/:id/download` | Descargar PDF de cuenta de cobro |
| GET | `/bot/briefs` | Lista de briefs |
| GET | `/bot/briefs/:id` | Detalle de un brief |
| GET | `/bot/briefs/:id/markdown` | Brief en formato markdown |

---

## 3. Tareas (Firestore)

### `GET /bot/team`
Devuelve los nombres válidos para asignar/crear tareas.
```json
{ "success": true, "members": ["Lía","Dairo","Stiven","Mariana","Jose","Anderson","Edgardo","Jhonathan","Kimi AI"] }
```

### `GET /bot/projects`
```json
{ "success": true, "count": 5, "projects": [{ "id": "...", "name": "Tennis Cartagena", "color": "#..." }] }
```

### `POST /bot/tasks`
Crea una tarea. Campo requerido: **`titulo`**.

| Campo | Alias | Default | Notas |
|---|---|---|---|
| `titulo` | `title` | — | **requerido** |
| `descripcion` | `description` | `""` | |
| `asignado` | `assignee` | `Stiven` | debe ser un miembro válido |
| `creador` | `creator` | `Dairo` | |
| `proyecto` | `project` / `projectId` | — | busca por nombre o ID |
| `prioridad` | `priority` | `media` | `baja` \| `media` \| `alta` |
| `fechaFin` | `dueDate` | — | `YYYY-MM-DD` |
| `tipo` | `type` | — | ej. `Diseño` |

```bash
curl -X POST -H "x-api-key: dt-bot-secret-key-2024" -H "Content-Type: application/json" \
  -d '{"titulo":"Actualizar home","asignado":"Edgardo","proyecto":"Tennis Cartagena","prioridad":"alta","fechaFin":"2026-05-20"}' \
  https://os.dtgrowthpartners.com/api/webhook/bot/tasks
```

### `GET /bot/tasks?usuario=<nombre>&estado=<estado>`
- `usuario` (**requerido**): miembro del equipo.
- `estado` (opcional): `pending`/`todo`, `in_progress`, `done`/`completed`.
```json
{ "success": true, "user": "Edgardo", "count": 3, "tasks": [
  { "id":"...", "titulo":"...", "estado":"TODO", "prioridad":"alta", "proyecto":"...", "fechaLimite":"2026-05-20", "creadoEn":"2026-05-13T..." }
]}
```

### `GET /bot/tasks/all`
Tareas `TODO` e `IN_PROGRESS` de todo el equipo, agrupadas por usuario. Útil para reportes diarios.

### `PATCH /bot/tasks/:id`
Actualiza campos de una tarea (estado, prioridad, asignado, etc.). Acepta los mismos alias que el POST.
Para cambiar estado usa `estado`/`status`: `todo` | `in_progress` | `done`.

---

## 4. Clientes y servicios

### `GET /bot/clients`
Lista de clientes con su info básica.

### `GET /bot/clients/:id`
Detalle de un cliente (servicios, cuentas, etc.).

### `GET /bot/services`
Servicios contratados por los clientes.

---

## 5. Finanzas (Google Sheets)

### `GET /bot/finances?mes=<mes>`
Resumen financiero del mes (presupuesto vs real, top gastos/ingresos, cuentas por cobrar/pagar, próximos vencimientos).
- `mes` (opcional): `enero`/`1`, `febrero`/`2`, `marzo`/`3`. Default: mes actual.
- Los datos son **en tiempo real** desde Google Sheets.

### `GET /bot/sheets/transacciones?tipo=<tipo>`
Lista movimientos. `tipo`: `entrada` | `salida` | `all` (default `all`).
```json
{ "success": true, "count": 120, "transacciones": [
  { "tipo":"entrada", "fecha":"2026-05-02", "importe":500000, "descripcion":"...", "categoria":"PAGO DE CLIENTE", "cuenta":"Bancolombia", "rowIndex": 7 }
]}
```

### `POST /bot/sheets/gastos`
Registra un gasto en la hoja **Salidas** (se inserta en la fila 2, arriba).

| Campo | Alias | Requerido | Notas |
|---|---|---|---|
| `fecha` | `date` | ✅ | `YYYY-MM-DD` |
| `importe` | `monto`/`amount` | ✅ | número |
| `categoria` | `category` | ✅ | ej. `Almuerzos`, `Nómina (Dairo)`, `Publicidad` |
| `entidad` / `tercero` | `entity`/`terceroId` | ✅ | beneficiario (nunca usar "DT Growth Partners" como genérico) |
| `descripcion` | `description` | ✅ | ej. `"Merienda Edgardo"` |
| `cuenta` | `account` | — | default `Principal` |

```bash
curl -X POST -H "x-api-key: dt-bot-secret-key-2024" -H "Content-Type: application/json" \
  -d '{"fecha":"2026-05-13","importe":80000,"categoria":"Almuerzos","entidad":"Edgardo","descripcion":"Almuerzo equipo","cuenta":"Bancolombia"}' \
  https://os.dtgrowthpartners.com/api/webhook/bot/sheets/gastos
```

### `POST /bot/sheets/ingresos`
Registra un ingreso en la hoja **Entradas** (fila 2).

| Campo | Alias | Requerido | Notas |
|---|---|---|---|
| `fecha` | `date` | ✅ | `YYYY-MM-DD` |
| `importe` | `monto`/`amount` | ✅ | número |
| `descripcion` | `description` | — | |
| `categoria` | `category` | — | default `PAGO DE CLIENTE` |
| `cuenta` | `account` | — | default `Principal` |
| `entidad` | `entity` | — | cliente que paga |
| `tercero` | `terceroId` | — | |
| `noCuentaCobro` | `numeroCuentaCobro`/`invoiceNumber` | — | nº de cuenta de cobro (col I) |
| `clasificacionIngreso` | `clasificacion` | — | ej. `Ingreso Operacional` |
| `tipoTransaccion` | `tipoIngreso` | — | `Pago Total` \| `Abono` |

```bash
curl -X POST -H "x-api-key: dt-bot-secret-key-2024" -H "Content-Type: application/json" \
  -d '{"fecha":"2026-05-13","importe":500000,"categoria":"PAGO DE CLIENTE","cuenta":"Bancolombia","entidad":"Tennis Cartagena","noCuentaCobro":"20260513120000","tipoTransaccion":"Abono"}' \
  https://os.dtgrowthpartners.com/api/webhook/bot/sheets/ingresos
```

### `PATCH /bot/sheets/transacciones`
Edita un movimiento existente. Hay que localizarlo por fecha + importe (o usar `rowIndex` de `GET /bot/sheets/transacciones`).

### `GET /bot/sheets/nomina`
Registros de nómina desde Google Sheets.

---

## 6. Personal Dairo (gastos personales, hoja separada)

La hoja **Personal Dairo** registra los gastos/ingresos personales de Dairo, **separados de las finanzas de la empresa**. No entran en los reportes de gastos de DT Growth Partners.

Para escribir ahí, usa los mismos endpoints `POST /bot/sheets/gastos` o `/ingresos`, pero marca que es personal de alguna de estas formas:
- `entidad` = `"Dairo"` (o `"Personal Dairo"` / `"Personal"`), **o**
- `"personal": true`, **o**
- `"cuentaPersonal": true`

La hoja Personal Dairo solo usa: `fecha`, `valor` (=`importe`), `descripcion`, `categoria`, `cuenta`, y `tipo` (Entrada/Salida).

### `GET /bot/sheets/personal-dairo`
Lista las transacciones personales de Dairo.

```bash
# Gasto personal de Dairo
curl -X POST -H "x-api-key: dt-bot-secret-key-2024" -H "Content-Type: application/json" \
  -d '{"fecha":"2026-05-13","importe":50000,"categoria":"Restaurante Personal","descripcion":"Cena","cuenta":"Bancolombia","personal":true}' \
  https://os.dtgrowthpartners.com/api/webhook/bot/sheets/gastos
```

---

## 7. Cuentas de cobro (facturas)

### `POST /bot/invoices/generate`
Genera el PDF de una cuenta de cobro. Requeridos: `nombre_cliente`, `identificacion`, `fecha`, `servicios[]`.

```json
{
  "nombre_cliente": "Empresa XYZ",
  "identificacion": "900123456-7",
  "fecha": "2026-05-13",
  "concepto": "Servicios de Marketing Digital",
  "servicio_proyecto": "Marketing Digital",
  "observaciones": "Pago correspondiente a mayo 2026",
  "servicios": [
    { "descripcion": "Gestión de redes sociales", "cantidad": 1, "precio_unitario": 2000000 },
    { "descripcion": "Pauta publicitaria", "cantidad": 1, "precio_unitario": 500000 }
  ],
  "cliente_id": "abc123"
}
```
Respuesta:
```json
{ "success": true, "message": "Cuenta de cobro ... generada",
  "invoice": { "id":"...", "invoiceNumber":"...", "clientName":"...", "totalAmount": 2500000 },
  "downloadUrl": "/api/invoices/<id>/download" }
```

### `GET /bot/invoices`
Lista las cuentas de cobro registradas.

### `GET /bot/invoices/:id/download`
Devuelve el PDF (binario `application/pdf`). Usa el `id` que retorna `generate` o `GET /bot/invoices`.

---

## 8. CRM

### `GET /bot/crm`
Resumen del pipeline.

### `GET /bot/crm/deals`
Lista de oportunidades.

### `POST /bot/crm/deals`
Crea un deal. Requerido: **`nombre`**.

| Campo | Alias | Default |
|---|---|---|
| `nombre` | `name` | **requerido** |
| `empresa` | `company` | — |
| `telefono` | `phone` | — |
| `email` | — | — |
| `valorEstimado` | `estimatedValue` | `0` |
| `servicio` | `service`/`serviceId` | — |
| `etapa` | `stage` | `nuevo` |
| `prioridad` | `priority` | `media` |
| `fuente` | `source` | — |
| `notas` | `notes` | — |
| `propietario` | `owner` | — |

### `PATCH /bot/crm/deals/:id`
Actualiza un deal (mover de etapa, cambiar valor, etc.). Mismos alias que el POST.

---

## 9. Terceros

### `GET /bot/terceros` — desde la base de datos (Prisma).
### `GET /bot/sheets/terceros` — desde Google Sheets.
### `POST /bot/terceros` — crear tercero (cliente/proveedor/empleado/freelancer).
### `PATCH /bot/terceros/:id` — actualizar tercero.

---

## 10. Otros

| Endpoint | Descripción |
|---|---|
| `GET /bot/client-goals` | Métricas de metas por cliente |
| `GET /bot/campaigns` | Campañas activas |
| `GET /bot/briefs` | Lista de briefs |
| `GET /bot/briefs/:id` | Detalle de un brief |
| `GET /bot/briefs/:id/markdown` | Brief en markdown (ideal para enviar a un LLM) |

---

## 11. Ejemplo mínimo en Node (fetch)

```js
const BASE = 'https://os.dtgrowthpartners.com/api/webhook';
const API_KEY = process.env.DTOS_BOT_API_KEY; // 'dt-bot-secret-key-2024'

async function dtos(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Ejemplos:
await dtos('/bot/team');
await dtos('/bot/tasks?usuario=Edgardo&estado=todo');
await dtos('/bot/sheets/gastos', { method: 'POST', body: {
  fecha: '2026-05-13', importe: 80000, categoria: 'Almuerzos',
  entidad: 'Edgardo', descripcion: 'Almuerzo equipo', cuenta: 'Bancolombia',
}});
```

---

## 12. Notas importantes

- **Datos financieros en tiempo real:** los endpoints `/bot/finances` y `/bot/sheets/*` leen directamente de Google Sheets en cada llamada. No hay caché del lado del servidor.
- **Inserción de movimientos:** gastos e ingresos se insertan siempre en la **fila 2** de su hoja (lo más reciente arriba). Si ves registros al final del Sheet, fueron escritos manualmente.
- **Categorías consistentes:** usa siempre el mismo nombre de categoría (ej. decide entre `Nómina (Dairo)` o `Nómina Dairo` y mantenlo). El sistema consolida variantes equivalentes, pero la consistencia evita confusiones.
- **Validación estricta en gastos:** `POST /bot/sheets/gastos` exige `fecha`, `importe`, `categoria`, `entidad`/`tercero` y `descripcion`. Si falta alguno responde 400 con el campo faltante.
