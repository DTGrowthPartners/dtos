# NPS DTGP — Especificación técnica

**Para:** Stiven
**De:** Dairo
**Estado:** listo para desarrollar
**Entregable adjunto:** `nps-dtgp.html` (formulario terminado, solo falta conectar backend)

---

## 1. Qué vamos a hacer

Una encuesta **trimestral** de satisfacción (NPS) que se le manda a los contactos clave de cada cliente. El objetivo no es solo tener un número — es detectar a tiempo cuando una cuenta se está enfriando y poder actuar antes de que se vaya.

Todo vive en nuestro dominio y todo queda amarrado al cliente dentro del DT-OS. Nada de Google Forms.

**Subdominio:** `feedback.dtgrowthpartners.com`

---

## 2. Cómo funciona el link

Cada contacto recibe un link único por trimestre:

```
https://feedback.dtgrowthpartners.com/r/a3f9d2k1x7
```

El token es lo único que viaja en la URL. **No** ponemos el nombre del cliente en la ruta (`/equilibrio-clinic`) porque sería adivinable y cualquiera podría entrar a responder por otra cuenta.

Cuando el contacto abre el link:
1. El front lee el token de la ruta
2. Consulta al backend si es válido
3. El backend responde con el nombre del cliente y el front lo pinta en el saludo → *"Hola, Equilibrio Clinic."*

El contacto no escribe su nombre ni su correo. Cero fricción, y nosotros sabemos exactamente quién respondió.

### Token: uno por persona, no por empresa

Importante: hay clientes con **dos contactos**. Si les mandamos el mismo token, el segundo que entre se topa con "ya respondiste".

El token es único por la combinación:

```
cliente + contacto + trimestre
```

Sugerencia: 10–12 caracteres aleatorios (alfanumérico, sin caracteres ambiguos tipo `0/O`, `1/l`). Con vencimiento a los 30 días del envío.

---

## 3. Modelo de datos

Tres tablas nuevas, todas colgando de la tabla de clientes que ya existe en el DT-OS.

### `nps_contacto`
Los contactos de cada cliente que reciben la encuesta.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | pk | |
| `cliente_id` | fk → clientes | amarre al DT-OS |
| `nombre` | string | ej. "Jenifer" |
| `cargo` | string | opcional |
| `whatsapp` | string | canal principal de envío |
| `email` | string | opcional, respaldo |
| `activo` | bool | para dar de baja sin borrar histórico |

### `nps_envio`
Un registro por cada link generado.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | pk | |
| `contacto_id` | fk → nps_contacto | |
| `cliente_id` | fk → clientes | redundante a propósito, facilita queries |
| `trimestre` | string | formato `2026-Q3` |
| `token` | string único | indexado |
| `estado` | enum | `pendiente` · `respondido` · `vencido` |
| `enviado_at` | datetime | |
| `vence_at` | datetime | enviado + 30 días |

### `nps_respuesta`

| Campo | Tipo | Nota |
|---|---|---|
| `id` | pk | |
| `envio_id` | fk → nps_envio | |
| `puntaje` | int 0–10 | obligatorio |
| `comentario` | text | opcional |
| `aspectos` | json array | ej. `["Comunicación","Reportes"]` |
| `quiere_llamada` | bool | |
| `respondido_at` | datetime | |

---

## 4. Endpoints

### `GET /api/nps/validar?t=<token>`

Se llama al cargar la página.

**Respuesta si es válido:**
```json
{ "valido": true, "cliente": "Equilibrio Clinic" }
```

**Respuesta si no:**
```json
{ "valido": false, "motivo": "respondido" }
```

Motivos posibles: `respondido`, `vencido`, `desconocido`. El front cambia el mensaje según el motivo — si ya respondió, le dice "ya tenemos tu respuesta" en vez de "enlace vencido".

### `POST /api/nps/respuesta`

**Recibe:**
```json
{
  "token": "a3f9d2k1x7",
  "puntaje": 9,
  "comentario": "Los reportes mensuales son muy claros",
  "aspectos": ["Tiempos de respuesta"],
  "quiereLlamada": false
}
```

**Debe:**
1. Validar el token otra vez (nunca confiar en el front)
2. Guardar en `nps_respuesta`
3. Marcar el `nps_envio` como `respondido`
4. Disparar alertas si aplica (ver punto 6)
5. Responder `200`

Si el token ya está respondido o vencido → `409`.

---

## 5. Generación trimestral

Un job (o un botón en el DT-OS, como prefieras) que corre al inicio de cada trimestre:

