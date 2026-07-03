#!/bin/sh
# Corre el smoke test de producción y alerta por WhatsApp si algo falla.
# Cron sugerido (cada 6 horas):
#   7 */6 * * * /home/ubuntu/dtos/scripts/smoke/run_smoke_cron.sh >> /tmp/smoke_cron.log 2>&1
# Credenciales de la cuenta de prueba en /home/ubuntu/dtos/scripts/smoke/.smoke.env (chmod 600, NO commitear).
cd /home/ubuntu/dtos || exit 1
if [ -f scripts/smoke/.smoke.env ]; then
  . scripts/smoke/.smoke.env
  export SMOKE_EMAIL SMOKE_PASSWORD
fi
node scripts/smoke/smoke.mjs --json > /tmp/last_smoke.json 2>&1
CODE=$?
if [ $CODE -ne 0 ]; then
  node scripts/smoke/alert.js /tmp/last_smoke.json
fi
echo "$(date '+%F %T') smoke exit=$CODE"
