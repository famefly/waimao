import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ApiResponse {
  success: boolean;
  error?: string;
  details?: string; // 用于显示更详细的错误信息
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

    console.log(`[Email Verify] Attempting to validate key...`);

    // Abstract API 的验证端点
    const apiUrl = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=test@example.com`;

    const response = await fetch(apiUrl);

    const data = await response.json();

    if (response.ok) {
      // Abstract API 即使成功也会返回 JSON 对象，包含 is_valid_format 等字段
      console.log(`[Email Verify] Key is valid.`);
      return res.status(200).json({ 
        success: true,
        message: 'API Key is valid'
      });
    } else {
      // 2. 详细错误处理
      // Abstract API 通常在 401/403 时返回 { error: "Error message" }
      const errorMessage = data.error || data.message || 'Unknown API Error';
      
      console.error(`[Email Verify] API Error (${response.status}): ${errorMessage}`);

      // 如果状态码是 401 或 403，大概率是 Key 错误
      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          success: false,
          error: 'Authentication Failed',
          details: errorMessage // 例如：显示 "Invalid API key"
        });
      }

      // 其他错误（如 429 请求过多，或 500 服务器错误）
      return res.status(response.status).json({
        success: false,
        error: 'API Request Failed',
        details: errorMessage
      });
    }
  } catch (error) {
    // 3. 捕获网络错误（如 API 地址写错、断网等）
    console.error('[Email Verify] Network/Code Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Network Error or Internal Server Error',
      details: error instanceof Error ? error.message : 'Failed to reach Abstract API'
    });
  }
}