1. Toma todos los `nps_contacto` activos
2. Genera un `nps_envio` por cada uno, con token nuevo, para el trimestre actual
3. Devuelve la lista de links lista para copiar y mandar

De arranque el envío lo hacemos manual por WhatsApp — no automatices el envío todavía. Primero validemos que el flujo funciona y que la gente responde.

**Mensaje sugerido para el envío:**

> Hola [nombre], cada trimestre le preguntamos lo mismo a todos nuestros clientes para saber cómo vamos. Son 3 preguntas y menos de un minuto 👇
> [link]

---

## 6. Alertas — esta es la parte que hace útil el sistema

Cuando entra una respuesta, disparar notificación interna (Slack o el sistema de alertas del DT-OS) si:

- **Puntaje 0–6** (detractor) → alerta con prioridad alta
- **`quiere_llamada = true`** → alerta con prioridad alta
- **Diferencia de 3+ puntos entre dos contactos del mismo cliente en el mismo trimestre** → alerta media

Esa última es la más interesante: cuando dos personas de la misma empresa nos puntúan muy distinto, casi siempre significa que quien está más cerca de la operación está viendo fricción que el otro no percibe. Vale una llamada.

También: mostrar el último puntaje NPS en la ficha del cliente dentro del DT-OS, con su tendencia respecto al trimestre anterior.

---

## 7. Cómo se calcula el score

Ojo con esto, porque tenemos clientes con dos contactos y eso les daría doble peso.

**Paso 1 — promediar por cuenta.**
Si los dos gerentes de Equilibrio dan 9 y 7, la cuenta vale 8.

**Paso 2 — clasificar la cuenta** según su promedio:
- 0–6 → detractor
- 7–8 → pasivo
- 9–10 → promotor

**Paso 3 — NPS:**
```
NPS = (% cuentas promotoras) − (% cuentas detractoras)
```

Guardamos siempre las respuestas individuales, pero la métrica se calcula por cuenta.

---

## 8. Contactos por cliente

Esta es la carga inicial de `nps_contacto`.

| Cliente | Contactos |
|---|---|
| Equilibrio Clinic | Jenifer, Johana |
| Nanoplush | Antonio, Joyce |
| Importaciones CTG | Willy |
| ACBfit | Ana |
| Auto Express | Camilo |
| Sanautos | Kelly |
| Tennis Cartagena | Raiza |
| Liz Villa Narváez | Liz |
| Sociedad Joyería Caribe S.A. | Luis Eduardo |
| Chancletas.co | Angélica |
| Compu Xtreme | Andrés, Angélica |
| La Cantina | Fabio Giraldo |
| Onexpress | Jaime |

**13 cuentas · 16 contactos.**

Los apellidos y los WhatsApp los completo yo antes de la carga. Verifica que todos estos clientes existan en la tabla de clientes del DT-OS antes de crear los contactos — si alguno falta, avísame.

---

## 9. El formulario

Ya está hecho, en el archivo `nps-dtgp.html`. Es un solo archivo, sin dependencias más allá de Google Fonts.

Trae las 3 preguntas:
1. **Puntaje 0–10** (obligatorio)
2. **Pregunta abierta** — el texto cambia solo según si es detractor, pasivo o promotor
3. **Aspectos por ajustar** — fichas seleccionables (Comunicación, Resultados, Tiempos de respuesta, Reportes, Estrategia, Precio)

Más una casilla opcional de "quiero que me llamen".

Ya incluye las pantallas de éxito, de error de red y de enlace vencido/ya respondido.

**Lo único que hay que tocar en el HTML:**
- Poner `MODO_DEMO = false`
- Ajustar `ENDPOINT_VALIDAR` y `ENDPOINT_ENVIAR` si las rutas cambian

Las opciones de la pregunta 3 están en el array `aspectos` al inicio del script, por si después las queremos cambiar.

---

## 10. Checklist

- [ ] Crear subdominio `feedback.dtgrowthpartners.com` con SSL
- [ ] Crear las tres tablas
- [ ] Cargar los 16 contactos (Dairo pasa apellidos y teléfonos)
- [ ] Montar los dos endpoints
- [ ] Servir el HTML en `/r/<token>`
- [ ] Job/botón de generación trimestral
- [ ] Alertas de detractor y de solicitud de llamada
- [ ] Mostrar NPS en la ficha del cliente en DT-OS
- [ ] Prueba end-to-end con un token de prueba antes del primer envío real

---

*DT Growth Partners · Documento interno*
