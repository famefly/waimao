// 邮箱验证服务
// 支持多种验证方式：格式验证、MX记录检查、一次性邮箱检测

import { getSupabase } from '../lib/supabase';

// 一次性邮箱域名列表（常见的临时邮箱）
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com',
  'mailinator.com', 'throwaway.email', 'fakeinbox.com',
  'temp-mail.org', 'getnada.com', 'mohmal.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com'
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

// 使用免费的 emailvalidation.io API 验证（可选）
export const verifyEmailWithApi = async (email: string): Promise<EmailVerificationResult> => {
  const supabase = getSupabase();
  let apiKey: string | null = null;
  
  if (supabase) {
    const { data } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'email_verify_api_key')
      .single();
    apiKey = (data as { key_value: string } | null)?.key_value || null;
  }

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

  // 如果有 API Key，使用外部服务验证（通过 API Routes）
  if (apiKey) {
    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, email }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          result.mxValid = data.data.deliverability === 'DELIVERABLE';
          result.isDisposable = data.data.isDisposable ?? result.isDisposable;
          result.isValid = data.data.isValid;
          result.score = result.isValid ? 90 : 30;
        }
      }
    } catch (error) {
      console.error('Email verification API error:', error);
    }
  } else {
    // 无 API Key 时，使用基本验证
    result.score = result.formatValid && !result.isDisposable ? 70 : 0;
    result.isValid = result.score >= 50;
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
      // 对于格式正确的邮箱，进行API验证（如果配置了）
      const result = await verifyEmailWithApi(email);
      results.push(result);
    }

    onProgress?.(i + 1, total);

    // 添加小延迟避免API限流
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
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
