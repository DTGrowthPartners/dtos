import { Router } from 'express';
import { adsController } from '../controllers/ads.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Token & Setup
router.get('/verify-token', adsController.verifyToken);
router.get('/businesses', adsController.getBusinesses);
router.get('/pages', adsController.getPages);

// Ad Accounts
router.get('/ad-accounts', adsController.getAdAccounts);
router.get('/ad-accounts/:adAccountId/instagram', adsController.getInstagramAccounts);
router.get('/ad-accounts/:adAccountId/audiences', adsController.getAudiences);
router.get('/ad-accounts/:adAccountId/pixels', adsController.getPixels);
router.get('/ad-accounts/:adAccountId/campaigns', adsController.getCampaignsByAccount);

// Dashboard (all accounts aggregated)
router.get('/dashboard', adsController.getDashboard);

// Campaign actions
router.post('/campaigns', adsController.createCampaign);
router.post('/campaigns/:campaignId/status', adsController.toggleCampaignStatus);

export default router;
