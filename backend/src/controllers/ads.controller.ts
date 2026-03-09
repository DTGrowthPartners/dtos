import { Request, Response, NextFunction } from 'express';
import { metaGraphApiService, ACCOUNT_STATUS_MAP, DISABLE_REASON_MAP } from '../services/metaGraphApi.service';

type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'last_month' | 'maximum';

class AdsController {
  /**
   * Verify Meta token
   */
  public verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await metaGraphApiService.verifyToken();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  /**
   * Get all ad accounts with status info
   */
  public getAdAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accounts = await metaGraphApiService.getAdAccounts();
      const enriched = accounts.map(acc => ({
        ...acc,
        statusLabel: ACCOUNT_STATUS_MAP[acc.account_status]?.label || 'Desconocido',
        hasAlert: ACCOUNT_STATUS_MAP[acc.account_status]?.alert || false,
        disableReasonLabel: acc.disable_reason !== undefined ? DISABLE_REASON_MAP[acc.disable_reason] || 'Desconocido' : null,
        businessName: acc.business?.name || 'Sin business',
        businessId: acc.business?.id || null,
      }));
      res.json({ success: true, accounts: enriched });
    } catch (error: any) {
      console.error('[Ads] Error fetching ad accounts:', error.message);
      next(error);
    }
  };

  /**
   * Get businesses
   */
  public getBusinesses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businesses = await metaGraphApiService.getBusinesses();
      res.json({ success: true, businesses });
    } catch (error: any) {
      console.error('[Ads] Error fetching businesses:', error.message);
      next(error);
    }
  };

  /**
   * Get pages
   */
  public getPages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pages = await metaGraphApiService.getPages();
      res.json({ success: true, pages });
    } catch (error: any) {
      console.error('[Ads] Error fetching pages:', error.message);
      next(error);
    }
  };

  /**
   * Get Instagram accounts for an ad account
   */
  public getInstagramAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { adAccountId } = req.params;
      const accounts = await metaGraphApiService.getInstagramAccounts(adAccountId);
      res.json({ success: true, accounts });
    } catch (error: any) {
      console.error('[Ads] Error fetching IG accounts:', error.message);
      next(error);
    }
  };

  /**
   * Get full dashboard with all campaigns and insights
   */
  public getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const datePreset = (req.query.date_preset as DatePreset) || 'last_30d';
      const dashboard = await metaGraphApiService.getDashboard(datePreset);

      // Format campaigns for frontend
      const campaigns: any[] = [];
      for (const account of dashboard.accounts) {
        for (const campaign of account.campaigns) {
          const insights = campaign.insights;
          const spend = parseFloat(insights?.spend || '0');
          const impressions = parseInt(insights?.impressions || '0');
          const reach = parseInt(insights?.reach || '0');
          const ctr = parseFloat(insights?.ctr || '0');
          const cpc = parseFloat(insights?.cpc || '0');
          const cpm = parseFloat(insights?.cpm || '0');
          const clicks = parseInt(insights?.clicks || '0');

          const actions = insights?.actions || [];
          const linkClicks = actions.find((a: any) => a.action_type === 'link_click');
          const landingViews = actions.find((a: any) => a.action_type === 'landing_page_view');
          const purchases = actions.find((a: any) => a.action_type === 'purchase');
          const leads = actions.find((a: any) => a.action_type === 'lead');
          const results = parseInt(purchases?.value || leads?.value || landingViews?.value || linkClicks?.value || '0');

          const dailyBudget = parseFloat(campaign.daily_budget || '0') / 100; // Meta returns cents
          const lifetimeBudget = parseFloat(campaign.lifetime_budget || '0') / 100;
          const budget = lifetimeBudget || dailyBudget * 30;

          const cpa = results > 0 ? spend / results : 0;
          const roas = spend > 0 ? (results * 50000) / spend : 0;

          campaigns.push({
            id: campaign.id,
            name: campaign.name,
            client: account.name,
            accountId: account.id,
            status: (campaign.status || '').toLowerCase(),
            objective: campaign.objective,
            budget,
            spent: spend,
            results,
            cpa,
            roas,
            ctr,
            cpc,
            cpm,
            clicks,
            impressions,
            reach,
            startTime: campaign.start_time,
            stopTime: campaign.stop_time,
          });
        }
      }

      res.json({
        success: true,
        totals: dashboard.totals,
        accounts: dashboard.accounts.map(a => ({
          id: a.id,
          name: a.name,
          businessName: a.business?.name || 'Sin business',
          accountStatus: a.account_status,
          statusLabel: ACCOUNT_STATUS_MAP[a.account_status]?.label || 'Desconocido',
          currency: a.currency,
          campaignCount: a.campaigns.length,
          activeCampaigns: a.campaigns.filter((c: any) => c.status === 'ACTIVE').length,
          totalSpend: a.totalSpend,
          totalImpressions: a.totalImpressions,
          totalReach: a.totalReach,
        })),
        campaigns,
        datePreset,
      });
    } catch (error: any) {
      console.error('[Ads] Error fetching dashboard:', error.message);
      next(error);
    }
  };

  /**
   * Get campaigns for a specific ad account
   */
  public getCampaignsByAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { adAccountId } = req.params;
      const datePreset = (req.query.date_preset as DatePreset) || 'last_30d';
      const statusFilter = req.query.status ? (req.query.status as string).split(',') : undefined;

      const campaigns = await metaGraphApiService.getCampaigns(adAccountId, statusFilter);

      const campaignsWithInsights = await Promise.all(
        campaigns.map(async (c) => {
          const insights = await metaGraphApiService.getCampaignInsights(c.id, datePreset);
          return { ...c, insights };
        })
      );

      res.json({ success: true, campaigns: campaignsWithInsights, count: campaignsWithInsights.length });
    } catch (error: any) {
      console.error('[Ads] Error fetching campaigns:', error.message);
      next(error);
    }
  };

  /**
   * Toggle campaign status
   */
  public toggleCampaignStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const { status } = req.body;

      if (!status || !['ACTIVE', 'PAUSED'].includes(status)) {
        res.status(400).json({ success: false, error: 'Status must be ACTIVE or PAUSED' });
        return;
      }

      await metaGraphApiService.toggleCampaignStatus(campaignId, status);
      res.json({ success: true, message: `Campaña ${status === 'ACTIVE' ? 'activada' : 'pausada'} correctamente` });
    } catch (error: any) {
      console.error('[Ads] Error toggling campaign:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Create a full campaign (campaign + adset + creative + ad)
   */
  public createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        adAccountId,
        name,
        objective,
        dailyBudget,
        targeting,
        destinationType,
        promotedObject,
        optimizationGoal,
        isDynamicCreative,
        creativeData,
      } = req.body;

      if (!adAccountId || !name || !objective) {
        res.status(400).json({ success: false, error: 'adAccountId, name y objective son requeridos' });
        return;
      }

      // 1. Create campaign (always PAUSED)
      const campaign = await metaGraphApiService.createCampaign(adAccountId, {
        name,
        objective,
        status: 'PAUSED',
        special_ad_categories: [],
        daily_budget: dailyBudget ? dailyBudget * 100 : undefined, // Convert to cents
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      });

      // 2. Create ad set
      const adSetParams: any = {
        name: `${name} - Ad Set`,
        campaign_id: campaign.id,
        billing_event: 'IMPRESSIONS',
        optimization_goal: optimizationGoal || 'LINK_CLICKS',
        targeting: targeting || { geo_locations: { countries: ['CO'] }, age_min: 18, age_max: 65 },
        status: 'ACTIVE',
      };

      if (!dailyBudget) {
        // If no CBO budget, set at ad set level
        adSetParams.daily_budget = 10000; // $100 COP default in cents
      }

      if (isDynamicCreative) adSetParams.is_dynamic_creative = true;
      if (destinationType) adSetParams.destination_type = destinationType;
      if (promotedObject) adSetParams.promoted_object = promotedObject;

      let adSet;
      try {
        adSet = await metaGraphApiService.createAdSet(adAccountId, adSetParams);
      } catch (err: any) {
        // WhatsApp fallback: retry without whatsapp_phone_number
        if (destinationType === 'WHATSAPP' && promotedObject?.whatsapp_phone_number) {
          const { whatsapp_phone_number, ...fallbackPromoted } = promotedObject;
          adSetParams.promoted_object = fallbackPromoted;
          adSet = await metaGraphApiService.createAdSet(adAccountId, adSetParams);
        } else {
          throw err;
        }
      }

      // 3. Create creative (if provided)
      let creative;
      if (creativeData) {
        creative = await metaGraphApiService.createAdCreative(adAccountId, {
          name: `${name} - Creative`,
          ...creativeData,
        });
      }

      // 4. Create ad (if creative was created)
      let ad;
      if (creative) {
        ad = await metaGraphApiService.createAd(adAccountId, {
          name: `${name} - Ad`,
          adset_id: adSet.id,
          creative: { creative_id: creative.id },
          status: 'ACTIVE',
        });
      }

      res.json({
        success: true,
        message: 'Campaña creada exitosamente (en PAUSED)',
        data: {
          campaignId: campaign.id,
          adSetId: adSet.id,
          creativeId: creative?.id,
          adId: ad?.id,
        },
      });
    } catch (error: any) {
      console.error('[Ads] Error creating campaign:', error.response?.data || error.message);
      const metaError = error.response?.data?.error;
      res.status(500).json({
        success: false,
        error: metaError?.message || error.message,
        errorCode: metaError?.code,
      });
    }
  };

  /**
   * Get audiences for an ad account
   */
  public getAudiences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { adAccountId } = req.params;
      const [saved, custom] = await Promise.all([
        metaGraphApiService.getSavedAudiences(adAccountId),
        metaGraphApiService.getCustomAudiences(adAccountId),
      ]);
      res.json({ success: true, saved, custom });
    } catch (error: any) {
      console.error('[Ads] Error fetching audiences:', error.message);
      next(error);
    }
  };

  /**
   * Get pixels for an ad account
   */
  public getPixels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { adAccountId } = req.params;
      const pixels = await metaGraphApiService.getPixels(adAccountId);
      res.json({ success: true, pixels });
    } catch (error: any) {
      console.error('[Ads] Error fetching pixels:', error.message);
      next(error);
    }
  };
}

export const adsController = new AdsController();
