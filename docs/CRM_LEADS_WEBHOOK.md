# DT-OS — Enviar leads y prospectos a Ventas (CRM) desde un bot o landing

Guía para que tu bot/landing/formulario externo envíe prospectos al pipeline de Ventas
de DT-OS (`https://os.dtgrowthpartners.com/crm`).

---

## Resumen rápido

Tienes **dos opciones** según quién origine el lead:

| Caso | Endpoint | Auth |
|---|---|---|
| Formulario web público (landing dairotraslavina.com, dtgrowth, etc.) o bot externo simple | `POST /api/crm/leads/public` | **Ninguna** |
| Bot interno con más control (etapa, prioridad, valor estimado, propietario) | `POST /api/webhook/bot/crm/deals` | Header `x-api-key` |

Para la mayoría de casos (formularios y un bot que solo agenda) **usa la primera**.

---

## Opción 1 — Lead público (recomendada)

### `POST https://os.dtgrowthpartners.com/api/crm/leads/public`

Endpoint diseñado específicamente para formularios externos. **No requiere autenticación**.

Cuando recibe el request:
1. Crea un `Tercero` marcado como prospecto.
2. Si traes `company`, busca/crea una `Organizacion` y enlaza al tercero.
3. Crea un `Deal` en la etapa **"Nuevo Prospecto"** del pipeline (probabilidad 50%, prioridad media, moneda COP).
4. El nuevo lead aparece en https://os.dtgrowthpartners.com/crm dentro de unos segundos.

### Body

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `firstName` | string | ✅ | Nombre del prospecto |
| `lastName` | string | ✅ | Apellido del prospecto |
| `email` | string | ✅ | Email (se valida formato) |
| `phone` | string | — | Teléfono (DTOS asume código `+57` por defecto) |
| `company` | string | — | Empresa. Si existe, se enlaza; si no, se crea. |
| `message` | string | — | Mensaje libre — **aquí va info de cita, interés, contexto, etc.** |
| `source` | string | — | Fuente. Default: `"web"`. Recomendado: `"landing-dairotraslavina"`, `"bot-whatsapp"`, `"meta-ads"`, etc. |
| `sourceDetail` | string | — | Detalle de la fuente. Default: `"Formulario externo"`. Ej: `"Página de servicios — sección Hire me"` |

### Respuesta exitosa (HTTP 201)

```json
{
  "success": true,
  "message": "Lead recibido correctamente",
  "data": {
    "id": "ckxx...",
    "name": "Carlos Pérez",
    "email": "carlos@empresa.co",
    "stage": "Nuevo Prospecto"
  }
}
```

### Errores

```json
{ "error": "Campos requeridos: firstName, lastName, email",
  "required": ["firstName","lastName","email"],
  "optional": ["phone","company","message","source","sourceDetail"] }
// HTTP 400

{ "error": "Email inválido" }   // HTTP 400
{ "error": "Error al procesar el lead" } // HTTP 500
```

### Ejemplo curl

```bash
curl -X POST https://os.dtgrowthpartners.com/api/crm/leads/public \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Carlos",
    "lastName": "Pérez",
    "email": "carlos@empresa.co",
    "phone": "3001234567",
    "company": "Empresa XYZ",
    "message": "Cita agendada para 2026-06-15 10:00 — Quiere demo del producto",
    "source": "bot-whatsapp",
    "sourceDetail": "Bot Maria — flujo agendamiento"
  }'
```

### Ejemplo en Node (fetch)

```js
async function enviarLead(lead) {
  const res = await fetch('https://os.dtgrowthpartners.com/api/crm/leads/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

await enviarLead({
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'carlos@empresa.co',
  phone: '3001234567',
  company: 'Empresa XYZ',
  message: 'Interesado en plan Crecimiento. Cita: 2026-06-15 10:00.',
  source: 'landing-dairotraslavina',
  sourceDetail: 'Sección "Hire me" → CTA "Agendar reunión"',
});
```

### Ejemplo de formulario HTML directo

```html
<form id="lead-form">
  <input name="firstName" placeholder="Nombre" required />
  <input name="lastName" placeholder="Apellido" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" placeholder="Teléfono" />
  <input name="company" placeholder="Empresa" />
  <textarea name="message" placeholder="¿Qué te trae por aquí?"></textarea>
  <input type="hidden" name="source" value="landing-dairotraslavina" />
  <input type="hidden" name="sourceDetail" value="Home page — form principal" />
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await fetch('https://os.dtgrowthpartners.com/api/crm/leads/public', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.ok) alert('¡Recibido! Te contactamos pronto.');
  else alert('Error: ' + (await res.json()).error);
});
</script>
```

