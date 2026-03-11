import axios, { AxiosInstance } from 'axios';

const META_GRAPH_BASE = 'https://graph.facebook.com/v24.0';

// Account status mapping
export const ACCOUNT_STATUS_MAP: Record<number, { label: string; alert: boolean }> = {
  1: { label: 'Activa', alert: false },
  2: { label: 'Deshabilitada', alert: true },
  3: { label: 'Sin liquidar (pago pendiente)', alert: true },
  7: { label: 'Revisión de riesgo pendiente', alert: true },
  9: { label: 'En período de gracia', alert: true },
  100: { label: 'Cierre pendiente', alert: true },
  101: { label: 'Cerrada', alert: true },
};

export const DISABLE_REASON_MAP: Record<number, string> = {
  0: 'Ninguno',
  1: 'Política de integridad',
  2: 'Revisión IP',
  3: 'Riesgo de pago',
  4: 'Cuenta gris cerrada',
  5: 'Revisión AFC',
  7: 'Cierre permanente',
};

export const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Tráfico',
  OUTCOME_ENGAGEMENT: 'Interacción',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Ventas',
  OUTCOME_AWARENESS: 'Reconocimiento',
  OUTCOME_APP_PROMOTION: 'Promoción App',
};

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  disable_reason?: number;
  currency: string;
  amount_spent: string;
  business?: { id: string; name: string };
}

export interface MetaBusiness {
  id: string;
  name: string;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token?: string;
  picture?: { data: { url: string } };
  website?: string;
  instagram_business_account?: { id: string; username: string; profile_picture_url: string };
}

export interface MetaInstagramAccount {
  id: string;
  username: string;
  profile_picture_url?: string;
}

