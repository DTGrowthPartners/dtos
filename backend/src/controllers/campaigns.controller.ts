import { Request, Response, NextFunction } from 'express';
import { metaAdsService } from '../services/metaAds.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type DatePreset = 'maximum' | 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'last_month';

class CampaignsController {
  /**
   * Health check for Meta Ads API
   */
  public healthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const health = await metaAdsService.healthCheck();
      res.json(health);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get full dashboard data - for admin/team users
   * Returns all campaigns from all accounts
   */
  public getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const datePreset = (req.query.date_preset as DatePreset) || 'last_30d';

      const dashboard = await metaAdsService.getDashboard(datePreset);

      // Transform data for frontend
      const campaigns: any[] = [];

      for (const account of dashboard.accounts) {
        if (account.campaigns) {
          for (const campaign of account.campaigns) {
            campaigns.push(metaAdsService.formatCampaignForFrontend(campaign, account.name));
          }
        }
      }

      res.json({
        success: true,
        totals: dashboard.totals,
        businesses: dashboard.businesses,
        accounts: dashboard.accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          businessName: acc.business_name,
          businessId: acc.business_id,
          campaignCount: acc.campaignCount,
          activeCampaigns: acc.activeCampaigns,
          pausedCampaigns: acc.pausedCampaigns,
          totalSpend: acc.totalSpend,
          totalImpressions: acc.totalImpressions,
          totalReach: acc.totalReach,
        })),
        campaigns,
        datePreset,
        timestamp: dashboard.timestamp,
      });
    } catch (error) {
      console.error('Error fetching campaigns dashboard:', error);
      next(error);
    }
  };

  /**
   * Get campaigns for a specific client
   * Used by client portal - filters by client's ad account
   */
  public getClientCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { clientId } = req.params;
      const datePreset = (req.query.date_preset as DatePreset) || 'last_30d';

      // Get client info to find their ad account
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          metaAdAccountId: true,
          metaBusinessId: true,
        },
      });

      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }

      if (!client.metaAdAccountId) {
        // Return empty campaigns if client has no ad account linked
        res.json({
          success: true,
          client: { id: client.id, name: client.name },
          campaigns: [],
          message: 'No Meta Ads account linked to this client',
        });
        return;
      }

      // Get campaigns for client's ad account
      const campaigns = await metaAdsService.getCampaigns(client.metaAdAccountId, datePreset);

      const formattedCampaigns = campaigns.map(campaign =>
        metaAdsService.formatCampaignForFrontend(campaign, client.name)
      );

      res.json({
        success: true,
        client: { id: client.id, name: client.name },
        campaigns: formattedCampaigns,
        datePreset,
      });
    } catch (error) {
      console.error('Error fetching client campaigns:', error);
      next(error);
    }
  };

  /**
   * Get campaigns by ad account ID
   */
  public getCampaignsByAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = req.params;
      const datePreset = (req.query.date_preset as DatePreset) || 'last_30d';

      const campaigns = await metaAdsService.getCampaigns(accountId, datePreset);

      res.json({
        success: true,
        accountId,
        campaigns,
        count: campaigns.length,
        datePreset,
      });
    } catch (error) {
      console.error('Error fetching campaigns by account:', error);
      next(error);
    }
  };

  /**
   * Toggle campaign status (pause/activate)
   */
  public toggleCampaignStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const { status } = req.body;

      if (!status || !['ACTIVE', 'PAUSED'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Status must be ACTIVE or PAUSED',
        });
        return;
      }

      const result = await metaAdsService.toggleCampaignStatus(campaignId, status);

      res.json(result);
    } catch (error: any) {
      console.error('Error toggling campaign status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to toggle campaign status',
      });
    }
  };

  /**
   * Get all businesses
   */
  public getBusinesses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businesses = await metaAdsService.getBusinesses();
      res.json({ success: true, businesses });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all ad accounts
   */
  public getAdAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await metaAdsService.getAdAccounts();
      res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Link a Meta Ad Account to a client
   */
  public linkClientAdAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { clientId } = req.params;
      const { metaAdAccountId, metaBusinessId } = req.body;

      const client = await prisma.client.update({
        where: { id: clientId },
        data: {
          metaAdAccountId,
          metaBusinessId,
        },
      });

      res.json({
        success: true,
        client: {
          id: client.id,
          name: client.name,
          metaAdAccountId: client.metaAdAccountId,
          metaBusinessId: client.metaBusinessId,
        },
      });
    } catch (error) {
      console.error('Error linking ad account to client:', error);
      next(error);
    }
  };
}

export const campaignsController = new CampaignsController();
