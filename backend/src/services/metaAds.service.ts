import axios from 'axios';

const META_ADS_API_URL = 'https://metasuite.dtgrowthpartners.com';

export interface MetaBusiness {
  id: string;
  name: string;
  profile_picture_uri?: string;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  business_name: string;
  business_id: string;
  account_type: string;
  campaigns?: MetaCampaign[];
  campaignCount?: number;
  activeCampaigns?: number;
  pausedCampaigns?: number;
  totalSpend?: number;
  totalImpressions?: number;
  totalReach?: number;
}

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaCostPerResult {
  indicator: string;
  values: { value: string }[];
}

export interface MetaInsights {
  campaign_name?: string;
  spend: string;
  impressions: string;
  reach: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  cost_per_result?: MetaCostPerResult[];
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  insights?: MetaInsights;
}

export interface DashboardTotals {
  totalAccounts: number;
  totalBusinesses: number;
  totalCampaigns: number;
  totalActiveCampaigns: number;
  totalPausedCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalReach: number;
}

export interface DashboardResponse {
  success: boolean;
  timestamp: string;
  datePreset: string;
  totals: DashboardTotals;
  businesses: MetaBusiness[];
  accounts: MetaAdAccount[];
}

export interface CampaignsResponse {
  success: boolean;
  data: MetaCampaign[];
  count: number;
  accountId: string;
  datePreset: string;
}

type DatePreset = 'maximum' | 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'last_month';

class MetaAdsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = META_ADS_API_URL;
  }

  /**
   * Check if the Meta Ads API is healthy
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; service: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/health`);
      return response.data;
    } catch (error) {
      console.error('Meta Ads API health check failed:', error);
      throw new Error('Meta Ads API is not available');
    }
  }

  /**
   * Get all businesses
   */
  async getBusinesses(): Promise<MetaBusiness[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/businesses`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch businesses');
    } catch (error) {
      console.error('Error fetching businesses:', error);
      throw error;
    }
  }

  /**
   * Get all ad accounts
   */
  async getAdAccounts(): Promise<{ businesses: MetaBusiness[]; adAccounts: MetaAdAccount[] }> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/ad-accounts`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch ad accounts');
    } catch (error) {
      console.error('Error fetching ad accounts:', error);
      throw error;
    }
  }

  /**
   * Get campaigns for a specific ad account
   */
  async getCampaigns(accountId: string, datePreset: DatePreset = 'maximum'): Promise<MetaCampaign[]> {
    try {
      const response = await axios.get<CampaignsResponse>(
        `${this.baseUrl}/api/campaigns/${accountId}`,
        { params: { date_preset: datePreset } }
      );
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch campaigns');
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }
  }

  /**
   * Get full dashboard data with all accounts and campaigns
   */
  async getDashboard(datePreset: DatePreset = 'maximum'): Promise<DashboardResponse> {
    try {
      const response = await axios.get<DashboardResponse>(
        `${this.baseUrl}/api/dashboard`,
        { params: { date_preset: datePreset } }
      );
      if (response.data.success) {
        return response.data;
      }
      throw new Error('Failed to fetch dashboard');
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      throw error;
    }
  }

  /**
   * Get dashboard summary grouped by business
   */
  async getDashboardSummary(datePreset: DatePreset = 'maximum'): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/dashboard/summary`,
        { params: { date_preset: datePreset } }
      );
      if (response.data.success) {
        return response.data;
      }
      throw new Error('Failed to fetch dashboard summary');
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      throw error;
    }
  }

  /**
   * Toggle campaign status (ACTIVE/PAUSED)
   */
  async toggleCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/campaigns/${campaignId}/status`,
        { status }
      );
      return {
        success: response.data.success,
        message: response.data.message || `Campaign ${campaignId} updated to ${status}`,
      };
    } catch (error: any) {
      console.error('Error toggling campaign status:', error);
      throw new Error(error.response?.data?.error || 'Failed to toggle campaign status');
    }
  }

  /**
   * Format campaign data for frontend consumption
   * Maps Meta Ads API data to DTOS format
   */
  formatCampaignForFrontend(campaign: MetaCampaign, accountName: string): any {
    const insights = campaign.insights;
    const spend = parseFloat(insights?.spend || '0');
    const impressions = parseInt(insights?.impressions || '0');
    const reach = parseInt(insights?.reach || '0');
    const ctr = parseFloat(insights?.ctr || '0');
    const cpc = parseFloat(insights?.cpc || '0');
    const cpm = parseFloat(insights?.cpm || '0');

    // Calculate budget
    const dailyBudget = parseFloat(campaign.daily_budget || '0');
    const lifetimeBudget = parseFloat(campaign.lifetime_budget || '0');
    const budgetRemaining = parseFloat(campaign.budget_remaining || '0');
    const budget = lifetimeBudget || dailyBudget * 30; // Estimate monthly for daily budgets

    // Get results (clicks, conversions, etc.)
    const actions = insights?.actions || [];
    const linkClicks = actions.find(a => a.action_type === 'link_click');
    const landingViews = actions.find(a => a.action_type === 'landing_page_view');
    const purchases = actions.find(a => a.action_type === 'purchase');
    const leads = actions.find(a => a.action_type === 'lead');

    const results = parseInt(
      purchases?.value ||
      leads?.value ||
      landingViews?.value ||
      linkClicks?.value ||
      '0'
    );

    // Calculate CPA and ROAS
    const cpa = results > 0 ? spend / results : 0;
    const roas = spend > 0 ? (results * 50000) / spend : 0; // Assuming average order value of 50k COP

    return {
      id: campaign.id,
      name: campaign.name,
      client: accountName,
      status: campaign.status.toLowerCase() as 'active' | 'paused',
      platform: 'meta' as const,
      objective: campaign.objective,
      budget,
      spent: spend,
      budgetRemaining,
      results,
      cpa,
      roas,
      ctr,
      cpc,
      cpm,
      impressions,
      reach,
      rawInsights: insights,
    };
  }
}

export const metaAdsService = new MetaAdsService();
export default metaAdsService;
