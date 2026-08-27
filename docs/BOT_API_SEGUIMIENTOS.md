# API de seguimientos del pipeline (para el bot)

Programar y reprogramar "cuándo hay que volver a hablarle a este prospecto",
lo mismo que hace el botón **Reprogramar contacto** del pipeline de DT-OS.
Lo que se agende por aquí aparece en la tarjeta del prospecto, en el correo
diario del pipeline y en el historial de actividad.

- **Base:** `https://os.dtgrowthpartners.com/api/webhook`
- **Autenticación:** header `X-API-Key: <BOT_API_KEY>` en todas las llamadas.
- Respuestas siempre JSON con `success: true|false`. En los errores, el texto de
  `error` está escrito para mostrarse tal cual en el chat.

---

## POST /bot/crm/seguimiento

Agenda (o mueve) el próximo contacto de un prospecto.

### Cuerpo

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `telefono` | string | sí* | Del prospecto. Se comparan los últimos 10 dígitos, así que `573001112233`, `3001112233` o `+57 300 111 2233` sirven igual. |
| `dealId` | string | sí* | Alternativa a `telefono`. Es el `id` que devuelve `GET /bot/crm/deals`. Más confiable si ya lo tienes. |
| `fecha` | string | sí** | `"2026-09-15"` o un ISO completo `"2026-09-15T14:30:00Z"`. |
| `en` | string | sí** | Alternativa a `fecha`, en lenguaje natural: `hoy`, `manana`, `pasado manana`, `proximo lunes` (cualquier día de la semana), `3 dias`, `2 semanas`, `1 mes`. Con tildes o sin ellas, da igual. |
| `hora` | string | no | `"14:30"`. Por defecto **9:00 de Colombia**, igual que el botón del panel. |
| `nota` | string | no | Por qué se reprograma. Queda en el historial del prospecto. |
| `usuario` | string | no | Correo o nombre de quien lo pide. Sin esto queda a nombre del bot. |
| `quitar` | boolean | no | `true` borra el seguimiento programado (equivale a "marcar contactado"). |

\* Uno de los dos: `telefono` o `dealId`.
\*\* Uno de los dos: `fecha` o `en` (salvo cuando mandas `quitar: true`).

### Ejemplos

```jsonc
// "Recuérdame escribirle en 3 días"
{ "telefono": "573041035844", "en": "3 dias",
  "nota": "quedó de revisar la propuesta",
  "usuario": "annie@dtgrowthpartners.com" }

// Por día de la semana
{ "telefono": "573041035844", "en": "proximo lunes" }

// Fecha y hora exactas
{ "dealId": "cmtax738o0029w09agasod0df", "fecha": "2026-09-15", "hora": "14:30" }

// Ya lo contacté, quitar el recordatorio
{ "telefono": "573041035844", "quitar": true }
```

### Respuesta correcta

```json
{
  "success": true,
  "mensaje": "Listo: seguimiento de Hernando Julio para el martes, 15 de septiembre de 2026, 9:00 a. m.",
  "lead": { "id": "cmtax...", "nombre": "Hernando Julio",
            "etapa": "Reunión Agendada", "responsable": "Annie" },
  "proximoSeguimiento": "2026-09-15T14:00:00.000Z"
}
```

`mensaje` ya viene redactado para responder en el chat.
`proximoSeguimiento` viene en UTC: Colombia es UTC-5, por eso las 9:00 locales
se ven como `14:00Z`.

**Días de la semana:** `proximo viernes` es *el siguiente viernes que llegue*.
Si hoy es jueves, eso es mañana. Solo cuando hoy ya es viernes salta al de la
semana entrante. Si el prospecto pide algo distinto, confirma con `fecha` exacta.

### Errores

| Código | `error` | Qué hacer |
|---|---|---|
| 400 | `Manda "dealId" o "telefono" (con al menos 7 dígitos)` | Faltó identificar al prospecto. |
| 400 | `No entendí la fecha...` | Usa `fecha` o una de las formas de `en`. El error trae los ejemplos válidos. |
| 400 | `Esa fecha ya pasó` | Pide una fecha futura. |
| 401 | `API key inválida o faltante` | Revisa el header `X-API-Key`. |
| 404 | `No hay ningún prospecto en el CRM con el teléfono ...` | Ese número no tiene tarjeta. Créala con `POST /bot/crm/deals`. |

---

## Consultar antes de agendar

```
GET /bot/crm/deals?abiertos=true&telefono=573041035844
GET /bot/crm/deals?buscar=Hernando&limite=5
```

Devuelve `id`, `nombre`, `etapa`, `responsable` y `proximoSeguimiento`. Sirve
para confirmar a quién le vas a mover el seguimiento y para obtener el `dealId`.

> **Al reportar pruebas, identifica los prospectos por su `id`**, no por el
> nombre que aparezca en el chat: es lo único que coincide entre el bot y DT-OS.

---

## Qué queda registrado

Cada llamada que agenda deja una actividad en el prospecto:

> **Seguimiento programado desde WhatsApp**
> Volver a contactar el martes, 15 de septiembre de 2026, 9:00 a. m. · quedó de
> revisar la propuesta · pedido por Annie

Si mandas `usuario`, queda a nombre de esa persona. Si no, a nombre del bot.

---

## Otros endpoints del CRM que ya existen

| Endpoint | Para qué |
|---|---|
| `GET /bot/crm/deals` | Listar prospectos. Filtros: `abiertos`, `buscar`, `telefono`, `tag`, `limite`. |
| `POST /bot/crm/deals` | Crear un prospecto. Nace en "Sin Calificar". |
| `PATCH /bot/crm/deals/:id` | Cambiar etapa, valor, notas, responsable. Manda `usuario` para que quede registrado quién lo pidió. Sacar de "Sin Calificar" exige servicio, valor y responsable. |
| `POST /bot/crm/tags` | Poner o quitar etiquetas por teléfono (`agregar`, `quitar`). |
