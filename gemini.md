Actúa como Senior UI Engineer + Product Designer especializado en dashboards internos B2B (herramientas de trabajo diario), no como diseñador de landing pages.

La vista “Mis Tareas” está visualmente rota.
El problema NO es funcional, es 100% de diseño y proporción.

CONTEXTO REAL

Esta es una herramienta interna (DT-OS) usada todos los días por un equipo de growth.
Debe priorizar:

Densidad de información

Lectura rápida

Uso eficiente del espacio

No es una app consumer, no es marketing, no es hero layout.

PROBLEMAS ACTUALES (CLAROS)

Todo se ve demasiado grande

Hay mucho espacio vacío

Las tarjetas:

Son muy anchas

Parecen “flotando” sin contenedor

No tienen ritmo vertical claro

El fondo oscuro:

Se come el contenido

Tiene demasiado protagonismo

La vista se siente:

Poco eficiente

Poco profesional

Cansada visualmente

OBJETIVO FINAL (NO INTERPRETES)

Convertir esta vista en un dashboard compacto, sobrio y productivo, similar a:

Linear (dense mode)

GitHub Issues / Projects

Jira compacto

REGLAS ABSOLUTAS (CRÍTICAS)

❌ NO cambiar HTML
❌ NO cambiar lógica
❌ NO mover componentes de lugar
❌ NO usar apply_diff
❌ NO rediseñar desde cero

✅ SOLO AJUSTAR ESTILOS
✅ SOLO CSS / Tailwind

CAMBIOS OBLIGATORIOS (PASO A PASO)
1. CONTENEDOR PRINCIPAL

Limitar ancho máximo del contenido

Evitar layouts full-width

Centrar la lista de tareas en pantallas grandes

Ejemplo conceptual (NO código literal):

max-width claro

padding lateral contenido

2. TARJETAS DE RESUMEN (Pendiente / Progreso / Completado)

Reducir tamaño general 30–40%

Reducir:

Padding

Altura

Tamaño de iconos

Tamaño de números

Que funcionen como indicadores, no como protagonistas

3. TARJETAS DE TAREA

Eliminar sensación de “tarjeta gigante”

Limitar ancho máximo

Reducir padding vertical y horizontal

Altura ajustada al contenido

Estilo tipo “fila elevada”, no bloque pesado

4. JERARQUÍA VISUAL

El título de la tarea es lo más importante

Metadata (badges, fechas, estados):

Más pequeños

Menos contraste

Visualmente secundarios

5. FONDO OSCURO

Fondo más uniforme

Gradiente muy sutil

El fondo acompaña, no compite

El contenido debe leerse primero, siempre

ESTILO GENERAL

Oscuro real (dark UI profesional)

Alta densidad

Nada de “hero sections”

Nada de “cards de marketing”

Pensado para trabajar 8 horas

OUTPUT ESPERADO (IMPORTANTE)

Devuélveme SOLO CÓDIGO, en este orden:

Ajustes de contenedor (width / max-width)

Ajustes de tarjetas resumen

Ajustes de tarjetas de tareas

Ajustes de fondo

Usa valores concretos (px, rem, %).

❗ Si algo no está claro, asume un criterio razonable y continúa SIN iterar ni explicar.


C:\Users\sante\Desktop\gemini-cli\PROYECTOS\DTOS\dt-growth-hub\src\styles\tarjetas.css
C:\Users\sante\Desktop\gemini-cli\PROYECTOS\DTOS\dt-growth-hub\src\styles\mis-tareas-dense.css
C:\Users\sante\Desktop\gemini-cli\PROYECTOS\DTOS\dt-growth-hub\src\styles\mis-tareas-compact.css


