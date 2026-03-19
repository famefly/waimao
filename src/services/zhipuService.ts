// AI 服务（通过 API Routes）
// 支持多个免费模型：智谱 GLM、DeepSeek 等
// 文档: https://open.bigmodel.cn/dev/api

import { getSupabase } from '../lib/supabase';

// 获取智谱 API Key
export const getZhipuApiKey = async (): Promise<string | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('api_configs')
    .select('key_value')
    .eq('key_name', 'zhipu_api_key')
    .single();

  return (data as { key_value: string } | null)?.key_value || null;
};

// 获取 DeepSeek API Key
export const getDeepSeekApiKey = async (): Promise<string | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('api_configs')
    .select('key_value')
    .eq('key_name', 'deepseek_api_key')
    .single();

  return (data as { key_value: string } | null)?.key_value || null;
};

// 客户类型对应的邮件模板策略
export const EMAIL_TEMPLATES = {
  // 品牌代理商
  brand_agent: {
    name: '品牌代理商',
    focus: '品牌合作、市场推广、独家代理权',
    tone: '专业、合作共赢',
  },
  // 经销商
  distributor: {
    name: '经销商',
    focus: '批量采购优惠、快速发货、售后支持',
    tone: '商务、实惠',
  },
  // 工厂OEM
  factory_oem: {
    name: 'OEM工厂',
    focus: '定制生产、技术支持、质量保证',
    tone: '技术、专业',
  },
  // 合资公司
  joint_venture: {
    name: '合资公司',
    focus: '战略合作、长期发展、资源共享',
    tone: '战略、长远',
  },
  // 终端客户
  end_customer: {
    name: '终端客户',
    focus: '产品质量、价格优势、快速交付',
    tone: '友好、服务',
  },
  // 工程商
  contractor: {
    name: '工程商',
    focus: '项目供货、技术方案、工程配套',
    tone: '专业、可靠',
  },
  // 服务商
  service_provider: {
    name: '服务商',
    focus: '合作模式、服务支持、共同发展',
    tone: '合作、共赢',
  },
};

// 语言映射
export const LANGUAGES: Record<string, { name: string; code: string }> = {
  en: { name: 'English', code: 'en' },
  es: { name: 'Español', code: 'es' },
  fr: { name: 'Français', code: 'fr' },
  de: { name: 'Deutsch', code: 'de' },
  pt: { name: 'Português', code: 'pt' },
  ru: { name: 'Русский', code: 'ru' },
  ar: { name: 'العربية', code: 'ar' },
  ja: { name: '日本語', code: 'ja' },
  ko: { name: '한국어', code: 'ko' },
  zh: { name: '中文', code: 'zh' },
  it: { name: 'Italiano', code: 'it' },
  nl: { name: 'Nederlands', code: 'nl' },
  pl: { name: 'Polski', code: 'pl' },
  tr: { name: 'Türkçe', code: 'tr' },
  th: { name: 'ไทย', code: 'th' },
  vi: { name: 'Tiếng Việt', code: 'vi' },
};

// 国家到语言的映射
export const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  'United States': 'en',
  'United Kingdom': 'en',
  'Canada': 'en',
  'Australia': 'en',
  'Spain': 'es',
  'Mexico': 'es',
  'Argentina': 'es',
  'Colombia': 'es',
  'France': 'fr',
  'Germany': 'de',
  'Austria': 'de',
  'Switzerland': 'de',
  'Portugal': 'pt',
  'Brazil': 'pt',
  'Russia': 'ru',
  'Saudi Arabia': 'ar',
  'UAE': 'ar',
  'Egypt': 'ar',
  'Japan': 'ja',
  'South Korea': 'ko',
  'China': 'zh',
  'Taiwan': 'zh',
  'Hong Kong': 'zh',
  'Italy': 'it',
  'Netherlands': 'nl',
  'Poland': 'pl',
  'Turkey': 'tr',
  'Thailand': 'th',
  'Vietnam': 'vi',
};

export interface GenerateEmailParams {
  customerName: string;
  companyName: string;
  country: string | string[];
  industry: string;
  channelType: keyof typeof EMAIL_TEMPLATES;
  mainProducts?: string;
  targetLanguage?: string;
}

export interface GeneratedEmail {
  subject: string;
  content: string;
  language: string;
  usedModel?: string;
}

// 使用 AI 生成开发信（通过 API Routes，支持多模型自动切换）
export const generateDevelopmentEmail = async (
  params: GenerateEmailParams
): Promise<GeneratedEmail> => {
  const zhipuApiKey = await getZhipuApiKey();
  const deepseekApiKey = await getDeepSeekApiKey();

  if (!zhipuApiKey && !deepseekApiKey) {
    throw new Error('请至少配置一个 AI API Key（智谱 GLM 或 DeepSeek）');
  }

  const {
    customerName,
    companyName,
    country,
    industry,
    channelType,
    mainProducts,
    targetLanguage,
  } = params;

  // 处理 country 字段：如果是数组则取第一个或合并为字符串
  const countryStr = Array.isArray(country) 
    ? (country.length > 0 ? country[0] : '') 
    : country;

  try {
    const response = await fetch('/api/generate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: zhipuApiKey,
        deepseekApiKey,
        customerName,
        companyName,
        country: countryStr,
        industry,
        channelType,
        mainProducts,
        targetLanguage,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'AI 调用失败');
    }

    return {
      subject: result.subject,
      content: result.content,
      language: result.language,
      usedModel: result.usedModel,
    };
  } catch (error) {
    console.error('AI API 错误:', error);
    throw error;
  }
};

// 批量生成开发信
export const generateEmailsBatch = async (
  customers: Array<{
    id: string;
    contact_name: string;
    company_name: string;
    country: string | string[];
    industry: string;
    channel_type: string;
    main_products?: string;
  }>,
  onProgress?: (processed: number, total: number) => void
): Promise<Array<{ customerId: string; email: GeneratedEmail }>> => {
  const results: Array<{ customerId: string; email: GeneratedEmail }> = [];
  const total = customers.length;

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    
    try {
      // 处理 country 字段：如果是数组则取第一个或合并为字符串
      const countryStr = Array.isArray(customer.country) 
        ? (customer.country.length > 0 ? customer.country[0] : '') 
        : customer.country;

      const email = await generateDevelopmentEmail({
        customerName: customer.contact_name,
        companyName: customer.company_name,
        country: countryStr,
        industry: customer.industry,
        channelType: (customer.channel_type as keyof typeof EMAIL_TEMPLATES) || 'distributor',
        mainProducts: customer.main_products,
      });

      results.push({ customerId: customer.id, email });
    } catch (error) {
      console.error(`生成邮件失败 (${customer.company_name}):`, error);
      // 继续处理下一个
    }

    onProgress?.(i + 1, total);

    // 添加延迟避免API限流
    if (i < customers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
};