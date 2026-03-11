# Integracion MetaSuiteApp en DTOS

Documentacion completa de endpoints y flujos para replicar toda la funcionalidad de MetaSuiteApp desde DTOS.

**Base URL**: `https://graph.facebook.com/v24.0`
**Autenticacion**: Todas las llamadas requieren `access_token` como parametro.

---

## 1. AUTENTICACION

### Login con Facebook JS SDK
```
FB.login(callback, {
  scope: 'ads_management,pages_show_list,business_management,pages_read_engagement,ads_read,whatsapp_business_management,instagram_basic,instagram_manage_insights'
});
```
El token obtenido dura ~1 hora. Para larga duracion, usar System User Token desde Meta Business Suite.

### Verificar token
```
GET /debug_token?input_token={TOKEN}&access_token={TOKEN}
```

---

## 2. CARGAR DATOS INICIALES

### 2.1 Obtener Ad Accounts
```
GET /me/adaccounts
fields: id,name,account_status,disable_reason,currency,amount_spent,business{id,name}
limit: 100
```

### 2.2 Obtener Businesses
```
GET /me/businesses
fields: id,name
limit: 100
```

### 2.3 Ad Accounts de un Business
```
GET /{business_id}/owned_ad_accounts
fields: id,name,account_status,disable_reason,currency,amount_spent
limit: 100
```
```
GET /{business_id}/client_ad_accounts
fields: id,name,account_status,disable_reason,currency,amount_spent
limit: 100
```

### 2.4 Obtener Paginas de Facebook
```
GET /me/accounts
fields: id,name,access_token,picture{url},website,instagram_business_account{id,username,profile_picture_url}
limit: 100
```

### 2.5 Obtener Cuentas de Instagram
```
GET /act_{ad_account_id}/instagram_accounts
fields: id,username,profile_picture_url
limit: 100
```
Tambien se puede obtener desde la pagina:
```
GET /{page_id}?fields=instagram_business_account{id,username,profile_picture_url}
```

### 2.6 Obtener Numeros de WhatsApp
Primero obtener el business del ad account, luego:
```
GET /{business_id}/owned_whatsapp_business_accounts
fields: id,name
limit: 100
```
Para cada WABA:
```
GET /{waba_id}/phone_numbers
fields: id,display_phone_number,verified_name,quality_rating
limit: 100
```

### 2.7 Obtener Audiencias Guardadas
```
GET /act_{ad_account_id}/saved_audiences
fields: id,name,targeting,approximate_count
limit: 100
```

### 2.8 Obtener Audiencias Personalizadas
```
GET /act_{ad_account_id}/customaudiences
fields: id,name,approximate_count,subtype
limit: 100
```

### 2.9 Obtener Media Library
Imagenes:
```
GET /act_{ad_account_id}/adimages
fields: hash,url,name,width,height,created_time
limit: 50
```
Videos:
```
GET /act_{ad_account_id}/advideos
fields: id,title,source,thumbnails,created_time,length
limit: 50
```

### 2.10 Obtener Pixels
```
GET /act_{ad_account_id}/adspixels
fields: id,name,last_fired_time
limit: 50
```

---

## 3. MONITOREO DE CUENTAS

### Valores de account_status
| Valor | Estado | Alerta |
|-------|--------|--------|
| 1 | Activa | No |
| 2 | Deshabilitada | Si |
| 3 | Sin liquidar (pago pendiente) | Si |
| 7 | Revision de riesgo pendiente | Si |
| 9 | En periodo de gracia | Si |
| 100 | Cierre pendiente | Si |
| 101 | Cerrada | Si |

### Valores de disable_reason
| Valor | Razon |
|-------|-------|
| 0 | Ninguno |
| 1 | Politica de integridad |
| 2 | Revision IP |
| 3 | Riesgo de pago |
| 4 | Cuenta gris cerrada |
| 5 | Revision AFC |
| 7 | Cierre permanente |

---

## 4. CREAR CAMPANA

### 4.1 Crear Campana
```
POST /act_{ad_account_id}/campaigns
```
| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| name | string | Si | Nombre de la campana |
| objective | string | Si | Ver tabla de objetivos |
| status | string | Si | PAUSED o ACTIVE |
| special_ad_categories | array | Si | [] si no aplica |
| daily_budget | integer | No | Presupuesto diario en centavos (CBO) |
| bid_strategy | string | No | LOWEST_COST_WITHOUT_CAP (default) |

