import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { 
  queryCustomsData, 
  importCustomsDataAsCustomers,
  getCustomsApiConfig 
} from '../src/services/customsDataService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 验证配置
  if (req.method === 'GET') {
    try {
      const config = await getCustomsApiConfig();
      return res.status(200).json({
        success: true,
        configured: !!config && !!config.apiKey,
        provider: config?.provider || null,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to check configuration',
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      error: 'Database configuration missing',
    });
  }

  try {
    const { 
      action = 'query',
      keyword,
      hsCode,
      country,
      importerName,
      exporterName,
      dateFrom,
      dateTo,
      limit = 100,
      departmentId,
      importAsCustomers = false,
    } = req.body;

    const params = {
      keyword,
      hsCode,
      country,
      importerName,
      exporterName,
      dateFrom,
      dateTo,
      limit,
    };

    // 查询海关数据
    if (action === 'query') {
      const records = await queryCustomsData(params);
      
      return res.status(200).json({
        success: true,
        count: records.length,
        records,
      });
    }

    // 导入为客户
    if (action === 'import') {
      const result = await importCustomsDataAsCustomers(params, departmentId || null);
      
      return res.status(200).json({
        success: true,
        total: result.total,
        imported: result.imported,
        message: `成功导入 ${result.imported}/${result.total} 条海关数据`,
      });
    }

    // 查询并预览（不导入）
    if (action === 'preview') {
      const records = await queryCustomsData({ ...params, limit: 10 });
      
      return res.status(200).json({
        success: true,
        preview: records.slice(0, 10),
        estimatedTotal: records.length,
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action. Use: query, import, or preview',
    });

  } catch (error) {
    console.error('[Customs Data] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
