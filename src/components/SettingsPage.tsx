import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Key,
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  Database,
  Copy,
  AlertTriangle,
  Zap,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { getSupabase, initSupabase, createTablesSql } from '../lib/supabase';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

interface ApiKeyConfig {
  key_name: string;
  key_value: string;
  label: string;
  description: string;
  placeholder: string;
  testable: boolean;
}

// Apify Actor 配置 - 与 ScrapePage.tsx 保持一致
// 优先选择带邮箱的高价值渠道
const APIFY_ACTORS = [
  // ===== 高价值渠道（带邮箱）=====
  {
    id: 'code_crafter/leads-finder',
    name: 'Leads Finder (强烈推荐)',
    description: '类似Apollo，直接返回验证邮箱！$1.5/千条，可按职位、行业、公司规模筛选',
    platform: 'leads_finder',
    supportsEmail: true,
    pricing: '$1.5/千条',
  },
  {
    id: 'memo23/thomasnet-scraper',
    name: 'ThomasNet (美国工业)',
    description: '美国最大工业供应商目录，包含公司、电话、网站、员工数',
    platform: 'thomasnet',
    supportsEmail: true,
    pricing: '$5/千条',
  },
  {
    id: 'curious_coder/crunchbase-scraper',
    name: 'Crunchbase (科技公司)',
    description: '全球创业公司数据库，包含融资信息、创始人联系方式',
    platform: 'crunchbase',
    supportsEmail: true,
    pricing: '$2.5/千条',
  },
  
  // ===== Amazon卖家 =====
  {
    id: 'junglee/amazon-seller-scraper',
    name: 'Amazon卖家 (进口商)',
    description: '抓取亚马逊卖家信息，这些卖家很多是进口商',
    platform: 'amazon_seller',
    supportsEmail: false,
    pricing: '按使用量计费',
  },
  
  // ===== Google Maps =====
  {
    id: 'compass/crawler-google-places',
    name: 'Google Maps',
    description: '获取商家名称、地址、电话、网站URL，邮箱需后续提取',
    platform: 'google_maps',
    supportsEmail: false,
    pricing: '$2/千条',
  },
  
  // ===== 商业目录 =====
  {
    id: 'trudax/yellow-pages-us-scraper',
    name: 'Yellow Pages',
    description: 'Yellow Pages US 黄页抓取，获取商家信息和网站URL',
    platform: 'yellow_pages',
    supportsEmail: false,
    pricing: '按使用量计费',
  },
  {
    id: 'tri_angle/yelp-scraper',
    name: 'Yelp Business',
    description: 'Yelp 商家抓取，包含电话',
    platform: 'yelp',
    supportsEmail: false,
    pricing: '按使用量计费',
  },
  
  // ===== 社交媒体 =====
  {
    id: 'apimaestro/linkedin-profile-search-scraper',
    name: 'LinkedIn',
    description: 'LinkedIn 职位搜索+邮箱发现，无需登录，$5/千条',
    platform: 'linkedin',
    supportsEmail: true,
    pricing: '$5/千条',
  },
  {
    id: 'apify/facebook-pages-scraper',
    name: 'Facebook Pages',
    description: 'Facebook 商家抓取，获取网站URL',
    platform: 'facebook',
    supportsEmail: false,
    pricing: '按使用量计费',
  },
  {
    id: 'apify/instagram-search-scraper',
    name: 'Instagram Search',
    description: 'Instagram 搜索，无邮箱',
    platform: 'instagram',
    supportsEmail: false,
    pricing: '按使用量计费',
  },
  
  // ===== 论坛/社区 =====
  {
    id: 'peghin/ai-forum-scraper-stack-overflow-quora-reddit-more',
    name: '论坛抓取',
    description: '抓取论坛讨论，无邮箱',
    platform: 'forum',
    supportsEmail: false,
    pricing: '按使用量计费',
  },
  
  // ===== 海关数据 =====
  {
    id: 'custom/customs-data-scraper',
    name: '海关数据 (进阶)',
    description: '进出口贸易数据，获取真实采购商信息，需要配置第三方API',
    platform: 'customs_data',
    supportsEmail: true,
    pricing: '需配置API',
  },
  
  // ===== Scrapling 自适应爬虫 =====
  {
    id: 'maiboxuan/scrapling-actor',
    name: 'Scrapling (自适应爬虫)',
    description: '自适应爬虫，自动绕过反爬检测，支持任意网站',
    platform: 'scrapling',
    supportsEmail: false,
    pricing: '按使用量计费',
  },
];

