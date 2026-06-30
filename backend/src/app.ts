import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import admin from 'firebase-admin';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import modelRoutes from './routes/models.routes';
import clientRoutes from './routes/clients.routes';
import serviceRoutes from './routes/services.routes';
import taskRoutes from './routes/tasks.routes';
import invoiceRoutes from './routes/invoice.router';
import financeRoutes from './routes/finance.routes';
import crmRoutes from './routes/crm.routes';
import tercerosRoutes from './routes/terceros.routes';
import notificationRoutes from './routes/notification.routes';
import pushRoutes from './routes/push.routes';
import accountRoutes from './routes/account.routes';
import webhookRoutes from './routes/webhook.routes';
import calendarRoutes from './routes/calendar.routes';
import clientPortalRoutes from './routes/clientPortal.routes';
import campaignsRoutes from './routes/campaigns.routes';
import chatRoutes from './routes/chat.routes';
import adsRoutes from './routes/ads.routes';
import agentsRoutes from './routes/agents.routes';
import cronsRoutes from './routes/crons.routes';
import tasksAIRoutes from './routes/tasksAI.routes';
import processesRoutes from './routes/processes.routes';
import vpsRoutes from './routes/vps.routes';
import logsRoutes from './routes/logs.routes';
import cobrosRoutes from './routes/cobros.routes';
import clientesV2Routes from './routes/clientesV2.routes';
import transcribeRoutes from './routes/transcribe.routes';
import propuestasRoutes from './routes/propuestas.routes';
import employeeLoanRoutes from './routes/employeeLoan.routes';
import payableRoutes from './routes/payable.routes';
import fixedAssetRoutes from './routes/fixedAsset.routes';
import { errorHandler } from './middlewares/error.middleware';
import { corsOptions } from './config/cors';

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export { admin };

const app = express();

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet());
app.use(cors(corsOptions));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/terceros', tercerosRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/crons', cronsRoutes);
app.use('/api/tasks-ai', tasksAIRoutes);
app.use('/api/processes', processesRoutes);
app.use('/api/vps', vpsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/cobros', cobrosRoutes);
app.use('/api/clientes-v2', clientesV2Routes);
app.use('/api/transcribe', transcribeRoutes);
app.use('/api/propuestas', propuestasRoutes);
app.use('/api/employee-loans', employeeLoanRoutes);
app.use('/api/payables', payableRoutes);
app.use('/api/fixed-assets', fixedAssetRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Error handling middleware
app.use(errorHandler);

export default app;