### Objetivos validos
| Objetivo | Uso |
|----------|-----|
| OUTCOME_TRAFFIC | Trafico al sitio web o perfil IG |
| OUTCOME_ENGAGEMENT | Mensajes (WhatsApp, Messenger, IG DM) |
| OUTCOME_LEADS | Generacion de leads |
| OUTCOME_SALES | Ventas / conversiones |
| OUTCOME_AWARENESS | Reconocimiento / ThruPlay |
| OUTCOME_APP_PROMOTION | Instalacion de apps |

---

## 5. CREAR AD SET

### 5.1 Ad Set Generico
```
POST /act_{ad_account_id}/adsets
```
| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| name | string | Si | |
| campaign_id | string | Si | ID de la campana |
| daily_budget | integer | No | En centavos (si no es CBO) |
| billing_event | string | Si | IMPRESSIONS |
| optimization_goal | string | Si | Ver tabla |
| targeting | JSON string | Si | Ver estructura |
| status | string | Si | ACTIVE |
| start_time | ISO 8601 | No | |
| end_time | ISO 8601 | No | |
| is_dynamic_creative | boolean | No | true para 5+5+5 |
| promoted_object | JSON string | No | Depende del destino |
| destination_type | string | No | WEBSITE, WHATSAPP, MESSENGER, INSTAGRAM_DIRECT |
| bid_strategy | string | No | |

### Estructura de targeting
```json
{
  "geo_locations": { "countries": ["CO"] },
  "age_min": 18,
  "age_max": 65,
  "genders": [1],
  "flexible_spec": [{ "interests": [{ "id": "123", "name": "Interes" }] }],
  "custom_audiences": [{ "id": "AUDIENCE_ID" }]
}
```
NOTA: NO incluir `targeting_optimization` — Meta lo elimino (error 1870197).

### optimization_goal por objetivo
| Objetivo | optimization_goal |
|----------|-------------------|
| OUTCOME_TRAFFIC | LANDING_PAGE_VIEWS o LINK_CLICKS |
| OUTCOME_ENGAGEMENT | CONVERSATIONS |
| OUTCOME_LEADS | LEAD_GENERATION |
| OUTCOME_SALES | OFFSITE_CONVERSIONS |
| OUTCOME_AWARENESS | REACH o THRUPLAY |

### 5.2 Ad Set para WhatsApp
```
POST /act_{ad_account_id}/adsets
```
Igual que el generico pero con:
```
destination_type: WHATSAPP
promoted_object: { "page_id": "PAGE_ID", "whatsapp_phone_number": "+573001234567" }
```
**FALLBACK**: Si falla con el numero, reintentar SIN `whatsapp_phone_number` en promoted_object. El usuario lo asigna manualmente despues.

### 5.3 Ad Set para Messenger
```
destination_type: MESSENGER
promoted_object: { "page_id": "PAGE_ID" }
```

### 5.4 Ad Set para Instagram Direct
```
destination_type: INSTAGRAM_DIRECT
promoted_object: { "page_id": "PAGE_ID" }
```

---

## 6. CREAR CREATIVOS

### 6.1 Subir Imagen
```
POST /act_{ad_account_id}/adimages
```
Enviar como form-data con campo `filename` (archivo binario).
Respuesta: `{ "images": { "filename": { "hash": "IMAGE_HASH" } } }`

### 6.2 Subir Video
```
POST /act_{ad_account_id}/advideos
```
Enviar como form-data con campo `source` (archivo) o `file_url` (URL).
Respuesta: `{ "id": "VIDEO_ID" }`

### 6.3 Creativo Standard (1 texto, 1 titulo)
```
POST /act_{ad_account_id}/adcreatives
```
**Con imagen:**
```json
{
  "name": "Nombre del creativo",
  "object_story_spec": {
    "page_id": "PAGE_ID",
    "instagram_user_id": "IG_USER_ID",
    "link_data": {
      "link": "https://destino.com",
      "message": "Texto principal",
      "name": "Titulo",
      "description": "Descripcion",
      "image_hash": "HASH",
      "call_to_action": { "type": "LEARN_MORE", "value": { "link": "https://destino.com" } }
    }
  },
  "degrees_of_freedom_spec": {
    "creative_features_spec": {
      "text_optimizations": { "enroll_status": "OPT_IN" },
      "image_touchups": { "enroll_status": "OPT_IN" },
      "inline_comment": { "enroll_status": "OPT_IN" },
      "enhance_cta": { "enroll_status": "OPT_IN" }
    }
  }
}
```

