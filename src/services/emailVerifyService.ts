// 邮箱验证服务
// 支持多种验证服务商：Kickbox, Emailable, Hunter, DeBounce, MillionVerifier, Abstract

import { getSupabase } from '../lib/supabase';

// 支持的邮箱验证服务商
export const EMAIL_VERIFY_PROVIDERS = {
  // ===== 推荐服务商（有免费额度） =====
  kickbox: {
    name: 'Kickbox',
    freeCredits: 500,
    pricePerEmail: 0.005,
    website: 'https://kickbox.com',
    signupUrl: 'https://kickbox.com/pricing/',
    features: ['Sendex质量评分', '快速验证', 'Catch-all检测'],
    recommended: true,
  },
  emailable: {
    name: 'Emailable',
    freeCredits: 250,
    pricePerEmail: 0.006,
    website: 'https://emailable.com',
    signupUrl: 'https://emailable.com/pricing',
    features: ['99%送达率保证', '名字/性别提取', '拼写纠错'],
    recommended: true,
  },
  debounce: {
    name: 'DeBounce',
    freeCredits: 100,
    pricePerEmail: 0.002,
    website: 'https://debounce.io',
    signupUrl: 'https://debounce.io/pricing/',
    features: ['最低价格', '积分永不过期', '反灰名单技术'],
    recommended: true,
  },
  millionverifier: {
    name: 'MillionVerifier',
    freeCredits: 200,
    pricePerEmail: 0.0037,
    website: 'https://millionverifier.com',
    signupUrl: 'https://millionverifier.com/pricing',
    features: ['大批量优惠', '快速处理', '积分永不过期'],
    recommended: true,
  },
  // ===== 其他服务商 =====
  hunter: {
    name: 'Hunter.io',
    freeCredits: 50,
    pricePerEmail: 0.017,
    website: 'https://hunter.io',
    signupUrl: 'https://hunter.io/pricing',
    features: ['邮箱查找+验证', 'Chrome扩展', '冷邮件工具'],
    recommended: false,
  },
  abstract: {
    name: 'Abstract API',
    freeCredits: 100,
    pricePerEmail: 0.0018,
    website: 'https://abstractapi.com',
    signupUrl: 'https://app.abstractapi.com/api/email-validation/pricing',
    features: ['简单API', '快速响应', '每月重置'],
    recommended: false,
  },
  clearout: {
    name: 'Clearout',
    freeCredits: 100,
    pricePerEmail: 0.007,
    website: 'https://clearout.io',
    signupUrl: 'https://clearout.io/pricing',
    features: ['邮箱查找工具', 'LinkedIn扩展', '积分永不过期'],
    recommended: false,
  },
  emaillistverify: {
    name: 'EmailListVerify',
    freeCredits: 100,
    pricePerEmail: 0.004,
    website: 'https://emaillistverify.com',
    signupUrl: 'https://emaillistverify.com/pricing/',
    features: ['便宜批量验证', '垃圾邮件陷阱检测', '简单易用'],
    recommended: false,
  },
  verifalia: {
    name: 'Verifalia',
    freeCredits: 25,
    pricePerEmail: 0.009,
    website: 'https://verifalia.com',
    signupUrl: 'https://verifalia.com/pricing',
    features: ['GDPR合规', 'EU数据驻留', '每日免费额度'],
    recommended: false,
  },
};

// 一次性邮箱域名列表
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com',
  'mailinator.com', 'throwaway.email', 'fakeinbox.com',
  'temp-mail.org', 'getnada.com', 'mohmal.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'grr.la', 'guerrillamailblock.com', 'pokemail.net',
  'spam4.me', 'gustr.com', 'incognitomail.com',
];

// 邮箱格式正则表达式
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  formatValid: boolean;
  isDisposable: boolean;
  mxValid: boolean | null;
  score: number;
  reason?: string;
  provider?: string;
}

// 验证邮箱格式
export const validateEmailFormat = (email: string): boolean => {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
};

// 检查是否是一次性邮箱
export const isDisposableEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
};

