import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Globe,
  MapPin,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  X,
  RefreshCw,
  AlertTriangle,
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
const APIFY_ACTORS = [
  {
    id: 'compass/crawler-google-places',
    name: 'Google Maps (带邮箱)',
    platform: 'google_maps',
    icon: MapPin,
    color: 'bg-red-500',
    supportsEmail: true,
  },
  {
    id: 'curious_coder/facebook-pages-scraper',
    name: 'Facebook Pages',
    platform: 'facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    supportsEmail: true,
  },
  {
    id: 'apify/instagram-profile-scraper',
    name: 'Instagram Profile',
    platform: 'instagram',
    icon: Instagram,
    color: 'bg-pink-500',
    supportsEmail: true,
  },
  {
    id: 'anchor/linkedin-company-scraper',
    name: 'LinkedIn Companies (带邮箱)',
    platform: 'linkedin',
    icon: Linkedin,
    color: 'bg-blue-700',
    supportsEmail: true,
  },
  {
    id: 'quacker/twitter-scraper',
    name: 'Twitter/X',
    platform: 'twitter',
    icon: Twitter,
    color: 'bg-black',
    supportsEmail: false,
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
  const [maxResults, setMaxResults] = useState(50);
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
    setProgress({ current: 0, total: selectedActors.length, status: '准备中...', platform: '' });

    const countryNames = selectedCountries.map(
      code => ALL_COUNTRIES.find(c => c.code === code)?.name || code
    );

    for (let i = 0; i < selectedActors.length; i++) {
      const actorId = selectedActors[i];
      const actor = APIFY_ACTORS.find(a => a.id === actorId);
      
      if (!actor) continue;

      const platformName = actor.name;
      setProgress({
        current: i + 1,
        total: selectedActors.length,
        status: `正在抓取...`,
        platform: platformName,
      });

      // 创建任务记录
      const { data: taskData, error: taskError } = await supabase
        .from('scrape_tasks')
        .insert({
          platform: actor.platform,
          keywords: keywords,
          countries: countryNames,
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
        toast.error('创建任务失败');
        continue;
      }

      const taskId = (taskData as unknown as { id: string })?.id;

      try {
        // 使用 apifyservices 中的 buildActorInput 函数构建输入参数
        const { input } = buildActorInput(actor.platform, {
          keywords,
          countries: countryNames,
          industry: selectedIndustry,
          maxResults,
        });

        // 调用后端 API 来启动抓取任务
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId,
            actorId,
            input,
          }),
        });

        if (!response.ok) {
          throw new Error(`API 错误: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        // 更新任务状态为运行中
        await supabase
          .from('scrape_tasks')
          .update({
            status: 'running',
          } as never)
          .eq('id', taskId);

        toast.success(`${platformName} 抓取任务已启动`);
        
        addNotification({
          type: 'success',
          title: '抓取任务已启动',
          message: `${platformName} 抓取任务已启动，将在后台运行`,
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
          message: `${platformName} 启动失败: ${errorMsg}`,
        });
      }
    }

    setIsRunning(false);
    setProgress({ current: 0, total: 0, status: '', platform: '' });
    loadTasks();
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

  const availableActors = APIFY_ACTORS.filter(
    actor => configuredActors.length === 0 || configuredActors.includes(actor.id)
  );

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
              每个平台最大结果数
            </label>
            <input
              type="number"
              value={maxResults}
              onChange={e => setMaxResults(parseInt(e.target.value) || 50)}
              disabled={isRunning}
              min={10}
              max={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
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
          <button
            onClick={loadTasks}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </button>
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
                        {task.status === 'failed' && (
                          <button
                            onClick={() => retryTask(task)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            重试
                          </button>
                        )}
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