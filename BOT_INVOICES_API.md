# API Bot - Cuentas de Cobro

**Base URL**: `https://tu-dominio.com/api/webhook/bot`
**Auth**: Header `x-api-key: dt-bot-secret-key-2024`

---

## 1. Generar Cuenta de Cobro

```
POST /api/webhook/bot/invoices/generate
```

**Body**:
```json
{
  "nombre_cliente": "Empresa XYZ S.A.S",
  "identificacion": "900123456-7",
  "fecha": "2025-02-11",
  "concepto": "Servicios de Marketing Digital",
  "servicio_proyecto": "Marketing Digital",
  "observaciones": "Pago correspondiente a febrero 2025",
  "servicios": [
    { "descripcion": "Gestión de redes sociales", "cantidad": 1, "precio_unitario": 2000000 },
    { "descripcion": "Pauta publicitaria", "cantidad": 1, "precio_unitario": 500000 }
  ],
  "cliente_id": "abc123"
}
```

| Campo | Requerido | Descripcion |
|-------|-----------|-------------|
| `nombre_cliente` | Si | Nombre del cliente |
| `identificacion` | Si | NIT o CC del cliente |
| `fecha` | Si | Fecha de la cuenta (YYYY-MM-DD) |
| `servicios` | Si | Array con al menos 1 servicio |
| `concepto` | No | Concepto general |
| `servicio_proyecto` | No | Nombre del servicio/proyecto |
| `observaciones` | No | Notas adicionales |
| `cliente_id` | No | ID del cliente en el sistema |

**Response** (201):
```json
{
  "success": true,
  "message": "Cuenta de cobro DC-XXX generada para Empresa XYZ S.A.S",
  "invoice": {
    "id": "clxyz123...",
    "invoiceNumber": "DC-XXX",
    "clientName": "Empresa XYZ S.A.S",
    "clientNit": "900123456-7",
    "totalAmount": 2500000,
    "fecha": "2025-02-11",
    "concepto": "Servicios de Marketing Digital",
    "servicio": "Marketing Digital",
    "status": "pendiente",
    "createdAt": "2025-02-11T15:30:00.000Z"
  },
  "downloadUrl": "/api/webhook/bot/invoices/clxyz123.../download"
}
```

---

## 2. Descargar PDF

```
GET /api/webhook/bot/invoices/{id}/download
```

Retorna el archivo PDF directamente (Content-Type: application/pdf).

**Flujo para WhatsApp**:
1. Generar cuenta con POST → obtener `invoice.id`
2. Descargar PDF con GET → obtener binary del PDF
3. Enviar PDF como documento por WhatsApp

---

## 3. Listar Cuentas de Cobro

```
GET /api/webhook/bot/invoices
```

**Query params** (todos opcionales):

| Param | Valores | Default |
|-------|---------|---------|
| `status` | `pendiente`, `enviada`, `parcial`, `pagada`, `all` | `all` |
| `cliente` | texto para buscar por nombre | - |
| `limit` | numero | 20 |

**Response**:
```json
{
  "success": true,
  "count": 5,
  "totalPendiente": 8500000,
  "invoices": [
    {
      "id": "clxyz123...",
      "numero": "DC-XXX",
      "cliente": "Empresa XYZ",
      "nit": "900123456-7",
      "total": 2500000,
      "abonado": 500000,
      "saldo": 2000000,
      "estado": "parcial",
      "fecha": "2025-02-11",
      "concepto": "Marketing Digital",
      "servicio": "Marketing Digital",
      "pagos": 1,
      "downloadUrl": "/api/webhook/bot/invoices/clxyz123.../download"
    }
  ]
}
```

---

## Ejemplo cURL

```bash
# Generar cuenta
curl -X POST https://tu-dominio.com/api/webhook/bot/invoices/generate \
  -H "x-api-key: dt-bot-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_cliente": "Empresa XYZ",
    "identificacion": "900123456-7",
    "fecha": "2025-02-11",
    "concepto": "Marketing Digital",
    "observaciones": "",
    "servicios": [{"descripcion": "Gestión redes", "cantidad": 1, "precio_unitario": 2000000}]
  }'

# Descargar PDF
curl -o cuenta.pdf \
  -H "x-api-key: dt-bot-secret-key-2024" \
  https://tu-dominio.com/api/webhook/bot/invoices/{id}/download

# Listar pendientes
curl -H "x-api-key: dt-bot-secret-key-2024" \
  "https://tu-dominio.com/api/webhook/bot/invoices?status=pendiente"
```