// 获取配置的邮箱验证服务商
export const getEmailVerifyProvider = async (): Promise<{ provider: string; apiKey: string } | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    // 优先使用 kickbox（推荐）
    const { data: kickboxKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'kickbox_api_key')
      .single();

    if ((kickboxKey as { key_value: string } | null)?.key_value) {
      return { provider: 'kickbox', apiKey: (kickboxKey as { key_value: string }).key_value };
    }

    // 尝试 emailable
    const { data: emailableKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'emailable_api_key')
      .single();

    if ((emailableKey as { key_value: string } | null)?.key_value) {
      return { provider: 'emailable', apiKey: (emailableKey as { key_value: string }).key_value };
    }

    // 尝试 debounce
    const { data: debounceKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'debounce_api_key')
      .single();

    if ((debounceKey as { key_value: string } | null)?.key_value) {
      return { provider: 'debounce', apiKey: (debounceKey as { key_value: string }).key_value };
    }

    // 尝试 millionverifier
    const { data: mvKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'millionverifier_api_key')
      .single();

    if ((mvKey as { key_value: string } | null)?.key_value) {
      return { provider: 'millionverifier', apiKey: (mvKey as { key_value: string }).key_value };
    }

    // 尝试 hunter
    const { data: hunterKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'hunter_api_key')
      .single();

    if ((hunterKey as { key_value: string } | null)?.key_value) {
      return { provider: 'hunter', apiKey: (hunterKey as { key_value: string }).key_value };
    }

    // 兼容旧配置
    const { data: legacyKey } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'email_verify_api_key')
      .single();

    if ((legacyKey as { key_value: string } | null)?.key_value) {
      return { provider: 'abstract', apiKey: (legacyKey as { key_value: string }).key_value };
    }

    return null;
  } catch (error) {
    console.error('获取邮箱验证配置失败:', error);
    return null;
  }
};

// 使用外部 API 验证邮箱
export const verifyEmailWithApi = async (email: string): Promise<EmailVerificationResult> => {
  const result: EmailVerificationResult = {
    email,
    isValid: false,
    formatValid: validateEmailFormat(email),
    isDisposable: isDisposableEmail(email),
    mxValid: null,
    score: 0,
  };

  if (!result.formatValid) {
    result.reason = '邮箱格式无效';
    return result;
  }

  if (result.isDisposable) {
    result.reason = '一次性邮箱';
    return result;
  }

  // 获取配置的服务商
  const config = await getEmailVerifyProvider();

  if (!config) {
    // 无 API Key 时，使用基本验证
    result.score = 70;
    result.isValid = true;
    result.reason = '本地验证（未配置API）';
    return result;
  }

  try {
    // 调用后端 API 进行验证
    const response = await fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        provider: config.provider,
        apiKey: config.apiKey, 
        email 
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        result.mxValid = data.data.deliverable === true;
        result.isDisposable = data.data.disposable ?? result.isDisposable;
        result.isValid = data.data.deliverable === true;
        result.score = data.data.score || (result.isValid ? 90 : 30);
        result.provider = config.provider;
      }
    } else {
      // API 失败时回退到本地验证
      result.score = 70;
      result.isValid = true;
      result.reason = '本地验证（API暂时不可用）';
    }
  } catch (error) {
    console.error('Email verification API error:', error);
    result.score = 70;
    result.isValid = true;
    result.reason = '本地验证（网络错误）';
  }

  return result;
};

// 批量验证邮箱
export const verifyEmailsBatch = async (
  emails: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<EmailVerificationResult[]> => {
  const results: EmailVerificationResult[] = [];
  const total = emails.length;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    // 先做快速本地验证
    const formatValid = validateEmailFormat(email);
    const isDisposable = isDisposableEmail(email);
    
    if (!formatValid || isDisposable) {
      results.push({
        email,
        isValid: false,
        formatValid,
        isDisposable,
        mxValid: null,
        score: 0,
        reason: !formatValid ? '格式无效' : '一次性邮箱',
      });
    } else {
      // 对于格式正确的邮箱，进行API验证
      const result = await verifyEmailWithApi(email);
      results.push(result);
    }

    onProgress?.(i + 1, total);

    // 添加延迟避免API限流（根据服务商调整）
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
};

// 更新数据库中的邮箱验证状态
export const updateCustomerEmailStatus = async (
  customerId: string,
  isValid: boolean
): Promise<void> => {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from('customers')
    .update({
      email_verified: isValid,
      status: isValid ? 'verified' : 'invalid',
    })
    .eq('id', customerId);
};