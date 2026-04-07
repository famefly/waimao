import type { VercelRequest, VercelResponse } from '@vercel/node';

// 渠道健康检查 API
// 用于检查各获客渠道的可用性和状态
// 最后更新: 2026-04-07

interface ChannelInfo {
  id: string;
  name: string;
  nameZh: string;
  status: 'active' | 'deprecated' | 'maintenance' | 'unknown';
  hasEmail: boolean;
  hasPhone: boolean;
  pricePerK: number;
  maxPerRun: number;
  lastChecked: string;
  notes?: string;
}

// 渠道配置数据 - 定期更新
const CHANNELS: ChannelInfo[] = [
  // ===== 超高价值渠道（直接返回邮箱+电话）=====
  {
    id: 'pipeline_leads',
    name: 'Pipeline Leads',
    nameZh: 'Pipeline 线索库',
    status: 'active',
    hasEmail: true,
    hasPhone: true,
    pricePerK: 1.0,
    maxPerRun: 50000,
    lastChecked: '2026-04-07',
    notes: '90M+验证数据库，类似Apollo/ZoomInfo，性价比最高',
  },
  {
    id: 'leads_finder',
    name: 'Leads Finder',
    nameZh: 'Leads Finder',
    status: 'active',
    hasEmail: true,
    hasPhone: true,
    pricePerK: 1.5,
    maxPerRun: 10000,
    lastChecked: '2026-04-07',
    notes: '直接返回验证邮箱+电话',
  },
  {
    id: 'lead_finder_pro',
    name: 'Lead Finder Pro',
    nameZh: '专业线索查找',
    status: 'active',
    hasEmail: true,
    hasPhone: true,
    pricePerK: 1.39,
    maxPerRun: 10000,
    lastChecked: '2026-04-07',
    notes: '验证邮箱+电话，$1.39/千条',
  },
  {
    id: 'multi_source_leads',
    name: 'Multi-Source Leads',
    nameZh: '多源线索',
    status: 'active',
    hasEmail: true,
    hasPhone: true,
    pricePerK: 2.0,
    maxPerRun: 5000,
    lastChecked: '2026-04-07',
    notes: '多数据源聚合',
  },
  // ===== 高价值渠道 =====
  {
    id: 'thomasnet',
    name: 'ThomasNet',
    nameZh: '美国工业目录',
    status: 'active',
    hasEmail: true,
    hasPhone: true,
    pricePerK: 5.0,
    maxPerRun: 1000,
    lastChecked: '2026-04-07',
    notes: '美国最大工业供应商目录',
  },
  {
    id: 'crunchbase',
    name: 'Crunchbase',
    nameZh: '创业公司库',
    status: 'active',
    hasEmail: true,
    hasPhone: false,
    pricePerK: 2.5,
    maxPerRun: 1000,
    lastChecked: '2026-04-07',
    notes: '全球创业公司数据库',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    nameZh: '领英',
    status: 'active',
    hasEmail: true,
    hasPhone: false,
    pricePerK: 5.0,
    maxPerRun: 1000,
    lastChecked: '2026-04-07',
    notes: '支持职位搜索+邮箱发现',
  },
  // ===== 基础渠道（需邮箱提取）=====
  {
    id: 'google_maps',
    name: 'Google Maps',
    nameZh: '谷歌地图',
    status: 'active',
    hasEmail: false,
    hasPhone: true,
    pricePerK: 2.0,
    maxPerRun: 5000,
    lastChecked: '2026-04-07',
    notes: '需自动提取邮箱',
  },
  {
    id: 'yellow_pages',
    name: 'Yellow Pages (US)',
    nameZh: '美国黄页',
    status: 'active',
    hasEmail: false,
    hasPhone: true,
    pricePerK: 3.0,
    maxPerRun: 2000,
    lastChecked: '2026-04-07',
    notes: '需自动提取邮箱',
  },
];

// 推荐的新渠道（待集成）
const UPCOMING_CHANNELS = [
  {
    id: 'apollo_direct',
    name: 'Apollo.io API',
    nameZh: 'Apollo 直连',
    status: 'planned',
    description: '直接调用Apollo API，2.7亿+联系人',
    estimatedPrice: '$49/月起',
  },
  {
    id: 'instantly',
    name: 'Instantly AI',
    nameZh: 'Instantly',
    status: 'planned',
    description: '冷邮件+获客一体化',
    estimatedPrice: '$37/月起',
  },
  {
    id: 'clay',
    name: 'Clay',
    nameZh: 'Clay',
    status: 'planned',
    description: 'AI驱动数据丰富',
    estimatedPrice: '$149/月起',
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { action } = req.query;

  switch (action) {
    case 'list':
      // 返回所有渠道列表
      return res.status(200).json({
        success: true,
        data: {
          channels: CHANNELS,
          upcoming: UPCOMING_CHANNELS,
          lastUpdated: '2026-04-07',
        },
      });

    case 'recommend':
      // 返回推荐渠道（优先邮箱+电话）
      const recommended = CHANNELS
        .filter(c => c.status === 'active' && c.hasEmail && c.hasPhone)
        .sort((a, b) => a.pricePerK - b.pricePerK);

      return res.status(200).json({
        success: true,
        data: {
          recommended: recommended.slice(0, 5),
          reason: '按价格和邮箱电话可用性排序',
        },
      });

    case 'check':
      // 检查单个渠道状态
      const { channelId } = req.query;
      const channel = CHANNELS.find(c => c.id === channelId);

      if (!channel) {
        return res.status(404).json({
          success: false,
          error: 'Channel not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: channel,
      });

    default:
      // 默认返回渠道摘要
      const summary = {
        total: CHANNELS.length,
        active: CHANNELS.filter(c => c.status === 'active').length,
        withEmail: CHANNELS.filter(c => c.hasEmail).length,
        withPhone: CHANNELS.filter(c => c.hasPhone).length,
        premiumChannels: CHANNELS.filter(c => c.hasEmail && c.hasPhone && c.pricePerK <= 2),
        lastUpdated: '2026-04-07',
      };

      return res.status(200).json({
        success: true,
        data: summary,
      });
  }
}
