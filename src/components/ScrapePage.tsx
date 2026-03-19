import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Globe,
  MapPin,
  Linkedin,
  Facebook,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  X,
  RefreshCw,
  AlertTriangle,
  Phone,
  FileText,
  Trash2,
  Factory,
  Rocket,
  ShoppingBag,
} from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { buildActorInput } from '@/services/apifyService';
import toast from 'react-hot-toast';

interface ScrapeTask {
  id: string;
  platform: string;
  keywords: string[];
  countries: string[];
  actorId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultsCount: number;
  emailsCount: number;
  errorMessage?: string;
  createdAt: string;
}

// Apify Actor 配置
// 优先选择带邮箱的高价值渠道
// needEmailExtract: true 表示需要自动搭配邮箱提取
const APIFY_ACTORS = [
  // ===== 高价值渠道（直接返回邮箱）=====
  {
    id: 'code_crafter/leads-finder',
    name: 'Leads Finder (强烈推荐)',
    platform: 'leads_finder',
    icon: Search,
    color: 'bg-purple-600',
    supportsEmail: true,
    emailRate: '高',
    description: '类似Apollo，直接返回验证邮箱！可按职位、行业、公司规模筛选',
    pricing: '$1.5/千条',
    category: 'high_value',
    needEmailExtract: false,
  },
  {
    id: 'memo23/thomasnet-scraper',
    name: 'ThomasNet (美国工业)',
    platform: 'thomasnet',
    icon: Factory,
    color: 'bg-orange-600',
    supportsEmail: true,
    emailRate: '高',
    description: '美国最大工业供应商目录，包含公司、电话、网站、员工数',
    pricing: '$5/千条',
    category: 'high_value',
    needEmailExtract: false,
  },
  {
    id: 'curious_coder/crunchbase-scraper',
    name: 'Crunchbase (科技公司)',
    platform: 'crunchbase',
    icon: Rocket,
    color: 'bg-indigo-600',
    supportsEmail: true,
    emailRate: '高',
    description: '全球创业公司数据库，包含融资信息、创始人联系方式',
    pricing: '$2.5/千条',
    category: 'high_value',
    needEmailExtract: false,
  },
  {
    id: 'apimaestro/linkedin-profile-search-scraper',
    name: 'LinkedIn',
    platform: 'linkedin',
    icon: Linkedin,
    color: 'bg-blue-700',
    supportsEmail: true,
    emailRate: '邮箱发现',
    description: '无需登录，支持职位搜索+邮箱发现',
    pricing: '$5/千条',
    category: 'high_value',
    needEmailExtract: false,
  },
  
  // ===== 基础渠道（需自动搭配邮箱提取）=====
  {
    id: 'compass/crawler-google-places',
    name: 'Google Maps',
    platform: 'google_maps',
    icon: MapPin,
    color: 'bg-red-500',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '获取商家信息，自动提取邮箱和电话',
    pricing: '$2/千条',
    category: 'basic',
    needEmailExtract: true,
  },
  {
    id: 'trudax/yellow-pages-us-scraper',
    name: 'Yellow Pages (美国)',
    platform: 'yellow_pages',
    icon: FileText,
    color: 'bg-yellow-500',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '美国黄页，自动提取邮箱',
    pricing: '按使用量计费',
    category: 'basic',
    needEmailExtract: true,
  },
  {
    id: 'canadesk/yellow-pages-scraper',
    name: 'Yellow Pages (全球)',
    platform: 'yellow_pages_world',
    icon: FileText,
    color: 'bg-yellow-600',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '全球黄页，自动提取邮箱',
    pricing: '按使用量计费',
    category: 'basic',
    needEmailExtract: true,
  },
  {
    id: 'tri_angle/yelp-scraper',
    name: 'Yelp Business',
    platform: 'yelp',
    icon: Phone,
    color: 'bg-red-600',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '获取商家信息，自动提取邮箱',
    pricing: '按使用量计费',
    category: 'basic',
    needEmailExtract: true,
  },
  {
    id: 'apify/facebook-pages-scraper',
    name: 'Facebook Pages',
    platform: 'facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '获取商家信息，自动提取邮箱',
    pricing: '按使用量计费',
    category: 'basic',
    needEmailExtract: true,
  },
  
  // ===== B2B 平台（需自动搭配邮箱提取）=====
  {
    id: 'adrian_horning/alibaba-scraper',
    name: 'Alibaba 供应商',
    platform: 'alibaba',
    icon: ShoppingBag,
    color: 'bg-orange-500',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '抓取阿里巴巴供应商信息，自动提取邮箱',
    pricing: '按使用量计费',
    category: 'b2b',
    needEmailExtract: true,
  },
  {
    id: 'memo23/made-in-china-scraper',
    name: 'Made-in-China',
    platform: 'made_in_china',
    icon: Factory,
    color: 'bg-red-600',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '中国制造网供应商信息，自动提取邮箱',
    pricing: '按使用量计费',
    category: 'b2b',
    needEmailExtract: true,
  },
  {
    id: 'junglee/amazon-seller-scraper',
    name: 'Amazon卖家 (进口商)',
    platform: 'amazon_seller',
    icon: ShoppingBag,
    color: 'bg-amber-500',
    supportsEmail: true,
    emailRate: '自动提取',
    description: '抓取亚马逊卖家信息，自动提取邮箱',
    pricing: '按使用量计费',
    category: 'ecommerce',
    needEmailExtract: true,
  },
];

