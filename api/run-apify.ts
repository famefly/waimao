import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ApiResponse {
  success: boolean;
  runId?: string;
  status?: string;
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
    const { apiKey, actorId, input } = req.body;

    // 2. 参数校验
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    if (!actorId) {
      return res.status(400).json({ success: false, error: 'Actor ID is required' });
    }
    
    // 可选：如果 input 不是对象，报错
    if (input && typeof input !== 'object') {
      return res.status(400).json({ success: false, error: 'Input must be a JSON object' });
    }

    console.log(`[Run Apify] Starting actor: ${actorId}`);

    // 3. 发起请求
    // 使用 Header 传递 Token，更安全规范
    const apiUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input || {}),
    });

    const data = await response.json();

    if (response.ok) {
      // 4. 成功处理
      // Apify V2 API 返回结构通常是 { data: { id: '...', status: 'RUNNING' } }
      const runId = data.data?.id;
      const status = data.data?.status;

      console.log(`[Run Apify] Success. Run ID: ${runId}, Status: ${status}`);

      return res.status(200).json({
        success: true,
        runId,
        status,
      });
    } else {
      // 5. 错误处理
      // Apify 错误结构通常是 { error: { type: '...', message: '...' } }
      const errorMessage = data.error?.message || data.message || 'Failed to start actor';
      const errorType = data.error?.type;

      console.error(`[Run Apify] Failed (${response.status}): ${errorMessage}`);

      // 针对常见错误给出明确提示
      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          success: false,
          error: 'Authentication Failed',
          details: errorMessage // 例如 "Invalid token"
        });
      }

      if (response.status === 404) {
        return res.status(response.status).json({
          success: false,
          error: 'Actor Not Found',
          details: `Actor ID '${actorId}' does not exist or you don't have access.`
        });
      }

      // 其他错误
      return res.status(response.status).json({
        success: false,
        error: 'Actor Execution Failed',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('[Run Apify] Network Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Failed to connect to Apify'
    });
  }
}