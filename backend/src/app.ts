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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Error handling middleware
app.use(errorHandler);

export default app;