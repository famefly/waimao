import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface ScrapeResponse {
  success: boolean;
  runId?: string;
  status?: string;
  error?: string;
  details?: string;
  message?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, actorId, input } = req.body;

    console.log('[Scrape] Request:', { taskId, actorId, input });

    if (!taskId || !actorId) {
      return res.status(400).json({ error: 'Missing taskId or actorId' });
    }

    // 获取数据库连接
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Scrape] Missing env vars:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
      return res.status(500).json({ error: '数据库配置缺失' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 从数据库获取 Apify Token
    const { data: tokenData, error: tokenError } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'apify_token')
      .single();

    if (tokenError) {
      console.error('[Scrape] Token fetch error:', tokenError);
      return res.status(400).json({ error: '获取 Apify Token 失败: ' + tokenError.message });
    }

    const apifyToken = tokenData?.key_value;
    if (!apifyToken) {
      return res.status(400).json({ error: 'Apify Token 未配置，请先在设置页面配置' });
    }

    console.log('[Scrape] Got Apify token, starting actor:', actorId);

    // 运行 Apify Actor
    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input || {}),
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('[Scrape] Apify error:', apifyResponse.status, errorText);
      return res.status(apifyResponse.status).json({ 
        error: `Apify API 错误: ${apifyResponse.status}`,
        details: errorText
      });
    }

    const apifyData = await apifyResponse.json() as { data: { id: string } };
    const runId = apifyData.data.id;
    console.log('[Scrape] Actor started, runId:', runId);

    // 更新任务状态
    const { error: updateError } = await supabase
      .from('scrape_tasks')
      .update({ 
        apify_run_id: runId, 
        status: 'running' 
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('[Scrape] Update task error:', updateError);
    }

    return res.status(200).json({
      success: true,
      runId,
      status: 'running',
      message: '抓取任务已启动',
    } as ScrapeResponse);

  } catch (error) {
    console.error('[Scrape] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : '未知错误' 
    });
  }
}