**Con video:**
```json
{
  "object_story_spec": {
    "page_id": "PAGE_ID",
    "video_data": {
      "video_id": "VIDEO_ID",
      "message": "Texto principal",
      "title": "Titulo",
      "image_url": "THUMBNAIL_URL",
      "call_to_action": { "type": "LEARN_MORE", "value": { "link": "https://destino.com" } }
    }
  }
}
```

### 6.4 Creativo WhatsApp Standard
Igual que standard pero CTA:
```json
"call_to_action": { "type": "WHATSAPP_MESSAGE", "value": {} }
```
NO incluir `link` en link_data. NO incluir `enhance_cta` en degrees_of_freedom_spec.

### 6.5 Creativo Instagram DM Standard
```json
"call_to_action": {
  "type": "INSTAGRAM_MESSAGE",
  "value": { "app_destination": "INSTAGRAM_DIRECT", "link": "https://ig.me/m/{IG_USER_ID}" }
}
```
NO incluir `enhance_cta` en degrees_of_freedom_spec.

### 6.6 Creativo Messenger Standard
```json
"call_to_action": {
  "type": "MESSAGE_PAGE",
  "value": { "app_destination": "MESSENGER" }
}
```

### 6.7 Dynamic Creative 5+5+5 (asset_feed_spec)
REQUIERE: `is_dynamic_creative: true` en el Ad Set.
LIMITE: 1 ad por Ad Set cuando isDynamicCreative es true.

```
POST /act_{ad_account_id}/adcreatives
```
```json
{
  "name": "Creative 5+5+5",
  "object_story_spec": {
    "page_id": "PAGE_ID",
    "instagram_user_id": "IG_USER_ID"
  },
  "asset_feed_spec": {
    "bodies": [
      { "text": "Texto 1" },
      { "text": "Texto 2" },
      { "text": "Texto 3" },
      { "text": "Texto 4" },
      { "text": "Texto 5" }
    ],
    "titles": [
      { "text": "Titulo 1" },
      { "text": "Titulo 2" },
      { "text": "Titulo 3" },
      { "text": "Titulo 4" },
      { "text": "Titulo 5" }
    ],
    "descriptions": [
      { "text": "Desc 1" },
      { "text": "Desc 2" },
      { "text": "Desc 3" },
      { "text": "Desc 4" },
      { "text": "Desc 5" }
    ],
    "call_to_action_types": ["LEARN_MORE"],
    "link_urls": [{ "website_url": "https://destino.com" }],
    "images": [{ "hash": "IMAGE_HASH" }],
    "videos": [{ "video_id": "VIDEO_ID", "thumbnail_url": "URL" }],
    "ad_formats": ["SINGLE_IMAGE"]
  },
  "degrees_of_freedom_spec": {
    "creative_features_spec": {
      "text_optimizations": { "enroll_status": "OPT_IN" },
      "image_touchups": { "enroll_status": "OPT_IN" },
      "inline_comment": { "enroll_status": "OPT_IN" }
    }
  }
}
```

**REGLAS CRITICAS para DC 5+5+5:**
- `ad_formats`: "SINGLE_IMAGE" o "SINGLE_VIDEO" (segun el media)
- Para WhatsApp DC: `call_to_action_types: ["WHATSAPP_MESSAGE"]`, NO incluir `link_urls`
- Para IG DM DC: `link_urls: [{ "website_url": "https://ig.me/m/{IG_USER_ID}" }]`, `call_to_action_types: ["INSTAGRAM_MESSAGE"]`
- Para IG Profile DC: usar `LEARN_MORE` en vez de `VISIT_INSTAGRAM_PROFILE` (no valido en DC)
- NO incluir `enhance_cta` para WhatsApp ni IG DM

---

## 7. CREAR AD
```
POST /act_{ad_account_id}/ads
```
| Parametro | Tipo | Requerido |
|-----------|------|-----------|
| name | string | Si |
| adset_id | string | Si |
| creative | JSON | Si |
| status | string | Si |