const ALL_COUNTRIES = [
  { code: 'US', name: 'United States', region: 'North America' },
  { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'MX', name: 'Mexico', region: 'North America' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'ES', name: 'Spain', region: 'Europe' },
  { code: 'IT', name: 'Italy', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', region: 'Europe' },
  { code: 'PL', name: 'Poland', region: 'Europe' },
  { code: 'BE', name: 'Belgium', region: 'Europe' },
  { code: 'SE', name: 'Sweden', region: 'Europe' },
  { code: 'NO', name: 'Norway', region: 'Europe' },
  { code: 'DK', name: 'Denmark', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', region: 'Europe' },
  { code: 'AT', name: 'Austria', region: 'Europe' },
  { code: 'AU', name: 'Australia', region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania' },
  { code: 'JP', name: 'Japan', region: 'Asia' },
  { code: 'KR', name: 'South Korea', region: 'Asia' },
  { code: 'SG', name: 'Singapore', region: 'Asia' },
  { code: 'MY', name: 'Malaysia', region: 'Asia' },
  { code: 'TH', name: 'Thailand', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', region: 'Asia' },
  { code: 'PH', name: 'Philippines', region: 'Asia' },
  { code: 'VN', name: 'Vietnam', region: 'Asia' },
  { code: 'IN', name: 'India', region: 'Asia' },
  { code: 'AE', name: 'UAE', region: 'Middle East' },
  { code: 'SA', name: 'Saudi Arabia', region: 'Middle East' },
  { code: 'QA', name: 'Qatar', region: 'Middle East' },
  { code: 'KW', name: 'Kuwait', region: 'Middle East' },
  { code: 'TR', name: 'Turkey', region: 'Middle East' },
  { code: 'ZA', name: 'South Africa', region: 'Africa' },
  { code: 'NG', name: 'Nigeria', region: 'Africa' },
  { code: 'EG', name: 'Egypt', region: 'Africa' },
  { code: 'KE', name: 'Kenya', region: 'Africa' },
  { code: 'BR', name: 'Brazil', region: 'South America' },
  { code: 'AR', name: 'Argentina', region: 'South America' },
  { code: 'CL', name: 'Chile', region: 'South America' },
  { code: 'CO', name: 'Colombia', region: 'South America' },
];

const industries = [
  '建筑 Construction',
  '装修 Renovation',
  '翻新 Refurbishment',
  '安装 Installation',
  '劳务 Labor Service',
  '脚手架 Scaffolding',
  '模板 Formwork',
  '建材 Building Materials',
  '工程承包 Engineering Contractor',
  '房地产开发 Real Estate',
];

export const ScrapePage: React.FC = () => {
  const { currentDepartment, addNotification } = useStore();
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [configuredActors, setConfiguredActors] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>(['scaffolding supplier', 'construction materials']);
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['US', 'GB', 'DE']);
  const [selectedIndustry, setSelectedIndustry] = useState('建筑 Construction');
  const [maxResults, setMaxResults] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [tasks, setTasks] = useState<ScrapeTask[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '', platform: '' });
  const [apifyToken, setApifyToken] = useState<string | null>(null);

  const loadConfiguredActors = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data } = await supabase
        .from('api_configs')
        .select('key_value')
        .eq('key_name', 'apify_actors')
        .single();

      if (data) {
        const actors = JSON.parse((data as { key_value: string }).key_value);
        setConfiguredActors(actors);
        // 默认选择第一个
        if (actors.length > 0 && selectedActors.length === 0) {
          setSelectedActors([actors[0]]);
        }
      }

      // 加载 Apify Token
      const { data: tokenData } = await supabase
        .from('api_configs')
        .select('key_value')
        .eq('key_name', 'apify_token')
        .single();

      if (tokenData) {
        setApifyToken((tokenData as { key_value: string }).key_value);
      }
    } catch (error) {
      console.error('加载 Actor 配置失败:', error);
    }
  }, [selectedActors.length]);

  const loadTasks = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      let query = supabase
        .from('scrape_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (currentDepartment) {
        query = query.eq('department_id', currentDepartment.id);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('加载抓取历史失败:', error);
        return;
      }

      if (data) {
        setTasks(
          (data as Array<{
            id: string;
            platform: string;
            keywords: string | string[];
            countries: string | string[];
            actor_id: string;
            status: string;
            results_count: number;
            emails_count: number;
            error_message?: string;
            created_at: string;
          }>).map(t => {
            const kws = typeof t.keywords === 'string' ? t.keywords.split(', ') : t.keywords;
            const ctrys = typeof t.countries === 'string' ? t.countries.split(', ') : t.countries;
            
            return {
              id: t.id,
              platform: t.platform,
              keywords: kws,
              countries: ctrys,
              actorId: t.actor_id || '',
              status: t.status as ScrapeTask['status'],
              resultsCount: t.results_count || 0,
              emailsCount: t.emails_count || 0,
              errorMessage: t.error_message,
              createdAt: t.created_at,
            };
          })
        );
      }
    } catch (error) {
      console.error('加载抓取历史失败:', error);
    }
  }, [currentDepartment]);

  useEffect(() => {
    loadConfiguredActors();
    loadTasks();
  }, [loadConfiguredActors, loadTasks]);

  // 自动轮询检查任务状态
  useEffect(() => {
    const checkRunningTasks = async () => {
      const hasRunningTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');
      if (!hasRunningTasks || !apifyToken) return;

      try {
        const response = await fetch('/api/check-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apifyToken }),
        });

        const result = await response.json();
        if (result.success && result.updated > 0) {
          loadTasks(); // 刷新任务列表
        }
      } catch (error) {
        console.error('检查任务状态失败:', error);
      }
    };

    // 每10秒检查一次
    const interval = setInterval(checkRunningTasks, 10000);
    
    // 立即检查一次
    if (tasks.some(t => t.status === 'running' || t.status === 'pending')) {
      checkRunningTasks();
    }

    return () => clearInterval(interval);
  }, [tasks, apifyToken, loadTasks]);

  const toggleActor = (actorId: string) => {
    setSelectedActors(prev =>
      prev.includes(actorId)
        ? prev.filter(a => a !== actorId)
        : [...prev, actorId]
    );
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords(prev => [...prev, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(prev => prev.filter(k => k !== keyword));
  };

  const toggleCountry = (countryCode: string) => {
    setSelectedCountries(prev =>
      prev.includes(countryCode)
        ? prev.filter(c => c !== countryCode)
        : [...prev, countryCode]
    );
  };

  const selectAllInRegion = (region: string) => {
    const regionCountries = ALL_COUNTRIES.filter(c => c.region === region).map(c => c.code);
    const allSelected = regionCountries.every(c => selectedCountries.includes(c));
    
    if (allSelected) {
      setSelectedCountries(prev => prev.filter(c => !regionCountries.includes(c)));
    } else {
      setSelectedCountries(prev => [...new Set([...prev, ...regionCountries])]);
    }
  };

  const startScraping = async () => {
    if (selectedActors.length === 0) {
      toast.error('请至少选择一个抓取平台');
      return;
    }

    if (keywords.length === 0) {
      toast.error('请至少输入一个关键词');
      return;
    }

    if (selectedCountries.length === 0) {
      toast.error('请至少选择一个国家');
      return;
    }

    if (!apifyToken) {
      toast.error('请先在系统设置中配置 Apify API Token');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      toast.error('数据库未连接');
      return;
    }

    setIsRunning(true);
    
    // 计算预估搜索维度：平台 × 国家 × 关键词
    const totalDimensions = selectedActors.length * selectedCountries.length * keywords.length;
    
    // 计算每个维度的结果数（向上取整，最少 10 条）
    const resultsPerDimension = Math.max(10, Math.ceil(maxResults / totalDimensions));
    
    // 计算总任务数：每个平台 x 每个国家
    const totalTasks = selectedActors.length * selectedCountries.length;
    setProgress({ current: 0, total: totalTasks, status: '准备中...', platform: '' });

    const countryNames = selectedCountries.map(
      code => ALL_COUNTRIES.find(c => c.code === code)?.name || code
    );

    let taskIndex = 0;

    // 为每个平台和每个国家创建单独的任务
    for (let i = 0; i < selectedActors.length; i++) {
      const actorId = selectedActors[i];
      const actor = APIFY_ACTORS.find(a => a.id === actorId);
      
      if (!actor) continue;

      const platformName = actor.name;

      for (let j = 0; j < countryNames.length; j++) {
        const countryName = countryNames[j];
        taskIndex++;
        
        setProgress({
          current: taskIndex,
          total: totalTasks,
          status: `正在抓取 ${countryName}...`,
          platform: platformName,
        });

        // 创建任务记录 - 每个国家单独一个任务
        const { data: taskData, error: taskError } = await supabase
          .from('scrape_tasks')
          .insert({
            platform: actor.platform,
            keywords: keywords,
            countries: [countryName], // 单个国家
            actor_id: actorId,
            industry: selectedIndustry,
            status: 'pending',
            department_id: currentDepartment?.id,
            results_count: 0,
            emails_count: 0,
          } as never)
          .select()
          .single();

        if (taskError) {
          console.error('创建任务失败:', taskError);
          toast.error(`创建任务失败: ${platformName} - ${countryName}`);
          continue;
        }

        const taskId = (taskData as unknown as { id: string })?.id;

        try {
          // 使用 apifyservices 中的 buildActorInput 函数构建输入参数
          // 注意：这里只传入单个国家，maxResults 已按维度均分
          const { input } = buildActorInput(actor.platform, {
            keywords,
            countries: [countryName], // 单个国家
            industry: selectedIndustry,
            maxResults: resultsPerDimension,
          });

          // 调用 run-apify API 来启动抓取任务
          const response = await fetch('/api/run-apify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              apiKey: apifyToken,
              actorId,
              input,
            }),
          });

        const result = await response.json();

        if (!response.ok || !result.success || result.error) {
          throw new Error(result.error || result.details || `API 错误: ${response.status}`);
        }

        // 更新任务状态和 apify_run_id
        await supabase
          .from('scrape_tasks')
          .update({
            status: 'running',
            apify_run_id: result.runId,
          } as never)
          .eq('id', taskId);

        toast.success(`${platformName} - ${countryName} 抓取任务已启动`);
        
        addNotification({
          type: 'success',
          title: '抓取任务已启动',
          message: `${platformName} - ${countryName} 抓取任务已启动，将在后台运行`,
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        console.error('启动抓取失败:', error);
        
        // 更新任务状态为失败
        await supabase
          .from('scrape_tasks')
          .update({
            status: 'failed',
            error_message: errorMsg,
          } as never)
          .eq('id', taskId);

        toast.error(`${platformName} 启动失败: ${errorMsg}`);
        
        addNotification({
          type: 'error',
          title: '启动抓取任务失败',
          message: `${platformName} - ${countryName} 启动失败: ${errorMsg}`,
        });
      }
      } // 内层国家循环结束
    } // 外层平台循环结束

    setIsRunning(false);
    setProgress({ current: 0, total: 0, status: '', platform: '' });
    loadTasks();
    toast.success(`已创建 ${taskIndex} 个抓取任务，请等待结果...`);
  };

  const retryTask = async (task: ScrapeTask) => {
    setSelectedActors([task.actorId]);
    setKeywords(Array.isArray(task.keywords) ? task.keywords : [task.keywords]);
    
    const countryCodes = (Array.isArray(task.countries) ? task.countries : [task.countries])
      .map(name => {
        const country = ALL_COUNTRIES.find(c => c.name === name.trim());
        return country?.code || '';
      })
      .filter(c => c);
      
    setSelectedCountries(countryCodes);

    toast('已加载任务配置，请点击"开始抓取"重试');
  };

  // 手动同步任务数据
  const syncTask = async (task: ScrapeTask) => {
    if (!task.apifyRunId) {
      toast.error('任务没有 Apify Run ID');
      return;
    }

    const syncToast = toast.loading('正在同步数据...');

    try {
      const response = await fetch('/api/sync-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`同步成功！导入 ${result.customersCount || 0} 条数据`, { id: syncToast });
        loadTasks();
      } else {
        toast.error(`同步失败: ${result.error || '未知错误'}`, { id: syncToast });
      }
    } catch (error) {
      toast.error('同步请求失败', { id: syncToast });
    }
  };

  // 删除单个任务
  const deleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return;
    
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      await supabase.from('scrape_tasks').delete().eq('id', taskId);
      toast.success('任务已删除');
      loadTasks();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 清空所有已完成的任务
  const clearCompletedTasks = async () => {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) {
      toast.error('没有已完成的任务');
      return;
    }
    
    if (!confirm(`确定要清空 ${completedTasks.length} 个已完成的任务吗？\n\n注意：这不会删除已导入的客户数据。`)) return;
    
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const ids = completedTasks.map(t => t.id);
      await supabase.from('scrape_tasks').delete().in('id', ids);
      toast.success(`已清空 ${completedTasks.length} 个任务`);
      loadTasks();
    } catch (error) {
      toast.error('清空失败');
    }
  };

  // 根据事业部的渠道权限过滤可用渠道
  const departmentChannels = (currentDepartment as any)?.allowed_channels || [];
  
  // 调试日志
  console.log('[渠道过滤] currentDepartment:', currentDepartment);
  console.log('[渠道过滤] allowed_channels:', departmentChannels);
  console.log('[渠道过滤] configuredActors:', configuredActors);
  
  const availableActors = APIFY_ACTORS.filter(actor => {
    // 首先检查是否在配置的 actors 中
    const isConfigured = configuredActors.length === 0 || configuredActors.includes(actor.id);
    if (!isConfigured) return false;
    
    // 如果事业部设置了渠道权限，则只显示允许的渠道
    if (departmentChannels.length > 0) {
      // 支持两种匹配方式：actor.id 或 actor.platform
      const isAllowed = departmentChannels.includes(actor.id) || departmentChannels.includes(actor.platform);
      return isAllowed;
    }
    
    // 如果没有设置渠道权限，则显示所有配置的渠道
    return true;
  });
  
  // 调试过滤结果
  console.log('[渠道过滤] availableActors:', availableActors.map(a => a.id));

  const regions = [...new Set(ALL_COUNTRIES.map(c => c.region))];

  return (
    <div className="space-y-6">
      {/* 提示信息 */}
      {configuredActors.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <p className="text-yellow-800 font-medium">未配置 Apify Actors</p>
            <p className="text-yellow-600 text-sm mt-1">
              请先在「系统设置」中配置要使用的 Apify Actors，系统将显示所有默认 Actors。
            </p>
          </div>
        </div>
      )}

      {/* 渠道提示 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-blue-800">要加更多的获客渠道，请联系后台管理员。</p>
          </div>
        </div>
      </div>

      {/* 抓取配置 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Search className="w-5 h-5 mr-2 text-blue-600" />
          客户抓取配置
        </h3>

        {/* 平台/Actor 选择 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择抓取平台（已配置支持邮箱抓取的 Actors）
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableActors.map(actor => {
              const Icon = actor.icon;
              const isSelected = selectedActors.includes(actor.id);
              return (
                <div
                  key={actor.id}
                  onClick={() => !isRunning && toggleActor(actor.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center">
                    <div className={`${actor.color} p-2 rounded-lg mr-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{actor.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {actor.supportsEmail ? (
                          <span className="text-green-600">✓ 支持邮箱抓取</span>
                        ) : (
                          <span className="text-gray-400">仅抓取基本信息</span>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="ml-2"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 关键词配置 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            搜索关键词（可添加多个）
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map(keyword => (
              <span
                key={keyword}
                className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  disabled={isRunning}
                  className="ml-2 hover:text-blue-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addKeyword()}
              disabled={isRunning}
              placeholder="输入关键词，按 Enter 添加"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={addKeyword}
              disabled={isRunning || !newKeyword.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 国家/地区选择 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            目标国家/地区（可多选）
          </label>
          <div className="space-y-4">
            {regions.map(region => (
              <div key={region}>
                <div className="flex items-center mb-2">
                  <button
                    onClick={() => selectAllInRegion(region)}
                    disabled={isRunning}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {region}
                  </button>
                  <span className="text-xs text-gray-400 ml-2">
                    (点击全选/取消)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_COUNTRIES.filter(c => c.region === region).map(country => (
                    <button
                      key={country.code}
                      onClick={() => toggleCountry(country.code)}
                      disabled={isRunning}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        selectedCountries.includes(country.code)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {country.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            已选择 {selectedCountries.length} 个国家/地区
          </div>
        </div>

        {/* 其他配置 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标行业
            </label>
            <select
              value={selectedIndustry}
              onChange={e => setSelectedIndustry(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {industries.map(industry => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              所有维度搜索总数
            </label>
            <input
              type="number"
              value={maxResults}
              onChange={e => setMaxResults(parseInt(e.target.value) || 100)}
              disabled={isRunning}
              min={10}
              max={5000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 预估数量显示 */}
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">平台数:</span>
                <span className="font-bold text-blue-600">{selectedActors.length}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">国家数:</span>
                <span className="font-bold text-blue-600">{selectedCountries.length}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">关键词数:</span>
                <span className="font-bold text-blue-600">{keywords.length}</span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">预估搜索维度:</span>
                <span className="font-bold text-purple-600 text-lg">
                  {(selectedActors.length * selectedCountries.length * keywords.length).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            每个维度结果数 = 搜索总数 ÷ 预估维度数（最少10条），实际结果可能因平台限制有所不同
          </p>
        </div>

        {/* 开始按钮 */}
        <div className="flex items-center justify-between">
          <button
            onClick={startScraping}
            disabled={isRunning || selectedActors.length === 0 || keywords.length === 0 || selectedCountries.length === 0}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              isRunning || selectedActors.length === 0 || keywords.length === 0 || selectedCountries.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                抓取中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                开始抓取
              </>
            )}
          </button>

          {isRunning && (
            <div className="flex items-center text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
              <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600" />
              <span className="mr-2">{progress.platform}</span>
              <span className="text-gray-400">|</span>
              <span className="ml-2">{progress.status}</span>
              <span className="ml-4 font-medium text-blue-600">
                {progress.current}/{progress.total}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 抓取历史 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-purple-600" />
            抓取历史
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={clearCompletedTasks}
              className="flex items-center text-sm text-gray-600 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              清空已完成
            </button>
            <button
              onClick={loadTasks}
              className="flex items-center text-sm text-gray-600 hover:text-gray-800"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">平台</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">关键词</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">国家/地区</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">结果数</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">有邮箱</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    暂无抓取记录
                  </td>
                </tr>
              ) : (
                tasks.map(task => {
                  const actor = APIFY_ACTORS.find(a => a.id === task.actorId || a.platform === task.platform);
                  return (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="flex items-center">
                          {actor && (
                            <div className={`${actor.color} p-1 rounded mr-2`}>
                              <actor.icon className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {actor?.name || task.platform}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                        {Array.isArray(task.keywords) ? task.keywords.join(', ') : task.keywords}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                        {Array.isArray(task.countries) ? task.countries.join(', ') : task.countries}
                      </td>
                      <td className="py-3 px-4">
                        {task.status === 'completed' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            完成
                          </span>
                        )}
                        {task.status === 'running' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            运行中
                          </span>
                        )}
                        {task.status === 'failed' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700" title={task.errorMessage}>
                            <XCircle className="w-3 h-3 mr-1" />
                            失败
                          </span>
                        )}
                        {task.status === 'pending' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            等待中
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-800">
                        {task.resultsCount}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-green-600">
                        {task.emailsCount}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(task.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {task.status === 'failed' && (
                            <button
                              onClick={() => retryTask(task)}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              重试
                            </button>
                          )}
                          {task.status === 'completed' && task.resultsCount === 0 && task.apifyRunId && (
                            <button
                              onClick={() => syncTask(task)}
                              className="text-sm text-green-600 hover:text-green-700"
                            >
                              同步
                            </button>
                          )}
                          {task.status !== 'running' && (
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};