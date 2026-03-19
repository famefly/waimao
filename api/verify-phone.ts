import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PhoneVerifyResponse {
  success: boolean;
  data?: {
    phone: string;
    valid: boolean;
    countryCode?: string;
    countryName?: string;
    carrier?: string;
    lineType?: string;
    score?: number;
  };
  error?: string;
  details?: string;
}

// NumVerify API 验证
async function verifyWithNumVerify(apiKey: string, phone: string): Promise<PhoneVerifyResponse> {
  // NumVerify 需要 access_key 参数
  const url = `https://apilayer.net/api/validate?access_key=${apiKey}&number=${encodeURIComponent(phone)}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok || data.error) {
    return { 
      success: false, 
      error: 'NumVerify API error', 
      details: data.error?.info || data.error?.message || 'Unknown error' 
    };
  }

  // NumVerify 返回 valid: true/false
  const valid = data.valid === true;

  return {
    success: true,
    data: {
      phone: data.number || phone,
      valid,
      countryCode: data.country_code,
      countryName: data.country_name,
      carrier: data.carrier,
      lineType: data.line_type,
      score: valid ? 90 : 30,
    },
  };
}

// Abstract API 验证
async function verifyWithAbstract(apiKey: string, phone: string): Promise<PhoneVerifyResponse> {
  const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${encodeURIComponent(phone)}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok) {
    return { 
      success: false, 
      error: 'Abstract API error', 
      details: data.error?.message || 'Unknown error' 
    };
  }

  // Abstract 返回 valid: true/false
  const valid = data.valid === true;

  return {
    success: true,
    data: {
      phone: data.phone || phone,
      valid,
      countryCode: data.country?.code,
      countryName: data.country?.name,
      carrier: data.carrier,
      lineType: data.type,
      score: valid ? 90 : 30,
    },
  };
}

// NumLookup API 验证
async function verifyWithNumLookup(apiKey: string, phone: string): Promise<PhoneVerifyResponse> {
  // NumLookup API 格式
  const url = `https://api.numlookupapi.com/v1/validate/${encodeURIComponent(phone)}?apikey=${apiKey}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok) {
    return { 
      success: false, 
      error: 'NumLookup API error', 
      details: data.message || 'Unknown error' 
    };
  }

  // NumLookup 返回 valid: true/false
  const valid = data.valid === true;

  return {
    success: true,
    data: {
      phone: data.number || phone,
      valid,
      countryCode: data.country_code,
      countryName: data.country_name,
      carrier: data.carrier,
      lineType: data.line_type,
      score: valid ? 90 : 30,
    },
  };
}

// Neutrino API 验证
async function verifyWithNeutrino(apiKey: string, phone: string): Promise<PhoneVerifyResponse> {
  // Neutrino 需要 user_id 和 API key
  // 假设 apiKey 格式为 "user_id:api_key"
  const [userId, apiKeyPart] = apiKey.split(':');
  
  const url = `https://neutrinoapi.net/phone-validate?user-id=${userId}&api-key=${apiKeyPart}&number=${encodeURIComponent(phone)}`;
  
  const response = await fetch(url);
  const data: any = await response.json();

  if (!response.ok) {
    return { 
      success: false, 
      error: 'Neutrino API error', 
      details: data.api_error_msg || 'Unknown error' 
    };
  }

  // Neutrino 返回 valid: true/false
  const valid = data.valid === true;

  return {
    success: true,
    data: {
      phone: data.number || phone,
      valid,
      countryCode: data.country_code,
      countryName: data.country,
      carrier: data.carrier,
      lineType: data.type,
      score: valid ? 90 : 30,
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
    const { provider = 'numverify', apiKey, phone } = req.body;

    // 参数校验
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone is required' });
    }

    console.log(`[Verify Phone] Provider: ${provider}, Phone: ${phone}`);

    let result: PhoneVerifyResponse;

    // 根据服务商选择验证方法
    switch (provider.toLowerCase()) {
      case 'numverify':
        result = await verifyWithNumVerify(apiKey, phone);
        break;
      case 'abstract':
        result = await verifyWithAbstract(apiKey, phone);
        break;
      case 'numlookup':
        result = await verifyWithNumLookup(apiKey, phone);
        break;
      case 'neutrinoapi':
        result = await verifyWithNeutrino(apiKey, phone);
        break;
      default:
        result = await verifyWithNumVerify(apiKey, phone);
    }

    console.log(`[Verify Phone] Result: ${result.success ? (result.data?.valid ? 'Valid' : 'Invalid') : 'Error'}`);

    return res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('[Verify Phone] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