```json
{
  "name": "Mi Ad",
  "adset_id": "AD_SET_ID",
  "creative": { "creative_id": "CREATIVE_ID" },
  "status": "ACTIVE"
}
```

---

## 8. RESTRICCIONES IMPORTANTES POR DESTINO

### WhatsApp + Dynamic Creative
| Objetivo | DC Soportado |
|----------|-------------|
| OUTCOME_TRAFFIC | Si |
| OUTCOME_LEADS | Si |
| OUTCOME_AWARENESS | Si |
| OUTCOME_SALES | NO (error 1885392) |
| OUTCOME_ENGAGEMENT | NO (error 1885392) |

Cuando DC no es soportado, usar standard creatives (1 AdSet con N Ads).

### Instagram DM + Dynamic Creative
| Objetivo | DC Soportado |
|----------|-------------|
| OUTCOME_TRAFFIC | Si |
| OUTCOME_LEADS | Si |
| OUTCOME_AWARENESS | Si |
| OUTCOME_SALES | NO |
| OUTCOME_ENGAGEMENT | NO (error: INSTAGRAM_MESSAGE no compatible) |

### CTAs por destino
| Destino | CTA Standard | CTA en DC (asset_feed_spec) |
|---------|-------------|----------------------------|
| WEBSITE | LEARN_MORE, SHOP_NOW, SIGN_UP, etc. | Igual |
| WHATSAPP | WHATSAPP_MESSAGE | WHATSAPP_MESSAGE (solo este) |
| MESSENGER | MESSAGE_PAGE | MESSAGE_PAGE |
| INSTAGRAM_DIRECT | INSTAGRAM_MESSAGE | INSTAGRAM_MESSAGE |
| INSTAGRAM_PROFILE | VISIT_INSTAGRAM_PROFILE | LEARN_MORE (VISIT_IG_PROFILE no valido en DC) |

---

## 9. PLANTILLAS DE CAMPANA

### Plantilla 1: Trafico al Sitio Web
```
objective: OUTCOME_TRAFFIC
optimization_goal: LANDING_PAGE_VIEWS
destination_type: WEBSITE
DC: Si
CTA: LEARN_MORE
```

### Plantilla 2: Ventas WhatsApp
```
objective: OUTCOME_SALES
optimization_goal: CONVERSATIONS
destination_type: WHATSAPP
DC: NO (usar standard)
promoted_object: { page_id, whatsapp_phone_number }
CTA: WHATSAPP_MESSAGE
```

### Plantilla 3: Leads WhatsApp
```
objective: OUTCOME_ENGAGEMENT
optimization_goal: CONVERSATIONS
destination_type: WHATSAPP
DC: NO (usar standard)
promoted_object: { page_id, whatsapp_phone_number }
CTA: WHATSAPP_MESSAGE
```

### Plantilla 4: Mensajes WhatsApp
```
objective: OUTCOME_ENGAGEMENT
optimization_goal: CONVERSATIONS
destination_type: WHATSAPP
DC: NO (usar standard)
promoted_object: { page_id, whatsapp_phone_number }
CTA: WHATSAPP_MESSAGE
```

### Plantilla 5: Trafico al Perfil de Instagram
```
objective: OUTCOME_TRAFFIC
optimization_goal: LANDING_PAGE_VIEWS
destination_type: INSTAGRAM_PROFILE
DC: Si
CTA standard: VISIT_INSTAGRAM_PROFILE
CTA en DC: LEARN_MORE
link_url: https://www.instagram.com/{username}/
```

### Plantilla 6: Mensajes Messenger
```
objective: OUTCOME_ENGAGEMENT
optimization_goal: CONVERSATIONS
destination_type: MESSENGER
DC: Si
promoted_object: { page_id }
CTA: MESSAGE_PAGE
```

### Plantilla 7: Mensajes Instagram
```
objective: OUTCOME_ENGAGEMENT
optimization_goal: CONVERSATIONS
destination_type: INSTAGRAM_DIRECT
DC: NO (usar standard)
promoted_object: { page_id }
CTA: INSTAGRAM_MESSAGE
link_urls (DC): https://ig.me/m/{ig_user_id}
```

