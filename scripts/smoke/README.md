# DTOS · Smoke tests

Prueba rápida de "¿está todo vivo?" para producción (`https://os.dtgrowthpartners.com`).
Pensado para correrse **de vez en cuando** por un agente barato (Codex / Claude Haiku)
y avisar si algo se rompió: **login, chat/notificaciones, finanzas, IA, CRM, cobros**.

- ✅ Solo lee datos. No modifica nada.
  (El único POST es `/api/chat/notify` a una sala inexistente → **no envía push a nadie**.)
- ✅ Sin dependencias: usa `fetch` nativo de Node 18+.
- ✅ Exit code `0` = todo OK · `1` = algún FAIL · `2` = error fatal del propio script.

---

## Cómo correrlo

```bash
# 1. Exporta las credenciales de una cuenta de PRUEBA (no la de un admin real si se puede evitar)
export SMOKE_EMAIL="cuenta-de-prueba@dtgrowthpartners.com"
export SMOKE_PASSWORD="********"

# 2. Corre
node scripts/smoke/smoke.mjs
```

En Windows PowerShell:

```powershell
$env:SMOKE_EMAIL="cuenta-de-prueba@dtgrowthpartners.com"
$env:SMOKE_PASSWORD="********"
node scripts/smoke/smoke.mjs
```

### Flags

| Flag        | Efecto                                                        |
|-------------|--------------------------------------------------------------|
| `--json`    | Salida JSON (para parsear/automatizar en vez de leer a ojo)  |
| `--verbose` | Imprime el cuerpo de la respuesta en los fallos              |

### Variables de entorno

| Variable            | Default                              | Descripción                        |
|---------------------|--------------------------------------|------------------------------------|
| `SMOKE_BASE_URL`    | `https://os.dtgrowthpartners.com`    | Base a probar (cambiar a local si) |
| `SMOKE_EMAIL`       | —                                    | **Obligatorio**: cuenta de prueba  |
| `SMOKE_PASSWORD`    | —                                    | **Obligatorio**: contraseña        |
| `SMOKE_TIMEOUT_MS`  | `15000`                              | Timeout por request                |

> ⚠️ **Nunca** commitear credenciales. Pásalas por variables de entorno.

---

## Qué prueba cada check

| Check                                   | Qué detecta si falla                                       |
|-----------------------------------------|-----------------------------------------------------------|
| Frontend carga + bundle JS accesible    | Pantalla blanca / deploy a medias / bundle viejo (502)    |
| `firebase-messaging-sw.js` con no-cache | Regresión de "no llegan notificaciones" por caché vieja   |
| Backend `/api/health`                   | Backend caído / 502 / pm2 abajo                            |
| Ruta protegida rechaza sin token        | Middleware de auth roto (agujero de seguridad)            |
| Login con credenciales válidas          | Login roto (nadie puede entrar)                           |
| Login rechaza contraseña incorrecta     | Login acepta cualquier cosa (agujero de seguridad)        |
| `GET /api/notifications`                | El endpoint que dio 502; cadena de notificaciones         |
| `GET /api/finance/data`                 | Finanzas / conexión a Google Sheets rota                  |
| `GET /api/ai-usage` (token Claude vivo) | Credenciales de Claude vencidas en el VPS *(WARN)*        |
| `GET /api/clients`                      | Clientes / base de datos                                  |
| `GET /api/cobros`                       | Cobros & MRR                                               |
| `GET /api/crm/stages` y `/deals`        | Pipeline / CRM                                             |
| `POST /api/chat/notify`                 | Endpoint de push del chat vivo                            |

**Severidad:**
- `FAIL` → algo está roto, hay que avisar. Rompe el exit code.
- `WARN` → revisar pero no bloquea (ej. token de Claude vencido, SW sin no-cache).

---

## Instrucciones para el agente que lo corre (Codex / Haiku)

1. Corre `node scripts/smoke/smoke.mjs` (con las variables de entorno puestas).
2. Lee el resumen final:
   - **Todo PASS** → responde en una línea: `✅ Smoke OK — N checks, 0 fallos` y termina. No hagas nada más.
   - **Hay WARN pero 0 FAIL** → reporta el WARN textual y sigue siendo "OK con avisos".
   - **Hay FAIL** → **NO intentes arreglar el código tú mismo.** Reporta:
     - Qué check(s) fallaron y el mensaje exacto de cada uno.
     - Corre otra vez con `--verbose` para adjuntar el cuerpo de la respuesta.
     - Si es un `FAIL` de red generalizado (todos fallan), probablemente el sitio/VPS está caído → avísalo como incidente.
3. Sé breve. El objetivo es un semáforo, no un informe largo.

### Para automatizar (cron / CI)

```bash
node scripts/smoke/smoke.mjs --json > smoke-result.json
# exit code 1 = hubo FAIL → disparar alerta
```

El JSON trae `{ ok, summary: {pass, warn, fail}, results: [...] }`.
