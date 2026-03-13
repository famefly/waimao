// Apify API 服务 - 按照官方规范
// 文档: https://docs.apify.com/api/v2

import { getSupabase } from '../lib/supabase';

// Apify Actor IDs（常用的抓取器）
export const APIFY_ACTORS = {
  // Google Maps 抓取器
  GOOGLE_MAPS: 'compass/crawler-google-places',
  // Instagram 抓取器
  INSTAGRAM: 'apify/instagram-scraper',
  // Facebook 页面抓取器
  FACEBOOK: 'apify/facebook-pages-scraper',
  // Twitter/X 抓取器
  TWITTER: 'quacker/twitter-scraper',
  // LinkedIn 公司抓取器
  LINKEDIN: 'anchor/linkedin-company-scraper',
  // 通用网页抓取器
  WEB_SCRAPER: 'apify/web-scraper',
  // B2B 数据抓取器
  APOLLO: 'code_crafter/apollo-io-scraper',
};

// 从数据库获取 API Key
export const getApifyToken = async (): Promise<string | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'apify_token')
      .single();

    return (data as { key_value: string } | null)?.key_value || null;
  } catch (error) {
    console.error('获取 Apify Token 失败:', error);
    return null;
  }
};

// 直接调用 Apify API 运行 Actor（后端使用）
export const runApifyActorDirect = async (
  actorId: string,
  input: Record<string, unknown>,
  token: string
): Promise<{ runId: string }> => {
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    throw new Error(`Apify API 错误: ${response.status}`);
  }

  const data = await response.json();
  return { runId: data.data.id };
};

// 直接调用 Apify API 检查运行状态（后端使用）
export const checkActorStatusDirect = async (
  runId: string,
  token: string
): Promise<string> => {
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
  );

  if (!response.ok) {
    throw new Error(`Apify API 错误: ${response.status}`);
  }

  const data = await response.json();
  return data.data.status;
};

// 直接调用 Apify API 获取运行结果（后端使用）
export const getActorResultsDirect = async (
  runId: string,
  token: string
): Promise<Record<string, unknown>[]> => {
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${token}`
  );

  if (!response.ok) {
    throw new Error(`Apify API 错误: ${response.status}`);
  }

  const data = await response.json();
  return data;
};

// 等待 Actor 运行完成并获取结果（后端使用）
export const waitForActorCompletion = async (
  runId: string,
  token: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<void> => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const status = await checkActorStatusDirect(runId, token);
    
    if (status !== 'RUNNING') {
      if (status !== 'SUCCEEDED') {
        throw new Error(`Actor 运行失败: ${status}`);
      }
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }
  
  throw new Error('Actor 运行超时');
};

// 解析抓取结果为客户数据
export const parseScrapedData = (
  platform: string,
  rawData: unknown[],
  taskIndustry: string,
  departmentId: string
): Partial<import('../lib/supabase').Customer>[] => {
  const customers: Partial<import('../lib/supabase').Customer>[] = [];

  rawData.forEach((item: any) => {
    let customer: Partial<import('../lib/supabase').Customer> = {
      source_platform: platform,
      status: 'pending',
      department_id: departmentId,
      industry: taskIndustry.split(' ')[0], // 使用中文部分
      channel_type: '待分类',
      email_verified: false,
      raw_data: JSON.stringify(item),
    };

    switch (platform) {
      case 'google_maps':
        customer = {
          ...customer,
          company_name: item.title || item.name || '未知公司',
          country: item.country || item.address?.split(',').pop()?.trim() || '',
          contact_phone: item.phone || item.phoneUnformatted || '',
          contact_email: item.email || '',
          main_products: item.categoryName || item.categories?.join(', ') || '',
        };
        break;

      case 'linkedin':
        customer = {
          ...customer,
          company_name: item.name || item.companyName || '未知公司',
          country: item.headquarters?.country || item.location || '',
          industry: item.industry || taskIndustry.split(' ')[0],
          annual_revenue: item.revenue || '',
          contact_email: item.email || '',
          main_products: item.specialties?.join(', ') || '',
        };
        break;

      case 'instagram':
        customer = {
          ...customer,
          company_name: item.fullName || item.username || '未知公司',
          contact_email: item.email || item.businessEmail || '',
          contact_phone: item.phone || item.businessPhone || '',
        };
        break;

      case 'facebook':
        customer = {
          ...customer,
          company_name: item.name || item.pageName || '未知公司',
          contact_email: item.email || '',
          contact_phone: item.phone || '',
          country: item.location?.country || '',
        };
        break;

      case 'twitter':
        customer = {
          ...customer,
          company_name: item.name || item.username || '未知公司',
          contact_name: item.name || '',
        };
        break;

      default:
        customer = {
          ...customer,
          company_name: item.name || item.title || item.companyName || '未知公司',
          contact_email: item.email || '',
          contact_phone: item.phone || '',
        };
    }

    if (customer.company_name) {
      customers.push(customer);
    }
  });

  return customers;
};

// 构建平台特定的输入参数
export const buildActorInput = (
  platform: string,
  params: {
    keywords: string[];
    countries: string[];
    industry?: string;
    maxResults?: number;
  }
): { actorId: string; input: Record<string, unknown> } => {
  const { keywords, countries, maxResults = 100 } = params;

  switch (platform) {
    case 'google_maps':
      return {
        actorId: APIFY_ACTORS.GOOGLE_MAPS,
        input: {
          searchStringsArray: keywords,
          locationQuery: countries.join(', '),
          maxCrawledPlacesPerSearch: maxResults,
          language: 'en',
          includeWebResults: true,
          scrapeEmails: true,
          scrapeContacts: true,
        },
      };

    case 'instagram':
      return {
        actorId: APIFY_ACTORS.INSTAGRAM,
        input: {
          search: keywords.join(' '),
          searchType: 'user',
          resultsLimit: maxResults,
          addParentData: true,
        },
      };

    case 'linkedin':
      return {
        actorId: APIFY_ACTORS.LINKEDIN,
        input: {
          searchQueries: keywords.map(k => `${k} ${countries.join(' OR ')}`),
          maxResults,
          extractEmails: true,
          includeContactInfo: true,
        },
      };

    case 'facebook':
      return {
        actorId: APIFY_ACTORS.FACEBOOK,
        input: {
          startUrls: [],
          searchQueries: keywords,
          maxResults,
          extractEmails: true,
        },
      };

    case 'twitter':
      return {
        actorId: APIFY_ACTORS.TWITTER,
        input: {
          searchTerms: keywords,
          maxTweets: maxResults,
          searchMode: 'user',
        },
      };

    default:
      return {
        actorId: APIFY_ACTORS.WEB_SCRAPER,
        input: {
          startUrls: keywords.map(k => ({ url: k })),
          maxPagesPerCrawl: maxResults,
        },
      };
  }
};