# API de Webhook para Chatbot de WhatsApp

## Descripcion

Esta API permite integrar un chatbot de WhatsApp para recibir notificaciones cuando se crean tareas de **alta prioridad** en el sistema de gestion de tareas.

---

## URL Base

```
https://os.dtgrowthpartners.com
```

---

## Endpoints

### 1. Obtener Tareas de Alta Prioridad (PRINCIPAL)

El chatbot debe llamar a este endpoint periodicamente para obtener las tareas pendientes de notificar.

```
GET /api/webhook/whatsapp/tasks
```

#### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "count": 2,
  "tasks": [
    {
      "id": "abc123xyz",
      "titulo": "Revisar documento urgente",
      "descripcion": "Necesita revision antes de las 5pm",
      "prioridad": "Alta",
      "asignado": "Stiven",
      "creador": "Dairo",
      "proyecto": "DT Growth",
      "fechaLimite": "2024-01-20",
      "creadoEn": "2024-01-19T15:30:00.000Z"
    },
    {
      "id": "def456abc",
      "titulo": "Llamar a cliente importante",
      "descripcion": "",
      "prioridad": "Alta",
      "asignado": "Edgardo",
      "creador": "Stiven",
      "proyecto": "Proyecto X",
      "fechaLimite": null,
      "creadoEn": "2024-01-19T16:00:00.000Z"
    }
  ]
}
```

#### Comportamiento Importante

- **Las tareas se eliminan de la cola una vez consultadas** (para evitar enviar duplicados)
- Si `count` es `0`, no hay tareas nuevas pendientes
- El chatbot debe procesar todas las tareas del array `tasks`

#### Sin Tareas Pendientes

```json
{
  "success": true,
  "count": 0,
  "tasks": []
}
```

---

### 2. Ver Tareas Sin Consumir (Solo para Debug/Testing)

Permite ver las tareas pendientes **sin eliminarlas** de la cola.

```
GET /api/webhook/whatsapp/tasks/peek
```

La respuesta tiene el mismo formato que el endpoint principal, pero las tareas permanecen en la cola.

---

## Campos de la Tarea

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | string | Identificador unico de la tarea |
| `titulo` | string | Titulo/nombre de la tarea |
| `descripcion` | string | Descripcion detallada (puede estar vacio) |
| `prioridad` | string | Siempre sera `"Alta"` |
| `asignado` | string | Nombre de la persona asignada |
| `creador` | string | Nombre de quien creo la tarea |
| `proyecto` | string | Nombre del proyecto asociado |
| `fechaLimite` | string \| null | Fecha limite en formato `YYYY-MM-DD` o `null` |
| `creadoEn` | string | Fecha/hora de creacion en formato ISO 8601 |

---

## Logica Sugerida para el Chatbot

```
1. Configurar polling cada 1-5 minutos a:
   GET https://os.dtgrowthpartners.com/api/webhook/whatsapp/tasks

2. Si response.count > 0:
   Para cada tarea en response.tasks:
     - Formatear mensaje de WhatsApp
     - Enviar al numero/grupo destino

3. Las tareas no volveran a aparecer en consultas futuras
```

---

## Ejemplo de Mensaje de WhatsApp

```
🚨 *TAREA URGENTE*

📋 *Titulo:* Revisar documento urgente
📝 *Descripcion:* Necesita revision antes de las 5pm

👤 *Asignado a:* Stiven
✍️ *Creado por:* Dairo
📁 *Proyecto:* DT Growth
📅 *Fecha limite:* 2024-01-20

⏰ Creada: 19/01/2024 15:30
```

---

## Ejemplo con cURL

```bash
# Obtener tareas pendientes (y consumirlas)
curl -X GET "https://os.dtgrowthpartners.com/api/webhook/whatsapp/tasks"

# Ver tareas sin consumir (debug)
curl -X GET "https://os.dtgrowthpartners.com/api/webhook/whatsapp/tasks/peek"
```

---

## Ejemplo con JavaScript/Node.js

```javascript
const axios = require('axios');

async function checkHighPriorityTasks() {
  try {
    const response = await axios.get('https://os.dtgrowthpartners.com/api/webhook/whatsapp/tasks');

    if (response.data.count > 0) {
      for (const task of response.data.tasks) {
        // Formatear mensaje
        const message = `
🚨 *TAREA URGENTE*

📋 *Titulo:* ${task.titulo}
📝 *Descripcion:* ${task.descripcion || 'Sin descripcion'}

👤 *Asignado a:* ${task.asignado}
✍️ *Creado por:* ${task.creador}
📁 *Proyecto:* ${task.proyecto}
📅 *Fecha limite:* ${task.fechaLimite || 'Sin fecha'}
        `.trim();

        // Enviar a WhatsApp (implementar segun tu chatbot)
        await sendWhatsAppMessage(message);
      }
    }
  } catch (error) {
    console.error('Error consultando tareas:', error.message);
  }
}

// Ejecutar cada 2 minutos
setInterval(checkHighPriorityTasks, 2 * 60 * 1000);
```

---

## Ejemplo con Python

```python
import requests
import time

def check_high_priority_tasks():
    try:
        response = requests.get('https://os.dtgrowthpartners.com/api/webhook/whatsapp/tasks')
        data = response.json()

        if data['count'] > 0:
            for task in data['tasks']:
                message = f"""
🚨 *TAREA URGENTE*

📋 *Titulo:* {task['titulo']}
📝 *Descripcion:* {task['descripcion'] or 'Sin descripcion'}

👤 *Asignado a:* {task['asignado']}
✍️ *Creado por:* {task['creador']}
📁 *Proyecto:* {task['proyecto']}
📅 *Fecha limite:* {task['fechaLimite'] or 'Sin fecha'}
                """.strip()

                # Enviar a WhatsApp (implementar segun tu chatbot)
                send_whatsapp_message(message)

    except Exception as e:
        print(f"Error: {e}")

# Ejecutar cada 2 minutos
while True:
    check_high_priority_tasks()
    time.sleep(120)
```

---

## Notas Importantes

1. **No requiere autenticacion** - El endpoint GET es publico para facilitar la integracion del chatbot

2. **Sistema de cola** - Las tareas se almacenan en memoria y se eliminan al ser consultadas

3. **Solo tareas de alta prioridad** - Unicamente las tareas creadas con prioridad "Alta" se envian al webhook

4. **Reinicio del servidor** - Si el servidor se reinicia, las tareas pendientes en cola se pierden (ya fueron creadas en el sistema principal)

---

## Contacto

Si tienes dudas sobre la integracion, contacta al equipo de desarrollo.
