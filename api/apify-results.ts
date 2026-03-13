import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ResultsResponse {
  success: boolean;
  data?: any[];
  total?: number;
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
    const { apiKey, runId, limit = 100, offset = 0 } = req.body;

    // 2. 参数校验
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    if (!runId) {
      return res.status(400).json({ success: false, error: 'Run ID is required' });
    }

    console.log(`[Apify Results] Fetching items for run: ${runId} (Limit: ${limit}, Offset: ${offset})`);

    // 3. 构建请求 URL
    // 使用 clean=true 清理输出字符串中的特殊字符
    // 使用 limit 和 offset 进行分页
    const apiUrl = new URL(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`);
    apiUrl.searchParams.append('clean', 'true');
    
    // 只有在 limit > 0 时才添加参数（避免传 0 导致 API 报错）
    if (limit > 0) {
        apiUrl.searchParams.append('limit', limit.toString());
    }
    if (offset > 0) {
        apiUrl.searchParams.append('offset', offset.toString());
    }

    // 4. 发起请求
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      // 处理空数据情况
      const items = Array.isArray(data) ? data : [];
      
      console.log(`[Apify Results] Fetched ${items.length} items.`);

      return res.status(200).json({
        success: true,
        data: items,
        // 注意：这里没有返回 total，因为 Apify 基础端点不直接返回总数，
        // 如果需要总数，需要调用 dataset 端点，这里为了保持轻量暂不包含。
      } as ResultsResponse);
    } else {
      // 5. 错误处理
      let errorMessage = 'Failed to fetch results';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch (e) {
        // 如果返回的不是 JSON，忽略解析错误
      }

      console.error(`[Apify Results] Error (${response.status}): ${errorMessage}`);

      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Dataset Not Found',
          details: `Run ID '${runId}' does not exist or has no dataset.`
        });
      }

      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch results',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('[Apify Results] Network Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Failed to connect to Apify'
    });
  }
}