export interface MetaCampaignRaw {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaInsightsRaw {
  campaign_name?: string;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

export interface MetaAudience {
  id: string;
  name: string;
  targeting?: any;
  approximate_count?: number;
  subtype?: string;
}

export interface MetaPixel {
  id: string;
  name: string;
  last_fired_time?: string;
}

type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d' | 'this_month' | 'last_month' | 'maximum';

class MetaGraphApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: META_GRAPH_BASE,
      timeout: 30000,
    });
  }

  private getToken(): string {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) {
      throw new Error('META_ACCESS_TOKEN no configurado. Agrega el token en las variables de entorno.');
    }
    return token;
  }

  // ─── 1. TOKEN ───────────────────────────────────────────

  async verifyToken(): Promise<any> {
    const token = this.getToken();
    const { data } = await this.client.get('/debug_token', {
      params: { input_token: token, access_token: token },
    });
    return data;
  }

  // ─── 2. AD ACCOUNTS ────────────────────────────────────

  async getAdAccounts(): Promise<MetaAdAccount[]> {
    const token = this.getToken();
    const { data } = await this.client.get('/me/adaccounts', {
      params: {
        fields: 'id,name,account_status,disable_reason,currency,amount_spent,business{id,name}',
        limit: 100,
        access_token: token,
      },
    });
    return data.data || [];
  }

  async getBusinessAdAccounts(businessId: string): Promise<MetaAdAccount[]> {
    const token = this.getToken();
    const [owned, client] = await Promise.all([
      this.client.get(`/${businessId}/owned_ad_accounts`, {
        params: {
          fields: 'id,name,account_status,disable_reason,currency,amount_spent',
          limit: 100,
          access_token: token,
        },
      }).catch(() => ({ data: { data: [] } })),
      this.client.get(`/${businessId}/client_ad_accounts`, {
        params: {
          fields: 'id,name,account_status,disable_reason,currency,amount_spent',
          limit: 100,
          access_token: token,
        },
      }).catch(() => ({ data: { data: [] } })),
    ]);
    return [...(owned.data.data || []), ...(client.data.data || [])];
  }

  // ─── 3. BUSINESSES ─────────────────────────────────────

  async getBusinesses(): Promise<MetaBusiness[]> {
    const token = this.getToken();
    const { data } = await this.client.get('/me/businesses', {
      params: { fields: 'id,name', limit: 100, access_token: token },
    });
    return data.data || [];
  }

  // ─── 4. PAGES ──────────────────────────────────────────

  async getPages(): Promise<MetaPage[]> {
    const token = this.getToken();
    const { data } = await this.client.get('/me/accounts', {
      params: {
        fields: 'id,name,access_token,picture{url},website,instagram_business_account{id,username,profile_picture_url}',
        limit: 100,
        access_token: token,
      },
    });
    return data.data || [];
  }

  // ─── 5. INSTAGRAM ACCOUNTS ─────────────────────────────

  async getInstagramAccounts(adAccountId: string): Promise<MetaInstagramAccount[]> {
    const token = this.getToken();
    const { data } = await this.client.get(`/${adAccountId}/instagram_accounts`, {
      params: {
        fields: 'id,username,profile_picture_url',
        limit: 100,
        access_token: token,
      },
    });
    return data.data || [];
  }

  // ─── 6. CAMPAIGNS ─────────────────────────────────────

  async getCampaigns(adAccountId: string, statusFilter?: string[]): Promise<MetaCampaignRaw[]> {
    const token = this.getToken();
    const params: any = {
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
      limit: 50,
      access_token: token,
    };
    if (statusFilter && statusFilter.length > 0) {
      params.effective_status = JSON.stringify(statusFilter);
    }
    const { data } = await this.client.get(`/${adAccountId}/campaigns`, { params });
    return data.data || [];
  }

  async getCampaignInsights(campaignId: string, datePreset: DatePreset = 'last_30d'): Promise<MetaInsightsRaw | null> {
    const token = this.getToken();
    try {
      const { data } = await this.client.get(`/${campaignId}/insights`, {
        params: {
          fields: 'impressions,reach,clicks,spend,cpc,cpm,ctr,actions,cost_per_action_type',
          date_preset: datePreset,
          access_token: token,
        },
      });
      return data.data?.[0] || null;
    } catch {
      return null;
    }
  }

  async toggleCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<boolean> {
    const token = this.getToken();
    const { data } = await this.client.post(`/${campaignId}`, null, {
      params: { status, access_token: token },
    });
    return data.success !== false;
  }

  // ─── 7. AUDIENCES ─────────────────────────────────────

  async getSavedAudiences(adAccountId: string): Promise<MetaAudience[]> {
    const token = this.getToken();
    const { data } = await this.client.get(`/${adAccountId}/saved_audiences`, {
      params: {
        fields: 'id,name,targeting,approximate_count',
        limit: 100,
        access_token: token,
      },
    });
    return data.data || [];
  }

  async getCustomAudiences(adAccountId: string): Promise<MetaAudience[]> {
    const token = this.getToken();
    const { data } = await this.client.get(`/${adAccountId}/customaudiences`, {
      params: {
        fields: 'id,name,approximate_count,subtype',
        limit: 100,
        access_token: token,
      },
    });
    return data.data || [];
  }

  // ─── 8. PIXELS ────────────────────────────────────────

  async getPixels(adAccountId: string): Promise<MetaPixel[]> {
    const token = this.getToken();
    const { data } = await this.client.get(`/${adAccountId}/adspixels`, {
      params: {
        fields: 'id,name,last_fired_time',
        limit: 50,
        access_token: token,
      },
    });
    return data.data || [];
  }

  // ─── 9. CAMPAIGN CREATION ─────────────────────────────

  async createCampaign(adAccountId: string, params: {
    name: string;
    objective: string;
    status: 'PAUSED' | 'ACTIVE';
    special_ad_categories: string[];
    daily_budget?: number;
    bid_strategy?: string;
  }): Promise<{ id: string }> {
    const token = this.getToken();
    const { data } = await this.client.post(`/${adAccountId}/campaigns`, null, {
      params: { ...params, special_ad_categories: JSON.stringify(params.special_ad_categories), access_token: token },
    });
    return data;
  }

  async createAdSet(adAccountId: string, params: {
    name: string;
    campaign_id: string;
    daily_budget?: number;
    billing_event: string;
    optimization_goal: string;
    targeting: any;
    status: string;
    start_time?: string;
    end_time?: string;
    is_dynamic_creative?: boolean;
    promoted_object?: any;
    destination_type?: string;
  }): Promise<{ id: string }> {
    const token = this.getToken();
    const body: any = { ...params, access_token: token };
    body.targeting = JSON.stringify(body.targeting);
    if (body.promoted_object) body.promoted_object = JSON.stringify(body.promoted_object);
    const { data } = await this.client.post(`/${adAccountId}/adsets`, null, { params: body });
    return data;
  }

  async createAdCreative(adAccountId: string, creativeData: any): Promise<{ id: string }> {
    const token = this.getToken();
    const body: any = { ...creativeData, access_token: token };
    if (body.object_story_spec) body.object_story_spec = JSON.stringify(body.object_story_spec);
    if (body.asset_feed_spec) body.asset_feed_spec = JSON.stringify(body.asset_feed_spec);
    if (body.degrees_of_freedom_spec) body.degrees_of_freedom_spec = JSON.stringify(body.degrees_of_freedom_spec);
    const { data } = await this.client.post(`/${adAccountId}/adcreatives`, null, { params: body });
    return data;
  }

  async createAd(adAccountId: string, params: {
    name: string;
    adset_id: string;
    creative: { creative_id: string };
    status: string;
  }): Promise<{ id: string }> {
    const token = this.getToken();
    const { data } = await this.client.post(`/${adAccountId}/ads`, null, {
      params: { ...params, creative: JSON.stringify(params.creative), access_token: token },
    });
    return data;
  }

  // ─── 10. DASHBOARD AGGREGATION ─────────────────────────

  async getDashboard(datePreset: DatePreset = 'last_30d'): Promise<{
    accounts: (MetaAdAccount & { campaigns: any[]; totalSpend: number; totalImpressions: number; totalReach: number })[];
    totals: { totalAccounts: number; totalCampaigns: number; totalActiveCampaigns: number; totalSpend: number; totalImpressions: number; totalReach: number };
  }> {
    const accounts = await this.getAdAccounts();

    const enriched = await Promise.all(
      accounts
        .filter(acc => acc.account_status === 1) // Only active accounts
        .map(async (account) => {
          try {
            const campaigns = await this.getCampaigns(account.id, ['ACTIVE', 'PAUSED']);
            const campaignsWithInsights = await Promise.all(
              campaigns.map(async (c) => {
                const insights = await this.getCampaignInsights(c.id, datePreset);
                return { ...c, insights };
              })
            );

            const totalSpend = campaignsWithInsights.reduce((sum, c) => sum + parseFloat(c.insights?.spend || '0'), 0);
            const totalImpressions = campaignsWithInsights.reduce((sum, c) => sum + parseInt(c.insights?.impressions || '0'), 0);
            const totalReach = campaignsWithInsights.reduce((sum, c) => sum + parseInt(c.insights?.reach || '0'), 0);

            return {
              ...account,
              campaigns: campaignsWithInsights,
              totalSpend,
              totalImpressions,
              totalReach,
            };
          } catch (err) {
            console.error(`Error fetching campaigns for account ${account.id}:`, err);
            return { ...account, campaigns: [], totalSpend: 0, totalImpressions: 0, totalReach: 0 };
          }
        })
    );

    const totals = {
      totalAccounts: enriched.length,
      totalCampaigns: enriched.reduce((sum, a) => sum + a.campaigns.length, 0),
      totalActiveCampaigns: enriched.reduce((sum, a) => sum + a.campaigns.filter((c: any) => c.status === 'ACTIVE').length, 0),
      totalSpend: enriched.reduce((sum, a) => sum + a.totalSpend, 0),
      totalImpressions: enriched.reduce((sum, a) => sum + a.totalImpressions, 0),
      totalReach: enriched.reduce((sum, a) => sum + a.totalReach, 0),
    };

    return { accounts: enriched, totals };
  }
}

export const metaGraphApiService = new MetaGraphApiService();
export default metaGraphApiService;
