import type { VercelRequest, VercelResponse } from '@vercel/node';

interface VerifyResponse {
  success: boolean;
  data?: {
    email: string;
    deliverable: boolean;
    score?: number;
    disposable?: boolean;
    free?: boolean;
    reason?: string;
  };
  error?: string;
  details?: string;
}

// Kickbox API 验证
async function verifyWithKickbox(apiKey: string, email: string): Promise<VerifyResponse> {
  const url = `https://api.kickbox.com/v2/verify?email=${encodeURIComponent(email)}&apikey=${apiKey}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok) {
    return { success: false, error: 'Kickbox API error', details: data.message || 'Unknown error' };
  }

  // Kickbox 返回: result = "deliverable", "undeliverable", "risky", "unknown"
  const deliverable = data.result === 'deliverable';
  const score = data.sendex ? Math.round(data.sendex * 100) : (deliverable ? 90 : 30);

  return {
    success: true,
    data: {
      email: data.email,
      deliverable,
      score,
      disposable: data.disposable === 'yes',
      free: data.free === 'yes',
      reason: data.reason,
    },
  };
}

// Emailable API 验证
async function verifyWithEmailable(apiKey: string, email: string): Promise<VerifyResponse> {
  const url = `https://api.emailable.com/v1/verify?email=${encodeURIComponent(email)}&api_key=${apiKey}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok) {
    return { success: false, error: 'Emailable API error', details: data.message || 'Unknown error' };
  }

  // Emailable 返回: state = "deliverable", "undeliverable", "risky", "unknown"
  const deliverable = data.state === 'deliverable';

  return {
    success: true,
    data: {
      email: data.email,
      deliverable,
      score: data.score || (deliverable ? 90 : 30),
      disposable: data.disposable,
      free: data.free,
      reason: data.reason,
    },
  };
}

// DeBounce API 验证
async function verifyWithDebounce(apiKey: string, email: string): Promise<VerifyResponse> {
  const url = `https://api.debounce.io/v1/?api=${apiKey}&email=${encodeURIComponent(email)}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok || data.error) {
    return { success: false, error: 'DeBounce API error', details: data.error || 'Unknown error' };
  }

  // DeBounce 返回: debounce = "True" (valid) or "False" (invalid)
  const deliverable = data.debounce?.result === 'True' || data.debounce?.code === '5';

  return {
    success: true,
    data: {
      email: data.debounce?.email || email,
      deliverable,
      score: deliverable ? 90 : 30,
      disposable: data.debounce?.disposable === 'yes',
      free: data.debounce?.free === 'yes',
      reason: data.debounce?.reason,
    },
  };
}

// MillionVerifier API 验证
async function verifyWithMillionVerifier(apiKey: string, email: string): Promise<VerifyResponse> {
  const url = `https://api.millionverifier.com/api/v3/?api=${apiKey}&email=${encodeURIComponent(email)}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok || data.error) {
    return { success: false, error: 'MillionVerifier API error', details: data.error || 'Unknown error' };
  }

  // MillionVerifier 返回: resultcode = 1 (valid), 2 (catch-all), 3 (unknown), 4 (invalid)
  const deliverable = data.resultcode === 1 || data.resultcode === 2;

  return {
    success: true,
    data: {
      email: data.email || email,
      deliverable,
      score: data.resultcode === 1 ? 95 : (data.resultcode === 2 ? 70 : 30),
      disposable: data.free === 'yes',
      free: data.free === 'yes',
      reason: data.result,
    },
  };
}

// Hunter.io API 验证
async function verifyWithHunter(apiKey: string, email: string): Promise<VerifyResponse> {
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok) {
    return { success: false, error: 'Hunter API error', details: data.errors?.[0]?.details || 'Unknown error' };
  }

  // Hunter 返回: result = "deliverable", "undeliverable", "risky", "invalid"
  const deliverable = data.data?.result === 'deliverable';
  const score = data.data?.score || (deliverable ? 90 : 30);

  return {
    success: true,
    data: {
      email: data.data?.email || email,
      deliverable,
      score,
      disposable: false,
      free: false,
      reason: data.data?.result,
    },
  };
}

// Abstract API 验证（保留兼容）
async function verifyWithAbstract(apiKey: string, email: string): Promise<VerifyResponse> {
  const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok) {
    return { success: false, error: 'Abstract API error', details: data.error?.message || 'Unknown error' };
  }

  const isValidFormat = data.is_valid_format?.value === true;
  const isDeliverable = data.deliverability === 'DELIVERABLE';
  const deliverable = isValidFormat && isDeliverable;

  return {
    success: true,
    data: {
      email: data.email,
      deliverable,
      score: deliverable ? 90 : 30,
      disposable: data.is_disposable_email?.value ?? false,
      free: data.is_free_email?.value ?? false,
      reason: data.deliverability,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 设置
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
    const { provider = 'abstract', apiKey, email } = req.body;

    // 参数校验
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    console.log(`[Verify Email] Provider: ${provider}, Email: ${email}`);

    let result: VerifyResponse;

    // 根据服务商选择验证方法
    switch (provider.toLowerCase()) {
      case 'kickbox':
        result = await verifyWithKickbox(apiKey, email);
        break;
      case 'emailable':
        result = await verifyWithEmailable(apiKey, email);
        break;
      case 'debounce':
        result = await verifyWithDebounce(apiKey, email);
        break;
      case 'millionverifier':
        result = await verifyWithMillionVerifier(apiKey, email);
        break;
      case 'hunter':
        result = await verifyWithHunter(apiKey, email);
        break;
      case 'abstract':
      default:
        result = await verifyWithAbstract(apiKey, email);
    }

    console.log(`[Verify Email] Result: ${result.success ? (result.data?.deliverable ? 'Valid' : 'Invalid') : 'Error'}`);

    return res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('[Verify Email] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