const API_KEYS: Omit<ApiKeyConfig, 'key_value'>[] = [
  {
    key_name: 'apify_token',
    label: 'Apify API Token',
    description: '用于抓取 Google Maps、LinkedIn、Instagram 等平台的客户数据',
    placeholder: 'apify_api_xxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'zhipu_api_key',
    label: '智谱 GLM API Key',
    description: '用于 AI 生成个性化开发信内容（免费，推荐）',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'deepseek_api_key',
    label: 'DeepSeek API Key',
    description: '备用 AI 模型，当智谱不可用时自动切换（免费）',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'resend_api_key',
    label: 'Resend API Key',
    description: '用于发送邮件（每月免费100封）',
    placeholder: 're_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'sender_email',
    label: '发件人邮箱',
    description: '需要在 Resend 中验证的域名邮箱',
    placeholder: 'sales@yourdomain.com',
    testable: false,
  },
  // ===== 邮箱验证服务（多选一） =====
  {
    key_name: 'kickbox_api_key',
    label: 'Kickbox API Key（推荐）',
    description: '邮箱验证服务 - 免费额度500次，$0.005/封',
    placeholder: 'live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'emailable_api_key',
    label: 'Emailable API Key',
    description: '邮箱验证服务 - 免费额度250次，99%送达率保证',
    placeholder: 'live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'debounce_api_key',
    label: 'DeBounce API Key',
    description: '邮箱验证服务 - 免费额度100次，最低价格$0.002/封',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'millionverifier_api_key',
    label: 'MillionVerifier API Key',
    description: '邮箱验证服务 - 免费额度200次，$0.0037/封',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'hunter_api_key',
    label: 'Hunter.io API Key',
    description: '邮箱查找+验证服务 - 免费额度50次/月',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  // ===== 电话验证服务（多选一） =====
  {
    key_name: 'numverify_api_key',
    label: 'NumVerify API Key（推荐）',
    description: '电话验证服务 - 免费额度100次/月，支持232国家',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'abstract_phone_api_key',
    label: 'Abstract Phone API Key',
    description: '电话验证服务 - 免费额度250次/月',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'numlookup_api_key',
    label: 'NumLookup API Key',
    description: '电话验证服务 - 免费额度100次/月，最低价格',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  // ===== 海关数据服务（多选一） =====
  {
    key_name: 'customs_api_provider',
    label: '海关数据提供商',
    description: '选择海关数据 API 提供商：tendata, exportgenius, descartes',
    placeholder: 'tendata',
    testable: false,
  },
  {
    key_name: 'customs_api_key',
    label: '海关数据 API Key',
    description: '海关数据 API 密钥 - Tendata(特易)/Export Genius/Descartes',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    testable: true,
  },
  {
    key_name: 'customs_api_url',
    label: '海关数据 API URL',
    description: '海关数据 API 地址（可选，使用默认值）',
    placeholder: 'https://api.tendata.cn/v1',
    testable: false,
  },
];

export const SettingsPage: React.FC = () => {
  const { isConfigured, setIsConfigured, currentUser } = useStore();
  const isAdmin = currentUser?.role === 'admin';
  
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});
  const [showSql, setShowSql] = useState(false);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [savingActors, setSavingActors] = useState(false);

  // 使用随机后缀防止浏览器自动填充
  const [inputSuffix] = useState(() => Math.random().toString(36).substring(7));

  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('api_configs')
        .select('key_name, key_value');

      if (error) {
        console.error('加载 API Keys 失败:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const keys: Record<string, string> = {};
        (data as Array<{ key_name: string; key_value: string }>).forEach(item => {
          keys[item.key_name] = item.key_value;
        });
        setApiKeys(keys);
        
        // 加载已选择的 Actors
        if (keys['apify_actors']) {
          try {
            setSelectedActors(JSON.parse(keys['apify_actors']));
          } catch {
            setSelectedActors([]);
          }
        }
        
        setIsConfigured(true);
      }
    } catch (error) {
      console.error('加载 API Keys 失败:', error);
    } finally {
      setLoading(false);
    }
  }, [setIsConfigured]);

  useEffect(() => {
    // 从 sessionStorage 恢复 Supabase 配置
    const url = sessionStorage.getItem('supabase_url');
    const key = sessionStorage.getItem('supabase_anon_key');
    if (url) setSupabaseUrl(url);
    if (key) setSupabaseKey(key);
    
    if (url && key) {
      loadApiKeys();
    }
  }, [loadApiKeys]);

  const connectSupabase = async () => {
    if (!supabaseUrl || !supabaseKey) {
      toast.error('请输入 Supabase URL 和 Anon Key');
      return;
    }

    setLoading(true);
    try {
      const client = initSupabase(supabaseUrl, supabaseKey);
      
      // 测试连接
      const { error } = await client.from('api_configs').select('count').limit(1);
      
      if (error && error.code === '42P01') {
        toast.error('数据库表不存在，请先在 Supabase 中执行建表 SQL');
        setShowSql(true);
        setLoading(false);
        return;
      }

      // 保存配置到 sessionStorage
      sessionStorage.setItem('supabase_url', supabaseUrl);
      sessionStorage.setItem('supabase_anon_key', supabaseKey);
      
      toast.success('Supabase 连接成功！');
      setIsConfigured(true);
      await loadApiKeys();
    } catch (error) {
      toast.error('连接失败，请检查配置');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async (keyName: string) => {
    const value = apiKeys[keyName];
    if (!value) {
      toast.error('请输入 API Key');
      return;
    }

    setSaving(prev => ({ ...prev, [keyName]: true }));
    const supabase = getSupabase();
    if (!supabase) {
      setSaving(prev => ({ ...prev, [keyName]: false }));
      return;
    }

    try {
      const { error } = await supabase
        .from('api_configs')
        .upsert(
          {
            key_name: keyName,
            key_value: value,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'key_name' }
        );

      if (error) throw error;
      toast.success('保存成功！');
    } catch (error) {
      toast.error('保存失败');
      console.error(error);
    } finally {
      setSaving(prev => ({ ...prev, [keyName]: false }));
    }
  };

  const saveAllApiKeys = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setSaving(prev => ({ ...prev, all: true }));
    
    try {
      const promises = Object.entries(apiKeys).map(([key_name, key_value]) => {
        if (!key_value) return Promise.resolve();
        return supabase
          .from('api_configs')
          .upsert(
            {
              key_name,
              key_value,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: 'key_name' }
          );
      });

      await Promise.all(promises);
      toast.success('所有配置已保存！');
    } catch (error) {
      toast.error('保存失败');
      console.error(error);
    } finally {
      setSaving(prev => ({ ...prev, all: false }));
    }
  };

  const testApiConnection = async (keyName: string) => {
    const value = apiKeys[keyName];
    if (!value) {
      toast.error('请先输入并保存 API Key');
      return;
    }

    setTesting(prev => ({ ...prev, [keyName]: true }));
    setTestResults(prev => ({ ...prev, [keyName]: null }));

    try {
      let success = false;

      // 使用统一的测试 API
      const typeMap: Record<string, string> = {
        'apify_token': 'apify',
        'zhipu_api_key': 'zhipu',
        'resend_api_key': 'resend',
        'email_verify_api_key': 'emailVerify',
        'deepseek_api_key': 'deepseek',
      };

      const testType = typeMap[keyName];
      
      if (testType) {
        const response = await fetch('/api/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: testType, apiKey: value }),
        });
        const result = await response.json();
        success = result.success === true;
      } else {
        success = true;
      }

      setTestResults(prev => ({ ...prev, [keyName]: success ? 'success' : 'error' }));
      if (success) {
        toast.success('API 连接测试成功！');
      } else {
        toast.error('API 连接测试失败，请检查 Key 是否正确');
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [keyName]: 'error' }));
      toast.error('API 连接测试失败');
      console.error(error);
    } finally {
      setTesting(prev => ({ ...prev, [keyName]: false }));
    }
  };

  const toggleShowKey = (keyName: string) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const toggleActor = (actorId: string) => {
    setSelectedActors(prev => {
      if (prev.includes(actorId)) {
        return prev.filter(id => id !== actorId);
      }
      return [...prev, actorId];
    });
  };

  const saveSelectedActors = async () => {
    setSavingActors(true);
    const supabase = getSupabase();
    if (!supabase) {
      setSavingActors(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('api_configs')
        .upsert(
          {
            key_name: 'apify_actors',
            key_value: JSON.stringify(selectedActors),
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'key_name' }
        );

      if (error) throw error;
      toast.success('Actor 配置已保存！');
    } catch (error) {
      toast.error('保存失败');
      console.error(error);
    } finally {
      setSavingActors(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 非管理员提示 */}
      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <p className="text-yellow-800 font-medium">仅管理员可修改设置</p>
            <p className="text-yellow-600 text-sm mt-1">
              您当前是普通用户，只能查看系统配置，无法进行修改。如需修改请联系管理员。
            </p>
          </div>
        </div>
      )}

      {/* Supabase 配置 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Database className="w-5 h-5 mr-2 text-green-600" />
          Supabase 数据库配置
        </h3>
        
        {isConfigured && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-700">数据库已连接</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supabase Project URL
            </label>
            {/* 使用随机 name 防止浏览器自动填充 */}
            <input
              type="text"
              name={`supabase_url_${inputSuffix}`}
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              disabled={!isAdmin}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supabase Anon Key
            </label>
            <input
              type="text"
              name={`supabase_key_${inputSuffix}`}
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              disabled={!isAdmin}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={connectSupabase}
            disabled={loading || !isAdmin}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            {isConfigured ? '重新连接' : '连接数据库'}
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showSql ? '隐藏建表 SQL' : '查看建表 SQL'}
            </button>
          )}
        </div>

        {showSql && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">
                请在 Supabase SQL Editor 中执行以下 SQL 创建数据表：
              </p>
              <button
                onClick={() => copyToClipboard(createTablesSql)}
                className="flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <Copy className="w-4 h-4 mr-1" />
                复制
              </button>
            </div>
            <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto max-h-64">
              {createTablesSql}
            </pre>
          </div>
        )}
      </div>

      {/* API Keys 配置 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Key className="w-5 h-5 mr-2 text-blue-600" />
            API Keys 配置
          </h3>
          <button
            onClick={saveAllApiKeys}
            disabled={!isConfigured || saving.all || !isAdmin}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving.all ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存所有配置
          </button>
        </div>

        {!isConfigured && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-yellow-700">请先连接 Supabase 数据库</span>
          </div>
        )}

        <div className="space-y-6">
          {API_KEYS.map(config => (
            <div key={config.key_name} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    {config.label}
                  </label>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
                {testResults[config.key_name] && (
                  <span className={`flex items-center text-sm ${testResults[config.key_name] === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {testResults[config.key_name] === 'success' ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        已连接
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-1" />
                        连接失败
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKeys[config.key_name] ? 'text' : 'password'}
                    name={`${config.key_name}_${inputSuffix}`}
                    value={apiKeys[config.key_name] || ''}
                    onChange={e => setApiKeys(prev => ({ ...prev, [config.key_name]: e.target.value }))}
                    placeholder={config.placeholder}
                    disabled={!isConfigured}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    data-1p-ignore="true"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                  <button
                    onClick={() => toggleShowKey(config.key_name)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys[config.key_name] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => saveApiKey(config.key_name)}
                  disabled={!isConfigured || saving[config.key_name] || !isAdmin}
                  className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  title="保存"
                >
                  {saving[config.key_name] ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
                {config.testable && (
                  <button
                    onClick={() => testApiConnection(config.key_name)}
                    disabled={!isConfigured || testing[config.key_name] || !apiKeys[config.key_name] || !isAdmin}
                    className="flex items-center px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
                    title="测试连接"
                  >
                    {testing[config.key_name] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Apify Actor 配置 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2 text-orange-600" />
            Apify Actor 配置（支持邮箱抓取）
          </h3>
          <button
            onClick={saveSelectedActors}
            disabled={!isConfigured || savingActors || !isAdmin}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {savingActors ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存 Actor 配置
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          选择要使用的 Apify Actor（以下 Actors 都支持邮箱抓取）：
        </p>

        <div className="space-y-3">
          {APIFY_ACTORS.map(actor => (
            <div
              key={actor.id}
              className={`p-4 border rounded-lg ${isAdmin ? 'cursor-pointer transition-all' : ''} ${
                selectedActors.includes(actor.id)
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              } ${!isAdmin ? 'opacity-75' : ''}`}
              onClick={() => isAdmin && toggleActor(actor.id)}
            >
              <div className="flex items-start">
                <input
                  type="checkbox"
                  checked={selectedActors.includes(actor.id)}
                  onChange={() => isAdmin && toggleActor(actor.id)}
                  disabled={!isAdmin}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{actor.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{actor.description}</div>
                  <div className="text-xs text-gray-400 mt-1">Actor ID: {actor.id}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>提示：</strong>您也可以在 Apify 市场找到更多支持邮箱抓取的 Actors。
            只需确保 Actor 的输出包含 email 字段即可。
          </p>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          配置说明
        </h3>
        <div className="space-y-3 text-sm text-blue-700">
          <p>
            <strong>1. Supabase：</strong>
            访问 <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a> 创建免费项目，
            在项目设置中获取 URL 和 Anon Key。
          </p>
          <p>
            <strong>2. Apify：</strong>
            访问 <a href="https://apify.com" target="_blank" rel="noopener noreferrer" className="underline">apify.com</a> 注册账号，
            在设置中获取 API Token。每月有免费额度。选择支持邮箱抓取的 Actor。
          </p>
          <p>
            <strong>3. 智谱 GLM：</strong>
            访问 <a href="https://open.bigmodel.cn" target="_blank" rel="noopener noreferrer" className="underline">open.bigmodel.cn</a> 注册账号，
            获取免费的 API Key。GLM-4-Flash 模型完全免费。
          </p>
          <p>
            <strong>4. Resend：</strong>
            访问 <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">resend.com</a> 注册账号，
            验证您的域名后获取 API Key。每月免费100封邮件。
          </p>
          <p>
            <strong>5. 邮箱验证（可选）：</strong>
            访问 <a href="https://www.abstractapi.com" target="_blank" rel="noopener noreferrer" className="underline">abstractapi.com</a> 获取免费的邮箱验证 API。
          </p>
        </div>
      </div>
    </div>
  );
};
