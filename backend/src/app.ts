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
import calendarRoutes from './routes/calendar.routes';
import notificationRoutes from './routes/notification.routes';
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
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Error handling middleware
app.use(errorHandler);

export default app;