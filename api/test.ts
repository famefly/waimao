import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, apiKey } = req.body;

  if (!type || !apiKey) {
    return res.status(400).json({ error: 'Missing type or apiKey' });
  }

  try {
    switch (type) {
      case 'apify':
        return await testApify(apiKey, res);
      case 'resend':
        return await testResend(apiKey, res);
      case 'zhipu':
        return await testZhipu(apiKey, res);
      case 'deepseek':
        return await testDeepSeek(apiKey, res);
      case 'emailVerify':
        return await testEmailVerify(apiKey, res);
      default:
        return res.status(400).json({ error: 'Unknown test type' });
    }
  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function testApify(apiKey: string, res: VercelResponse) {
  const response = await fetch('https://api.apify.com/v2/users/me', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  const data: any = await response.json();

  if (response.ok) {
    return res.status(200).json({ success: true, user: data.data?.username });
  } else {
    return res.status(response.status).json({
      success: false,
      error: data.error?.message || data.message || 'Apify API validation failed'
    });
  }
}

async function testResend(apiKey: string, res: VercelResponse) {
  const response = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (response.ok) {
    const data: any = await response.json();
    return res.status(200).json({ success: true, domains: data.data?.length || 0 });
  } else {
    const error: any = await response.json();
    return res.status(response.status).json({
      success: false,
      error: error.message || 'API 验证失败'
    });
  }
}

async function testZhipu(apiKey: string, res: VercelResponse) {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10,
    }),
  });

  if (response.ok) {
    return res.status(200).json({ success: true });
  } else {
    const error: any = await response.json();
    return res.status(response.status).json({
      success: false,
      error: error.error?.message || 'API 验证失败'
    });
  }
}

async function testDeepSeek(apiKey: string, res: VercelResponse) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10,
    }),
  });

  if (response.ok) {
    return res.status(200).json({ success: true });
  } else {
    const error: any = await response.json();
    return res.status(response.status).json({
      success: false,
      error: error.error?.message || 'API 验证失败'
    });
  }
}

async function testEmailVerify(apiKey: string, res: VercelResponse) {
  const response = await fetch(
    `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=test@example.com`
  );

  const data: any = await response.json();

  if (response.ok) {
    return res.status(200).json({ success: true, message: 'API Key is valid' });
  } else {
    const errorMessage = data.error || data.message || 'Unknown API Error';
    return res.status(response.status).json({
      success: false,
      error: response.status === 401 || response.status === 403 ? 'Authentication Failed' : 'API Request Failed',
      details: errorMessage
    });
  }
}
