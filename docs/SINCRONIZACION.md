# Sincronizar tu copia de DT-OS

`main` está alineado con lo que corre en producción (VPS). Para poner tu copia al día:

```bash
git checkout main
git pull origin main

# backend: dependencias nuevas (imapflow, mailparser, qrcode del generador de facturas)
cd backend
npm install
npx prisma db push        # tablas/campos nuevos
npx prisma generate
cd ..

npm install               # frontend
```

## Lo que se agregó (ago 2026)

| Módulo | Dónde |
|---|---|
| **Facturación electrónica DIAN (Factus)** | `backend/src/services/factus.service.ts`, `routes/factus.routes.ts`, botón del escudo en Cuentas de Cobro. Facturas, notas crédito (anulación), notas débito, PDF propio (`generador_factura.py`). |
| **Monitor bancario** (reemplaza `api-cuentas-de-cobro`) | `services/bankMonitor.service.ts`: IMAP → clasifica → Sheets → WhatsApp. Vista en Finanzas → Movimientos. |
| **Reportes diarios 7am** | `services/dailyReports.service.ts` + `POST /api/webhook/bot/reports/daily` (cron del VPS). |
| **NPS trimestral** | `routes/nps.routes.ts`, página `/nps`, badge en la ficha del cliente. Formulario en `plus/nps-dtgp.html` (servido en feedback.dtgrowthpartners.com). |
| **Documentaciones** (wiki interna) | `routes/docs.routes.ts`, página `/documentaciones`. |
| **Monitor de bots + SSL** | `services/botHealth.service.ts`. |
| **Reportes Meta diario/semanal/mensual** | `services/metaDiario|metaSemanal|metaMensual.service.ts` + paneles en la ficha del cliente. |

## Lo que NO está en el repo (y no debe estarlo)

`backend/.env`, `credencials.json` (Google Sheets) y `firebase-service-account.json`. Pídelos al equipo o copia los del VPS.
Sin ellos el backend arranca, pero Sheets/Factus/Firebase no funcionan en local.

Los monitores solo corren con `BANK_MONITOR=on` y `BOT_HEALTH=on` — están así **únicamente en el VPS**, para que ninguna copia local escriba en el Sheets ni mande WhatsApp por accidente.

## Regla de oro

**Nada se edita directo en el VPS.** Se commitea, se pushea y el VPS hace `git pull`.
Dos veces hubo trabajo desplegado por SFTP sin versionar que un `git checkout` habría borrado.
Si tocas algo en el servidor por urgencia, commitéalo el mismo día.
