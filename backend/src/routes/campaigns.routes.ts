import { Router } from 'express';
import { campaignsController } from '../controllers/campaigns.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Public health check (no auth required)
router.get('/health', campaignsController.healthCheck);

// All other routes require authentication
router.use(authMiddleware);

// Dashboard - get all campaigns (for admin/team)
router.get('/dashboard', campaignsController.getDashboard);

// Get all businesses from Meta
router.get('/businesses', campaignsController.getBusinesses);

// Get all ad accounts from Meta
router.get('/ad-accounts', campaignsController.getAdAccounts);

// Get campaigns for a specific client (for client portal)
router.get('/client/:clientId', campaignsController.getClientCampaigns);

// Get campaigns by ad account ID
router.get('/account/:accountId', campaignsController.getCampaignsByAccount);

// Toggle campaign status (pause/activate)
router.post('/:campaignId/status', campaignsController.toggleCampaignStatus);

// Link Meta Ad Account to a client
router.put('/client/:clientId/link-account', campaignsController.linkClientAdAccount);

export default router;
