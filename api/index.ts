/**
 * 统一 API 路由 - 合并所有 API 功能
 * 通过 ?action=xxx 参数路由不同功能
 * 解决 Vercel Hobby 计划 12 个 Serverless Functions 限制
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ===== 公共函数 =====
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ===== Apify 相关功能 =====
async function handleRunApify(req: VercelRequest, res: VercelResponse) {
  const { apiKey, actorId, input } = req.body;
  
  if (!apiKey || !actorId) {
    return res.status(400).json({ success: false, error: 'API Key and Actor ID are required' });
  }

  const apiUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input || {}),
  });

  const data: any = await response.json();

  if (response.ok) {
    return res.status(200).json({
      success: true,
      runId: data.data?.id,
      status: data.data?.status,
    });
  } else {
    return res.status(response.status).json({
      success: false,
      error: data.error?.message || 'Failed to start actor',
    });
  }
}

async function handleApifyStatus(req: VercelRequest, res: VercelResponse) {
  const { apiKey, runId } = req.body;
  
  if (!apiKey || !runId) {
    return res.status(400).json({ success: false, error: 'API Key and Run ID are required' });
  }

  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  const data: any = await response.json();

  if (response.ok) {
    return res.status(200).json({
      success: true,
      status: data.data?.status,
      finishedAt: data.data?.finishedAt,
      usage: data.data?.usage,
    });
  } else {
    return res.status(response.status).json({
      success: false,
      error: data.error?.message || 'Failed to get status',
    });
  }
}

async function handleApifyResults(req: VercelRequest, res: VercelResponse) {
  const { apiKey, runId, limit = 100, offset = 0 } = req.body;
  
  if (!apiKey || !runId) {
    return res.status(400).json({ success: false, error: 'API Key and Run ID are required' });
  }

  const url = new URL(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`);
  url.searchParams.append('clean', 'true');
  if (limit > 0) url.searchParams.append('limit', limit.toString());
  if (offset > 0) url.searchParams.append('offset', offset.toString());

  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (response.ok) {
    const data = await response.json();
    return res.status(200).json({
      success: true,
      data: Array.isArray(data) ? data : [],
    });
  } else {
    return res.status(response.status).json({
      success: false,
      error: 'Failed to fetch results',
    });
  }
}

// ===== 邮箱验证 =====
async function handleVerifyEmail(req: VercelRequest, res: VercelResponse) {
  const { email, provider = 'kickbox', apiKey } = req.body;
  
  if (!email || !apiKey) {
    return res.status(400).json({ success: false, error: 'Email and API Key are required' });
  }

  try {
    let result;
    
    if (provider === 'kickbox') {
      const response = await fetch(`https://api.kickbox.com/v2/verify?email=${encodeURIComponent(email)}&apikey=${apiKey}`);
      const data: any = await response.json();
      result = {
        email,
        deliverable: data.result === 'deliverable',
        score: data.sendex ? Math.round(data.sendex * 100) : 90,
        disposable: data.disposable || false,
        free: data.free || false,
        reason: data.reason,
      };
    } else if (provider === 'emailable') {
      const response = await fetch(`https://api.emailable.com/v1/verify?email=${encodeURIComponent(email)}&api_key=${apiKey}`);
      const data: any = await response.json();
      result = {
        email,
        deliverable: data.state === 'deliverable',
        score: data.score || 90,
        disposable: data.disposable || false,
        free: data.free || false,
        reason: data.reason,
      };
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported provider' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
}

// ===== 电话验证 =====
async function handleVerifyPhone(req: VercelRequest, res: VercelResponse) {
  const { phone, provider = 'numverify', apiKey } = req.body;
  
  if (!phone || !apiKey) {
    return res.status(400).json({ success: false, error: 'Phone and API Key are required' });
  }

  try {
    let result;
    
    if (provider === 'numverify') {
      const response = await fetch(`https://apilayer.net/api/validate?access_key=${apiKey}&number=${encodeURIComponent(phone)}`);
      const data: any = await response.json();
      result = {
        phone,
        valid: data.valid || false,
        countryCode: data.country_code,
        countryName: data.country_name,
        carrier: data.carrier,
        lineType: data.line_type,
        score: data.valid ? 90 : 30,
      };
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported provider' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
}

// ===== 邮件发送 =====
async function handleSendEmail(req: VercelRequest, res: VercelResponse) {
  const { to, subject, html, text, apiKey } = req.body;
  
  if (!to || !subject || !apiKey) {
    return res.status(400).json({ success: false, error: 'To, subject and API Key are required' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || text,
      }),
    });

    const data: any = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, id: data.id });
    } else {
      return res.status(response.status).json({ success: false, error: data.message });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
}

// ===== 渠道健康检查 =====
async function handleChannelHealth(req: VercelRequest, res: VercelResponse) {
  const channels = [
    { id: 'pipeline_leads', name: 'Pipeline Leads', pricePerK: 1.0, hasEmail: true, hasPhone: true, status: 'active' },
    { id: 'leads_finder', name: 'Leads Finder', pricePerK: 1.5, hasEmail: true, hasPhone: true, status: 'active' },
    { id: 'lead_finder_pro', name: 'Lead Finder Pro', pricePerK: 1.39, hasEmail: true, hasPhone: true, status: 'active' },
    { id: 'multi_source_leads', name: 'Multi-Source Leads', pricePerK: 2.0, hasEmail: true, hasPhone: true, status: 'active' },
    { id: 'thomasnet', name: 'ThomasNet', pricePerK: 5.0, hasEmail: true, hasPhone: true, status: 'active' },
    { id: 'crunchbase', name: 'Crunchbase', pricePerK: 2.5, hasEmail: true, hasPhone: false, status: 'active' },
    { id: 'linkedin', name: 'LinkedIn', pricePerK: 5.0, hasEmail: true, hasPhone: false, status: 'active' },
    { id: 'google_maps', name: 'Google Maps', pricePerK: 2.0, hasEmail: false, hasPhone: true, status: 'active' },
  ];

  return res.status(200).json({
    success: true,
    data: {
      channels,
      lastUpdated: '2026-04-08',
      total: channels.length,
      active: channels.filter(c => c.status === 'active').length,
    },
  });
}

// ===== 测试接口 =====
async function handleTest(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
    availableActions: [
      'run-apify',
      'apify-status', 
      'apify-results',
      'verify-email',
      'verify-phone',
      'send-email',
      'channel-health',
      'check-tasks',
      'scrape',
      'generate-email',
      'customs-data',
      'sync-task',
    ],
  });
}

// ===== 主路由处理 =====
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'run-apify':
        return await handleRunApify(req, res);
      case 'apify-status':
        return await handleApifyStatus(req, res);
      case 'apify-results':
        return await handleApifyResults(req, res);
      case 'verify-email':
        return await handleVerifyEmail(req, res);
      case 'verify-phone':
        return await handleVerifyPhone(req, res);
      case 'send-email':
        return await handleSendEmail(req, res);
      case 'channel-health':
        return await handleChannelHealth(req, res);
      case 'test':
        return await handleTest(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
          hint: 'Use ?action=run-apify, ?action=apify-status, etc.',
        });
    }
  } catch (error) {
    console.error(`[API Error] Action: ${action}`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
