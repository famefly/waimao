// 电话验证服务
// 支持多种验证服务商：NumVerify, Abstract, Twilio, NumLookup

import { getSupabase } from '../lib/supabase';

// 支持的电话验证服务商
export const PHONE_VERIFY_PROVIDERS = {
  // ===== 推荐服务商（有免费额度） =====
  numverify: {
    name: 'NumVerify',
    freeCredits: 100,
    pricePerRequest: 0.003,
    website: 'https://numverify.com',
    signupUrl: 'https://numverify.com/signup/free/yearly',
    features: ['232国家支持', '运营商检测', '线路类型检测', '地理位置'],
    recommended: true,
  },
  abstract: {
    name: 'Abstract Phone',
    freeCredits: 250,
    pricePerRequest: 0.003,
    website: 'https://abstractapi.com/phone-validation-api',
    signupUrl: 'https://app.abstractapi.com/api/phone-validation/pricing',
    features: ['免费250次/月', '运营商信息', '线路类型', '快速响应'],
    recommended: true,
  },
  numlookup: {
    name: 'NumLookup',
    freeCredits: 100,
    pricePerRequest: 0.002,
    website: 'https://numlookupapi.com',
    signupUrl: 'https://numlookupapi.com/pricing',
    features: ['免费100次/月', '最低价格', '运营商检测', '名称查找'],
    recommended: true,
  },
  // ===== 其他服务商 =====
  twilio: {
    name: 'Twilio Lookup',
    freeCredits: 0,
    pricePerRequest: 0.015,
    website: 'https://www.twilio.com/lookup',
    signupUrl: 'https://www.twilio.com/try-twilio',
    features: ['企业级', 'Caller ID', '短信验证', '通话验证'],
    recommended: false,
  },
  neutrinoapi: {
    name: 'Neutrino API',
    freeCredits: 100,
    pricePerRequest: 0.001,
    website: 'https://neutrinoapi.com/phone-validate/',
    signupUrl: 'https://neutrinoapi.com/plans/',
    features: ['免费100次', '最低价格', '运营商检测', '国际号码'],
    recommended: false,
  },
};

// 国际电话号码格式正则
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export interface PhoneVerificationResult {
  phone: string;
  isValid: boolean;
  formatValid: boolean;
  countryCode?: string;
  countryName?: string;
  carrier?: string;
  lineType?: string;
  score: number;
  reason?: string;
  provider?: string;
}

// 验证电话格式（基本）
export const validatePhoneFormat = (phone: string): boolean => {
  if (!phone) return false;
  // 移除空格、括号、横线
  const cleaned = phone.replace(/[\s\(\)\-\.]/g, '');
  return PHONE_REGEX.test(cleaned);
};

// 清理电话号码
export const cleanPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/[\s\(\)\-\.]/g, '');
};

// 获取配置的电话验证服务商
export const getPhoneVerifyProvider = async (): Promise<{ provider: string; apiKey: string } | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    // 优先使用 numverify（推荐）
    const { data: numverifyKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'numverify_api_key')
      .single();

    if ((numverifyKey as { key_value: string } | null)?.key_value) {
      return { provider: 'numverify', apiKey: (numverifyKey as { key_value: string }).key_value };
    }

    // 尝试 abstract
    const { data: abstractKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'abstract_phone_api_key')
      .single();

    if ((abstractKey as { key_value: string } | null)?.key_value) {
      return { provider: 'abstract', apiKey: (abstractKey as { key_value: string }).key_value };
    }

    // 尝试 numlookup
    const { data: numlookupKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'numlookup_api_key')
      .single();

    if ((numlookupKey as { key_value: string } | null)?.key_value) {
      return { provider: 'numlookup', apiKey: (numlookupKey as { key_value: string }).key_value };
    }

    // 尝试 neutrinoapi
    const { data: neutrinoKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'neutrino_api_key')
      .single();

    if ((neutrinoKey as { key_value: string } | null)?.key_value) {
      return { provider: 'neutrinoapi', apiKey: (neutrinoKey as { key_value: string }).key_value };
    }

    return null;
  } catch (error) {
    console.error('获取电话验证配置失败:', error);
    return null;
  }
};

// 使用外部 API 验证电话
export const verifyPhoneWithApi = async (phone: string): Promise<PhoneVerificationResult> => {
  const cleanedPhone = cleanPhoneNumber(phone);
  
  const result: PhoneVerificationResult = {
    phone: cleanedPhone,
    isValid: false,
    formatValid: validatePhoneFormat(cleanedPhone),
    score: 0,
  };

  if (!result.formatValid) {
    result.reason = '电话格式无效';
    return result;
  }

  // 获取配置的服务商
  const config = await getPhoneVerifyProvider();

  if (!config) {
    // 无 API Key 时，使用基本验证
    result.score = 60;
    result.isValid = true;
    result.reason = '本地验证（未配置API）';
    return result;
  }

  try {
    // 调用后端 API 进行验证
    const response = await fetch('/api/verify-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        provider: config.provider,
        apiKey: config.apiKey, 
        phone: cleanedPhone 
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        result.isValid = data.data.valid === true;
        result.countryCode = data.data.countryCode;
        result.countryName = data.data.countryName;
        result.carrier = data.data.carrier;
        result.lineType = data.data.lineType;
        result.score = data.data.score || (result.isValid ? 90 : 30);
        result.provider = config.provider;
      }
    } else {
      // API 失败时回退到本地验证
      result.score = 60;
      result.isValid = true;
      result.reason = '本地验证（API暂时不可用）';
    }
  } catch (error) {
    console.error('Phone verification API error:', error);
    result.score = 60;
    result.isValid = true;
    result.reason = '本地验证（网络错误）';
  }

  return result;
};

// 批量验证电话
export const verifyPhonesBatch = async (
  phones: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<PhoneVerificationResult[]> => {
  const results: PhoneVerificationResult[] = [];
  const total = phones.length;

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    
    // 先做快速本地验证
    const formatValid = validatePhoneFormat(cleanPhoneNumber(phone));
    
    if (!formatValid) {
      results.push({
        phone: cleanPhoneNumber(phone),
        isValid: false,
        formatValid,
        score: 0,
        reason: '格式无效',
      });
    } else {
      // 对于格式正确的电话，进行API验证
      const result = await verifyPhoneWithApi(phone);
      results.push(result);
    }

    onProgress?.(i + 1, total);

    // 添加延迟避免API限流
    if (i < phones.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
};

// 更新数据库中的电话验证状态
export const updateCustomerPhoneStatus = async (
  customerId: string,
  isValid: boolean
): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from('customers')
    .update({
      phone_verified: isValid,
    })
    .eq('id', customerId);
};
