#!/bin/bash

# Script para configurar el servicio systemd del bot de Slack
# Ejecutar en el VPS como: bash setup-systemd.sh

set -e  # Salir si hay algún error

echo "=========================================="
echo "Configuración de Servicio Systemd"
echo "=========================================="
echo ""

# 1. Verificar directorio del proyecto
PROJECT_DIR="/home/ubuntu/api-cuentas-de-cobro"
echo "📁 Verificando directorio del proyecto..."
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Error: No se encontró el directorio $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"
echo "✅ Directorio encontrado: $(pwd)"
echo ""

# 2. Instalar Node.js si no está instalado
echo "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js ya está instalado: $(node --version)"
fi
echo ""

# 3. Instalar dependencias
echo "📦 Instalando dependencias del proyecto..."
npm install
echo "✅ Dependencias instaladas"
echo ""

# 4. Compilar el proyecto TypeScript
echo "🔨 Compilando el proyecto..."
npm run build
echo "✅ Proyecto compilado"
echo ""

# 5. Verificar que el archivo compilado existe
if [ ! -f "$PROJECT_DIR/dist/server.js" ]; then
    echo "❌ Error: No se encontró dist/server.js después de compilar"
    exit 1
fi
echo "✅ Archivo server.js encontrado"
echo ""

# 6. Crear archivo .env si no existe
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "⚠️  Advertencia: No se encontró archivo .env"
    echo "📝 Creando archivo .env de ejemplo..."
    cat > "$PROJECT_DIR/.env" << 'EOF'
# Configuración del servidor
PORT=3001
NODE_ENV=production

# Base de datos
DATABASE_URL="postgresql://usuario:password@localhost:5432/database"

# JWT
JWT_SECRET=tu_secreto_jwt_aqui

# Slack Bot
SLACK_BOT_TOKEN=xoxb-tu-token-aqui
SLACK_SIGNING_SECRET=tu-signing-secret
SLACK_APP_TOKEN=xapp-tu-app-token

# Email (si aplica)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=tu-password
EOF
    echo "⚠️  IMPORTANTE: Debes editar el archivo .env con tus credenciales reales"
    echo "   Ejecuta: nano $PROJECT_DIR/.env"
fi
echo ""

# 7. Crear el archivo de servicio systemd
echo "⚙️  Creando servicio systemd..."
sudo tee /etc/systemd/system/slack-bot.service > /dev/null << EOF
[Unit]
Description=Slack Bot Service - API Cuentas de Cobro
Documentation=https://github.com/tu-repo
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node $PROJECT_DIR/dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=slack-bot

# Límites de recursos (opcional)
LimitNOFILE=65536

# Seguridad
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
echo "✅ Archivo de servicio creado en /etc/systemd/system/slack-bot.service"
echo ""

# 8. Recargar systemd
echo "🔄 Recargando configuración de systemd..."
sudo systemctl daemon-reload
echo "✅ Configuración recargada"
echo ""

# 9. Habilitar el servicio para que inicie con el sistema
echo "🚀 Habilitando servicio para inicio automático..."
sudo systemctl enable slack-bot.service
echo "✅ Servicio habilitado"
echo ""

# 10. Iniciar el servicio
echo "▶️  Iniciando servicio..."
sudo systemctl start slack-bot.service
echo "✅ Servicio iniciado"
echo ""

# 11. Verificar el estado
echo "=========================================="
echo "📊 Estado del Servicio"
echo "=========================================="
sudo systemctl status slack-bot.service --no-pager
echo ""

echo "=========================================="
echo "✅ Configuración completada"
echo "=========================================="
echo ""
echo "📋 Comandos útiles:"
echo "   Ver estado:      sudo systemctl status slack-bot"
echo "   Detener:         sudo systemctl stop slack-bot"
echo "   Reiniciar:       sudo systemctl restart slack-bot"
echo "   Ver logs:        sudo journalctl -u slack-bot -f"
echo "   Ver logs tail:   sudo journalctl -u slack-bot -n 100"
echo "   Deshabilitar:    sudo systemctl disable slack-bot"
echo ""
echo "⚠️  IMPORTANTE: Si hay errores, revisa:"
echo "   1. El archivo .env está configurado correctamente"
echo "   2. Las credenciales de Slack son válidas"
echo "   3. La base de datos está accesible"
echo ""
echo "   Para ver los logs en tiempo real:"
echo "   sudo journalctl -u slack-bot -f"
