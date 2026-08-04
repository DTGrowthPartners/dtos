// ⚠️ dotenv DEBE cargarse antes que cualquier otro import: varios módulos leen
// process.env al inicializarse (config/jwt, chat.controller, …). Con el orden
// anterior, JWT_SECRET aún no existía al cargar config/jwt y el backend firmaba
// las sesiones con el fallback público 'your-secret-key' (forjable).
import 'dotenv/config';
import app from './app';
import { PrismaClient } from '@prisma/client';
import { startBankMonitor } from './services/bankMonitor.service';
import { startBotHealth } from './services/botHealth.service';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Database connection
prisma.$connect()
  .then(() => {
    console.log('Connected to database');

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Monitor de movimientos bancarios (solo si BANK_MONITOR=on)
      startBankMonitor();
      // Salud de los bots de WhatsApp (solo si BOT_HEALTH=on)
      startBotHealth();
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});