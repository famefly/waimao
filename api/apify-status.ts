import type { VercelRequest, VercelResponse } from '@vercel/node';

interface StatusResponse {
  success: boolean;
  status?: string; // READY, RUNNING, SUCCEEDED, FAILED, ABORTING, ABORTED, TIMED-OUT, TIMING-OUT
  finishedAt?: string;
  usage?: {
    ACTOR_COMPUTE_UNITS: number;
    DATASET_READS: number;
    DATASET_WRITES: number;
    REQUESTS: number;
  };
  error?: string; // 任务内部的错误信息
  details?: string; // API 请求的错误信息
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
    const { apiKey, runId } = req.body;

    // 2. 参数校验
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    if (!runId) {
      return res.status(400).json({ success: false, error: 'Run ID is required' });
    }

    console.log(`[Apify Status] Checking run: ${runId}`);

    // 3. 发起请求
    const apiUrl = `https://api.apify.com/v2/actor-runs/${runId}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data: any = await response.json();

    if (response.ok) {
      const runData = data.data;
      
      console.log(`[Apify Status] Run ${runId} status: ${runData.status}`);

      // 4. 返回详细状态
      return res.status(200).json({
        success: true,
        status: runData.status,
        finishedAt: runData.finishedAt,
        usage: runData.usage, // 返回资源使用情况
        error: runData.status === 'FAILED' ? runData.error?.message : undefined, // 如果失败，返回错误原因
      } as StatusResponse);
    } else {
      // 5. 错误处理
      const errorMessage = data.error?.message || data.message || 'Failed to get run status';
      console.error(`[Apify Status] Error (${response.status}): ${errorMessage}`);

      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Run Not Found',
          details: `Run ID '${runId}' does not exist.`
        });
      }

      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch status',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('[Apify Status] Network Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Failed to connect to Apify'
    });
  }
}