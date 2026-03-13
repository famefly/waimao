import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ApiResponse {
  success: boolean;
  user?: string;
  error?: string;
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
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    console.log(`[Apify Check] Validating API Key...`);

    // 2. 修正后的 Apify API 端点
    // 使用 /v2/users/me 或 /v2/me 来验证用户身份
    const targetUrl = 'https://api.apify.com/v2/users/me';

    const apifyResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
    });

    const data = await apifyResponse.json();

    if (apifyResponse.ok) {
      console.log(`[Apify Check] Success. User: ${data.data?.username}`);
      return res.status(200).json({ 
        success: true, 
        user: data.data?.username 
      });
    } else {
      // 3. 详细的错误日志
      const errorMessage = data.error?.message || data.message || 'Apify API validation failed';
      console.error(`[Apify Check] Failed (${apifyResponse.status}): ${errorMessage}`);
      
      return res.status(apifyResponse.status).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error('[Apify Check] Network or Server Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}