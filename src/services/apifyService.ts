// Apify API 服务 - 按照官方规范
// 文档: https://docs.apify.com/api/v2

import { getSupabase } from '../lib/supabase';

// Apify Actor IDs（与前端 ScrapePage.tsx 保持一致）
// 优先选择带邮箱的高价值渠道
export const APIFY_ACTORS = {
  // ===== 高价值渠道（带邮箱）=====
  // Leads Finder: 类似Apollo，直接返回验证邮箱，$1.5/千条
  LEADS_FINDER: 'code_crafter/leads-finder',
  // ThomasNet: 美国工业供应商目录，$5/千条
  THOMASNET: 'memo23/thomasnet-scraper',
  // Crunchbase: 创业公司/科技公司，$2.5/千条
  CRUNCHBASE: 'curious_coder/crunchbase-scraper',
  
  // ===== Google Maps（基础渠道）=====
  GOOGLE_MAPS: 'compass/crawler-google-places',
  
  // ===== 邮箱提取专用（需要网站URL）=====
  EMAIL_EXTRACTOR: 'logical_scrapers/extract-email-from-any-website',
  
  // ===== Amazon卖家（跨境电商进口商）=====
  AMAZON_SELLER: 'junglee/amazon-seller-scraper',
  
  // ===== 商业目录 =====
  YELLOW_PAGES: 'trudax/yellow-pages-us-scraper',
  YELLOW_PAGES_WORLD: 'canadesk/yellow-pages-scraper', // 全球黄页
  YELP: 'tri_angle/yelp-scraper',
  
  // ===== 社交媒体 =====
  LINKEDIN: 'apimaestro/linkedin-profile-search-scraper', // 无需登录，支持关键词搜索+邮箱发现
  FACEBOOK: 'apify/facebook-pages-scraper',
  INSTAGRAM: 'apify/instagram-search-scraper',
  
  // ===== 论坛/社区 =====
  FORUM: 'peghin/ai-forum-scraper-stack-overflow-quora-reddit-more',
  REDDIT: 'trudax/reddit-scraper',
  
  // ===== B2B 平台 =====
  ALIBABA: 'adrian_horning/alibaba-scraper',
  MADE_IN_CHINA: 'memo23/made-in-china-scraper',
  GLOBAL_SOURCES: 'web.harvester/global-sources-scraper',
  
  // ===== 海关数据（需要配置API）=====
  // 注意：海关数据通常需要单独订阅第三方API
  // 这里使用公开的海关数据查询网站爬虫
  CUSTOMS_DATA: 'custom/customs-data-scraper', // 需要自定义部署
  
  // ===== 专业行业网站 =====
  INDUSTRY_DIRECTORY: 'custom/industry-directory-scraper', // 行业目录爬虫
  
  // ===== 自定义爬虫 =====
  SCRAPLING: 'maiboxuan/scrapling-actor', // Scrapling 自适应爬虫
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

  const data = await response.json() as { data: { id: string } };
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

  const data = await response.json() as { data: { status: string } };
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

  const data = await response.json() as Record<string, unknown>[];
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

// 解析抓取结果为客户数据 - 优化版本
export const parseScrapedData = (
  platform: string,
  rawData: unknown[],
  taskIndustry: string,
  departmentId: string | null
): Partial<import('../lib/supabase').Customer>[] => {
  const customers: Partial<import('../lib/supabase').Customer>[] = [];

  rawData.forEach((item: any) => {
    let customer: Partial<import('../lib/supabase').Customer> = {
      source_platform: platform,
      status: 'pending',
      department_id: departmentId ?? undefined,
      industry: taskIndustry.split(' ')[0],
      channel_type: '待分类',
      email_verified: false,
      raw_data: JSON.stringify(item),
    };

    // 辅助函数：将 country 字符串转为数组
    const countryToArray = (countryStr: string | undefined | null): string[] | undefined => {
      if (!countryStr || countryStr.trim() === '') return undefined;
      return [countryStr.trim()];
    };

    // 辅助函数：从地址提取国家
    const extractCountryFromAddress = (address: string | undefined): string[] | undefined => {
      if (!address) return undefined;
      const parts = address.split(',').map(p => p.trim());
      const country = parts[parts.length - 1];
      return countryToArray(country);
    };

    // 辅助函数：提取邮箱（支持多种格式）
    const extractEmail = (item: any): string => {
      return item.email || 
             item.emails?.[0] || 
             item.emailAddress || 
             item.contactEmail ||
             item.businessEmail ||
             '';
    };

    // 辅助函数：提取电话（支持多种格式）
    const extractPhone = (item: any): string => {
      return item.phone || 
             item.phones?.[0] || 
             item.phoneNumber || 
             item.contactPhone ||
             item.phoneUnformatted ||
             '';
    };

    // 辅助函数：根据抓取信息自动判断渠道类型
    const detectChannelType = (item: any, platform: string): string => {
      // 收集所有可用于分类的文本
      const texts = [
        item.categoryName || item.category || '',
        item.categories?.join(' ') || '',
        item.industry || item.industries?.join(' ') || '',
        item.main_products || item.products || item.services || '',
        item.description || item.about || item.biography || '',
        item.specialties?.join(' ') || '',
        item.companyName || item.name || item.title || '',
      ].filter(Boolean).join(' ').toLowerCase();

      // 关键词匹配规则（按优先级排序）- 与前端渠道类型统一
      const rules = [
        // 工厂/OEM
        { keywords: ['factory', 'manufacturer', 'manufacturing', 'production', 'oem', '工业', '制造', '工厂', '生产', '代工'], type: 'factory' },
        // 品牌代理商
        { keywords: ['brand agent', 'brand agent', 'authorized dealer', '品牌代理', '授权代理', '独家代理'], type: 'brand_agent' },
        // 经销商
        { keywords: ['wholesale', 'wholesaler', 'distributor', 'dealer', '批发', '分销', '经销'], type: 'distributor' },
        // 合资公司
        { keywords: ['joint venture', 'jv', '合资', '合作公司', '联营'], type: 'joint_venture' },
        // 商超
        { keywords: ['supermarket', 'hypermarket', 'grocery', 'mall', '商超', '超市', '卖场', '百货', '购物中心'], type: 'supermarket' },
        // 进出口商
        { keywords: ['import', 'export', 'trading company', 'trading', 'trade', '进出口', '贸易', '外贸', '跨国'], type: 'trading_company' },
        // 零售商
        { keywords: ['retail', 'retailer', 'store', 'shop', 'mart', '零售', '商店', '店铺'], type: 'retailer' },
        // 终端客户
        { keywords: ['end user', 'consumer', '终端', '最终用户'], type: 'end_customer' },
        // 工程商
        { keywords: ['construction', 'building', 'contractor', 'engineering', '建筑', '工程', '装修', '施工'], type: 'contractor' },
        // 服务商
        { keywords: ['agency', 'consulting', 'consultant', 'service', '服务', '咨询', '代理'], type: 'service_provider' },
      ];

      // 按优先级匹配
      for (const rule of rules) {
        if (rule.keywords.some(kw => texts.includes(kw))) {
          return rule.type;
        }
      }

      // 根据来源平台推断默认类型
      const platformDefaults: Record<string, string> = {
        'linkedin': 'trading_company',
        'instagram': 'brand_agent',
        'facebook': 'retailer',
        'yelp': 'service_provider',
        'yellow_pages': 'service_provider',
        'yellow_pages_world': 'service_provider',
        'google_maps': 'retailer',
        'forum': 'end_customer',
      };

      return platformDefaults[platform] || 'service_provider';
    };

    switch (platform) {
      // ===== Google Maps（最优：$2/1000条，95%+邮箱率）=====
      case 'google_maps':
      case 'google_maps_leads':
        customer = {
          ...customer,
          company_name: item.title || item.name || item.businessName || '未知公司',
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          industry: item.categoryName || item.category || taskIndustry.split(' ')[0],
          main_products: item.categories?.join(', ') || item.categoryName || '',
          contact_name: item.ownerName || item.proprietor || item.contactName || '',
          contact_phone: extractPhone(item),
          contact_email: extractEmail(item),
          annual_revenue: item.revenue || item.annualRevenue || '',
          annual_purchase: item.employeeCount || item.employeeSize || '',
          source_url: item.website || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'email_extractor':
        // 网站邮箱提取器
        customer = {
          ...customer,
          company_name: item.companyName || item.company || item.domain || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || item.contact || '',
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          industry: item.industry || taskIndustry.split(' ')[0],
          main_products: item.description || item.services || '',
          source_url: item.website || item.url || item.domain || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'linkedin':
        customer = {
          ...customer,
          company_name: item.name || item.companyName || '未知公司',
          country: countryToArray(item.headquarters?.country) || extractCountryFromAddress(item.headquarters?.city || item.location),
          industry: item.industries?.[0] || item.industry || taskIndustry.split(' ')[0],
          main_products: item.specialties?.join(', ') || '',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || '',
          annual_revenue: item.revenue || item.annualRevenue || '',
          annual_purchase: item.employeeCount || item.companySize || '',
          source_url: item.website || item.url || item.linkedinUrl || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'instagram':
        customer = {
          ...customer,
          company_name: item.fullName || item.username || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.fullName || item.username || '',
          industry: item.biography?.split('\n')[0] || taskIndustry.split(' ')[0],
          main_products: item.biography || '',
          source_url: item.url || `https://instagram.com/${item.username}`,
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'facebook':
        customer = {
          ...customer,
          company_name: item.name || item.pageName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          country: countryToArray(item.location?.country) || extractCountryFromAddress(item.location?.city),
          contact_name: item.ownerName || '',
          industry: item.category || item.about?.split('\n')[0] || taskIndustry.split(' ')[0],
          main_products: item.about || item.description || '',
          source_url: item.url || item.link || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      // ===== 商业目录 =====
      case 'yellow_pages_world':
        customer = {
          ...customer,
          company_name: item.businessName || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || '',
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          industry: item.category || taskIndustry.split(' ')[0],
          main_products: item.categories?.join(', ') || '',
          source_url: item.website || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'yelp':
        customer = {
          ...customer,
          company_name: item.name || item.businessName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.ownerName || '',
          country: countryToArray(item.location?.country) || ['United States'],
          industry: item.categories?.[0]?.title || taskIndustry.split(' ')[0],
          main_products: item.categories?.map((c: any) => c.title).join(', ') || '',
          source_url: item.url || item.website || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'forum':
        // 论坛数据可能来自 Reddit/Quora 等
        customer = {
          ...customer,
          company_name: item.author || item.username || item.companyMentioned || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: '',
          contact_name: item.author || item.username || '',
          country: countryToArray(item.location),
          industry: taskIndustry.split(' ')[0],
          main_products: item.title || item.question || '',
          source_url: item.url || item.permalink || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'reddit':
        customer = {
          ...customer,
          company_name: item.subreddit || item.author || '未知来源',
          contact_email: '',
          contact_phone: '',
          contact_name: item.author || '',
          country: undefined,
          industry: taskIndustry.split(' ')[0],
          main_products: item.title || item.selftext?.substring(0, 200) || '',
          source_url: item.url || `https://reddit.com${item.permalink}`,
          channel_type: 'end_customer',
        };
        break;

      case 'alibaba':
      case 'made_in_china':
        customer = {
          ...customer,
          company_name: item.companyName || item.company || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactPerson || item.contactName || '',
          country: countryToArray(item.country) || countryToArray(item.location) || ['China'],
          industry: item.mainProduct || item.category || taskIndustry.split(' ')[0],
          main_products: item.mainProduct || item.products || '',
          source_url: item.url || item.website || '',
          channel_type: 'factory',
        };
        break;

      case 'customs_data':
        customer = {
          ...customer,
          company_name: item.importerName || item.exporterName || item.companyName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactPerson || '',
          country: countryToArray(item.country) || countryToArray(item.originCountry),
          industry: item.hsCodeDescription || item.productDescription || taskIndustry.split(' ')[0],
          main_products: item.productDescription || item.goodsDescription || '',
          source_url: item.url || '',
          channel_type: 'trading_company',
          annual_purchase: item.value || item.quantity || '',
        };
        break;

      default:
        // 默认通用解析
        customer = {
          ...customer,
          company_name: item.name || item.title || item.companyName || item.businessName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          contact_name: item.contactName || item.contact_name || item.ownerName || '',
          industry: item.industry || item.category || taskIndustry.split(' ')[0],
          main_products: item.products || item.services || item.categories?.join(', ') || '',
          source_url: item.url || item.website || '',
          channel_type: detectChannelType(item, platform),
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

  // 根据国家自动选择语言
  const getLanguage = (country: string): string => {
    const langMap: Record<string, string> = {
      'France': 'fr', 'Spain': 'es', 'Germany': 'de', 'Italy': 'it',
      'Netherlands': 'nl', 'Poland': 'pl', 'Belgium': 'nl', 'Sweden': 'sv',
      'Norway': 'no', 'Denmark': 'da', 'Switzerland': 'de', 'Austria': 'de',
      'Portugal': 'pt', 'Brazil': 'pt', 'Mexico': 'es', 'Argentina': 'es',
      'Chile': 'es', 'Colombia': 'es', 'Japan': 'ja', 'South Korea': 'ko',
      'China': 'zh', 'Taiwan': 'zh', 'Russia': 'ru', 'Turkey': 'tr',
      'Saudi Arabia': 'ar', 'UAE': 'ar', 'Thailand': 'th', 'Vietnam': 'vi',
      'Indonesia': 'id',
    };
    return langMap[country] || 'en';
  };

  const country = countries[0] || '';
  const language = getLanguage(country);

  switch (platform) {
    // ===== Google Maps（官方版：评分4.7，稳定可靠）=====
    case 'google_maps':
    case 'google_maps_leads':
      // compass/crawler-google-places 官方版本
      // 免费版：获取商家名称、地址、电话、网站URL
      // 邮箱提取：需要从网站URL进一步提取（companyContactsEnrichment 是付费功能）
      
      // 计算每个关键词的结果数（总数/关键词数）
      const placesPerKeyword = Math.ceil(maxResults / Math.max(keywords.length, 1));
      
      return {
        actorId: APIFY_ACTORS.GOOGLE_MAPS,
        input: {
          // 搜索关键词数组
          searchStringsArray: keywords,
          // 地点查询（国家/城市）
          locationQuery: country,
          // 每个搜索的最大结果数（平均分配）
          maxCrawledPlacesPerSearch: placesPerKeyword,
          // 语言设置
          language,
          // ===== 邮箱提取策略 =====
          // companyContactsEnrichment 是付费功能，免费用户关闭
          // 免费方案：先获取网站URL → 后续用 Email Extractor 提取邮箱
          companyContactsEnrichment: false,
          socialMediaProfilesEnrichment: false,
          // ===== 其他配置 =====
          // 不抓取评论（加快速度）
          reviews: false,
          maxReviews: 0,
          // 不下载图片
          images: false,
          // 额外字段
          additionalInfo: true,
          openingHours: true,
          peopleAlsoSearch: false,
          // 搜索结果限制（严格限制总数）
          maxCrawledPlaces: maxResults,
          // 跳过关闭的商家
          skipClosedPlaces: false,
        },
      };

    case 'email_extractor':
      // 网站邮箱提取器 - 需要提供网站URL
      // 注意：这个 Actor 需要完整的网站URL，不是搜索关键词
      return {
        actorId: APIFY_ACTORS.EMAIL_EXTRACTOR,
        input: {
          urls: keywords.filter(k => k.startsWith('http')), // 只使用 URL 格式的关键词
        },
      };

    // ===== LinkedIn（支持关键词搜索+邮箱发现，无需登录）=====
    case 'linkedin':
      // 解析关键词：支持 "职位 地点" 格式或直接使用
      const firstKeyword = keywords[0] || '';
      return {
        actorId: APIFY_ACTORS.LINKEDIN,
        input: {
          // 职位搜索
          current_job_title: firstKeyword,
          // 地点筛选
          location: country || undefined,
          // 启用邮箱发现功能
          emailDiscovery: true,
          // 结果数量
          maxItems: maxResults,
        },
      };

    // ===== Facebook（支持搜索+联系方式提取）=====
    case 'facebook':
      return {
        actorId: APIFY_ACTORS.FACEBOOK,
        input: {
          // 搜索关键词
          searchQueries: keywords,
          // 最大结果数
          maxPages: maxResults,
          // 提取联系方式
          extractContacts: true,
        },
      };

    // ===== Instagram（支持关键词搜索用户）=====
    case 'instagram':
      return {
        actorId: APIFY_ACTORS.INSTAGRAM,
        input: {
          // 搜索查询
          searchQueries: keywords,
          // 搜索类型：用户
          searchType: 'user',
          // 结果数量
          resultsLimit: maxResults,
        },
      };

    // ===== 黄页（Apify 官方版）=====
    // ===== 黄页（Apify 官方版 - 美国）=====
    case 'yellow_pages':
      return {
        actorId: APIFY_ACTORS.YELLOW_PAGES,
        input: {
          // 搜索关键词
          search: keywords.join(' '),
          // 地点
          location: country,
          // 最大结果数
          maxItems: maxResults,
        },
      };

    // ===== Yelp（Apify 官方版）=====
    case 'yelp':
      return {
        actorId: APIFY_ACTORS.YELP,
        input: {
          // 搜索关键词
          searchTerms: keywords,
          // 地点
          location: country,
          // 最大结果数
          maxItems: maxResults,
        },
      };

    case 'forum':
      return {
        actorId: APIFY_ACTORS.FORUM,
        input: {
          keywords,
          maxThreads: maxResults,
        },
      };

    // ===== Reddit 社区 =====
    case 'reddit':
      return {
        actorId: APIFY_ACTORS.REDDIT,
        input: {
          searchQueries: keywords,
          maxPosts: maxResults,
          maxComments: 10,
        },
      };

    // ===== B2B 平台 =====
    case 'alibaba':
      return {
        actorId: APIFY_ACTORS.ALIBABA,
        input: {
          searchQueries: keywords,
          maxItems: maxResults,
        },
      };

    case 'made_in_china':
      return {
        actorId: APIFY_ACTORS.MADE_IN_CHINA,
        input: {
          keywords: keywords.join(' '),
          maxItems: maxResults,
        },
      };

    // ===== 海关数据 =====
    case 'customs_data':
      // 注意：海关数据需要配置第三方API
      // 这里使用自定义爬虫访问公开海关数据网站
      return {
        actorId: APIFY_ACTORS.CUSTOMS_DATA,
        input: {
          keywords,
          country,
          maxItems: maxResults,
        },
      };

    // ===== 全球黄页 =====
    case 'yellow_pages_world':
      return {
        actorId: APIFY_ACTORS.YELLOW_PAGES_WORLD,
        input: {
          search: keywords.join(' '),
          location: country,
          maxItems: maxResults,
        },
      };

    // ===== Leads Finder（高价值渠道，直接带邮箱）=====
    case 'leads_finder':
      return {
        actorId: APIFY_ACTORS.LEADS_FINDER,
        input: {
          // 职位筛选（使用关键词作为职位）
          contact_job_title: keywords,
          // 地点筛选
          contact_location: country ? [country] : [],
          // 只获取验证过的邮箱
          email_status: ['validated'],
          // 结果数量
          fetch_count: maxResults,
        },
      };

    // ===== ThomasNet（美国工业供应商）=====
    case 'thomasnet':
      return {
        actorId: APIFY_ACTORS.THOMASNET,
        input: {
          // 搜索URL（需要构建 ThomasNet 搜索URL）
          startUrls: [{
            url: `https://www.thomasnet.com/suppliers/discover?searchterm=${encodeURIComponent(keywords.join(' '))}&cov=NA&which=prod`
          }],
          // 最大结果数
          maxItems: maxResults,
        },
      };

    // ===== Crunchbase（创业公司/科技公司）=====
    case 'crunchbase':
      return {
        actorId: APIFY_ACTORS.CRUNCHBASE,
        input: {
          // 搜索关键词
          searchQueries: keywords,
          // 搜索类型
          type: 'companies',
          // 最大结果数
          maxItems: maxResults,
        },
      };

    // ===== Amazon卖家 =====
    case 'amazon_seller':
      return {
        actorId: APIFY_ACTORS.AMAZON_SELLER,
        input: {
          // 卖家ID或店铺URL
          sellerIds: keywords,
          // 最大结果数
          maxProducts: maxResults,
        },
      };

    // ===== Scrapling 自适应爬虫 =====
    case 'scrapling':
      // Scrapling 需要 URL 列表，不支持关键词搜索
      // 使用场景：用户输入网站 URL 进行爬取
      // 将关键词作为 URL 使用（需要是有效 URL）
      const urls = keywords.filter(k => k.startsWith('http') || k.startsWith('www'));
      return {
        actorId: APIFY_ACTORS.SCRAPLING,
        input: {
          mode: 'single',
          urls: urls.length > 0 ? urls : keywords.map(k => `https://www.google.com/search?q=${encodeURIComponent(k)}`),
          selectors: {
            title: 'h1',
            description: 'p',
            email: 'a[href^="mailto:"]',
            phone: 'a[href^="tel:"]',
          },
        },
      };

    default:
      // 默认使用 Google Maps（官方版：评分4.7）
      return {
        actorId: APIFY_ACTORS.GOOGLE_MAPS,
        input: {
          searchStringsArray: keywords,
          locationQuery: country,
          maxCrawledPlacesPerSearch: maxResults,
          language,
          companyContactsEnrichment: true,
          reviews: false,
          images: false,
        },
      };
  }
};