---

## Opción 2 — Bot autenticado (más control)

### `POST https://os.dtgrowthpartners.com/api/webhook/bot/crm/deals`

Para cuando el bot quiere especificar etapa, prioridad, valor estimado, propietario, etc.
**Requiere** header `x-api-key: dt-bot-secret-key-2024` (o el que esté en `.env`).

### Body

Mismos alias bilingües que el resto de endpoints del bot (`español` / `english`):

| Campo | Alias | Requerido | Default |
|---|---|---|---|
| `nombre` | `name` | ✅ | — |
| `empresa` | `company` | — | — |
| `telefono` | `phone` | — | — |
| `email` | — | — | — |
| `valorEstimado` | `estimatedValue` | — | `0` |
| `servicio` | `service` / `serviceId` | — | — |
| `etapa` | `stage` | — | `nuevo` |
| `prioridad` | `priority` | — | `media` |
| `fuente` | `source` | — | — |
| `notas` | `notes` | — | — |
| `propietario` | `owner` | — | — |

### Ejemplo

```bash
curl -X POST https://os.dtgrowthpartners.com/api/webhook/bot/crm/deals \
  -H "x-api-key: dt-bot-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Carlos Pérez",
    "empresa": "Empresa XYZ",
    "telefono": "3001234567",
    "email": "carlos@empresa.co",
    "valorEstimado": 2500000,
    "servicio": "Marketing Digital",
    "etapa": "contactado",
    "prioridad": "alta",
    "fuente": "bot-whatsapp",
    "notas": "Cita agendada para 2026-06-15 10:00. Mostrar caso de éxito Equilibrio."
  }'
```

---

## ¿Cuál uso?

| Necesito… | Endpoint |
|---|---|
| Formulario en mi landing (dairotraslavina, dtgrowth) | **Opción 1** |
| Bot externo simple que reenvía nombre + contacto + mensaje | **Opción 1** |
| Bot interno que ya conoce el servicio, valor estimado y debe asignarlo a alguien específico | **Opción 2** |
| Mantener trazabilidad por fuente (`landing-X`, `bot-Y`, `meta-ads`) | Ambas — usa `source` |

---

## Citas / agendamientos

Hoy no hay un endpoint público específico para agendar citas como `activity` del deal.
**Workaround recomendado** mientras tanto:

1. Crea el lead con la cita en el campo `message` (Opción 1) o `notas` (Opción 2):
   ```
   "Cita confirmada: 2026-06-15 10:00 (hora Colombia).
    Canal: Google Meet.
    Tema: Demo de Marketing Digital."
   ```
2. El equipo lo ve en el CRM, abre el deal, y registra una activity tipo `meeting` desde la UI.

Si quieres que el bot lo registre **directamente** como activity sin pasar por el frontend, eso requiere un endpoint nuevo (`POST /api/webhook/bot/crm/deals/:id/activities` o similar). Avísame y lo agrego — debería tomar 10-15 minutos: solo es exponer el endpoint existente con auth de API key.

---

## Tips de operación

- **Trazabilidad**: usa siempre `source` y `sourceDetail` específicos. Te ayuda después en métricas (¿de qué landing vino el mejor cliente?).
- **Duplicados**: hoy no se hace dedup por email. Si tu bot puede enviar el mismo lead 2 veces, valida del lado del bot antes de mandar.
- **Teléfono con país**: si tu lead es de fuera de Colombia, envía el número completo con `+`. El sistema asume `+57` cuando no lo trae.
- **Notificaciones**: una vez creado, el deal aparece en el pipeline. Si quieres notificación a Slack/WhatsApp, eso lo dispara el sistema de notificaciones internas (no este endpoint).
- **Rate limiting**: no hay rate limit estricto hoy, pero no envíes >10 leads/segundo sostenidos. Si necesitas batch, dime y agrego endpoint dedicado.

---

## Verificar que llegó

Después de enviar, abre https://os.dtgrowthpartners.com/crm — el lead aparece en la columna **"Nuevo Prospecto"**. También puedes consultarlo vía API si el bot tiene API key:

```bash
curl -H "x-api-key: dt-bot-secret-key-2024" \
  "https://os.dtgrowthpartners.com/api/webhook/bot/crm/deals"
```
