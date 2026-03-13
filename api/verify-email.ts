import type { VercelRequest, VercelResponse } from '@vercel/node';

interface VerifyResponse {
  success: boolean;
  data?: {
    email: string;
    isValid: boolean;
    deliverability: string;
    isDisposable: boolean | null;
    isFreeEmail: boolean | null;
  };
  error?: string;
  details?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { apiKey, email } = req.body;

    // 2. 参数校验
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    console.log(`[Verify Email] Checking email: ${email}`);

    // 3. 请求 Abstract API
    const apiUrl = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (response.ok) {
      // 4. 数据处理：增加安全判断
      // Abstract API 的返回结构中，is_valid_format 是一个对象 { value: true, ... }
      const isValidFormat = data.is_valid_format?.value === true;
      const isDeliverable = data.deliverability === 'DELIVERABLE';
      
      // 综合判断邮箱是否有效：格式正确 且 可投递
      const isActuallyValid = isValidFormat && isDeliverable;

      console.log(`[Verify Email] Result: ${isActuallyValid ? 'Valid' : 'Invalid'}`);

      return res.status(200).json({
        success: true,
        data: {
          email: data.email,
          isValid: isActuallyValid,
          deliverability: data.deliverability,
          isDisposable: data.is_disposable_email?.value ?? null, // 使用 ?? 确保返回 null 而不是 undefined
          isFreeEmail: data.is_free_email?.value ?? null,
        },
      } as VerifyResponse);
    } else {
      // 5. 错误处理：区分 Key 错误和其他错误
      const errorMessage = data.error || 'Unknown API Error';
      console.error(`[Verify Email] API Error (${response.status}): ${errorMessage}`);

      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          success: false,
          error: 'Authentication Failed',
          details: errorMessage // 例如 "Invalid API key"
        });
      }

      return res.status(response.status).json({
        success: false,
        error: 'Email verification failed',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('[Verify Email] Network Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Failed to reach Abstract API'
    });
  }
}