### Plantilla 8: Reconocimiento ThruPlay
```
objective: OUTCOME_AWARENESS
optimization_goal: THRUPLAY
destination_type: WEBSITE
DC: Si
CTA: LEARN_MORE
```

### Plantilla 9: Ventas Sitio Web
```
objective: OUTCOME_SALES
optimization_goal: OFFSITE_CONVERSIONS
destination_type: WEBSITE
DC: Si
promoted_object: { pixel_id, custom_event_type: "PURCHASE" }
CTA: SHOP_NOW
```

---

## 10. FLUJOS DE CREACION COMPLETOS

### Flujo A: Campana Standard (1 AdSet → N Ads)
```
1. POST /act_{id}/campaigns → campaign_id
2. POST /act_{id}/adsets (sin is_dynamic_creative) → adset_id
3. Para cada ad:
   a. POST /act_{id}/adcreatives (object_story_spec con 1 texto) → creative_id
   b. POST /act_{id}/ads (adset_id + creative_id) → ad_id
```

### Flujo B: Campana Dynamic Creative (N AdSets × 1 Ad cada uno)
```
1. POST /act_{id}/campaigns → campaign_id
2. Para cada ad:
   a. POST /act_{id}/adsets (is_dynamic_creative: true) → adset_id
   b. POST /act_{id}/adcreatives (asset_feed_spec con 5+5+5) → creative_id
   c. POST /act_{id}/ads (adset_id + creative_id) → ad_id
```

### Flujo C: Campana WhatsApp (con fallback de numero)
```
1. POST /act_{id}/campaigns → campaign_id
2. POST /act_{id}/adsets con destination_type: WHATSAPP + whatsapp_phone_number
   - Si FALLA: reintentar SIN whatsapp_phone_number (asignar manual en Ads Manager)
3. Para cada ad:
   a. POST /act_{id}/adcreatives (CTA: WHATSAPP_MESSAGE, value: {})
   b. POST /act_{id}/ads
```

---

## 11. INSIGHTS Y REPORTES

### Obtener metricas de campana
```
GET /{campaign_id}/insights
fields: impressions,reach,clicks,spend,cpc,cpm,ctr,actions,cost_per_action_type
date_preset: last_7d | last_30d | maximum
```

### Obtener campanas activas
```
GET /act_{ad_account_id}/campaigns
fields: id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time
effective_status: ["ACTIVE","PAUSED"]
limit: 50
```

### Cambiar status de campana
```
POST /{campaign_id}
status: ACTIVE | PAUSED
```

---

## 12. ERRORES COMUNES Y SOLUCIONES

| Error | Codigo | Solucion |
|-------|--------|----------|
| DC no soporta objetivo | 1885392 | Usar standard creatives en vez de DC |
| targeting_optimization eliminado | 1870197 | No enviar targeting_optimization |
| asset_feed_spec sin DC | 1885998 | Asegurar is_dynamic_creative: true en AdSet |
| IG DM sin link_urls | 1885869 | Agregar link_urls con ig.me/m/{id} |
| CTA link demasiados params | — | No incluir link en value para WHATSAPP_MESSAGE |
| VISIT_INSTAGRAM_PROFILE en DC | 100 | Usar LEARN_MORE en su lugar |
| Token expirado | 190 | Renovar token |
| Rate limit | 17/80004 | Esperar y reintentar |

---

## 13. GENERACION DE CONTENIDO CON IA

MetaSuiteApp usa una API de IA (configurable via servidor proxy) para:
- Analizar videos (whisper + vision) y generar textos basados en el contenido
- Generar 5 textos primarios + 5 titulos + 5 descripciones por ad
- Adaptar el tono segun el objetivo y destino de la campana

Endpoint del servidor proxy:
```
POST {PROXY_URL}/api/generate
body: { prompt, category }
```
```
POST {PROXY_URL}/api/analyze-video
body: FormData con archivo de video
```
```
POST {PROXY_URL}/api/analyze-media-url
body: { url, type, prompt }
```

---

## 14. RESUMEN DE STATUS

- **Campanas**: Se crean en PAUSED (el usuario activa manualmente)
- **Ad Sets**: Se crean en ACTIVE
- **Ads**: Se crean en ACTIVE
- La campana no gasta hasta que se active manualmente
