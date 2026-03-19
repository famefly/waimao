import React, { useEffect, useState } from 'react';
import {
  Users,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Globe,
  Building,
  Search, // 新增：用于关键词图标
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getSupabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface Stats {
  totalCustomers: number;
  verifiedEmails: number;
  totalSent: number;
  emailsRead: number;
  emailsFailed: number;
  emailsPending: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const Dashboard: React.FC = () => {
  const { currentDepartment } = useStore();
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    verifiedEmails: 0,
    totalSent: 0,
    emailsRead: 0,
    emailsFailed: 0,
    emailsPending: 0,
  });
  
  // 1. 新增：关键词数据状态
  const [countryData, setCountryData] = useState<Array<{ name: string; count: number }>>([]);
  const [channelData, setChannelData] = useState<Array<{ name: string; value: number }>>([]);
  const [keywordData, setKeywordData] = useState<Array<{ name: string; count: number }>>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [currentDepartment]);

  const loadStats = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 添加超时保护 (30秒)
    const timeout = setTimeout(() => {
      setLoading(false);
      console.warn('Dashboard loading timeout - please check network connection');
    }, 30000);

    try {
      console.log('Dashboard: Loading stats...');
      // --- 获取客户统计 ---
      let customerQuery = supabase.from('customers').select('*');
      if (currentDepartment) {
        customerQuery = customerQuery.eq('department_id', currentDepartment.id);
      }
      const { data: customers } = await customerQuery;
      
      const customerList = (customers || []) as Array<{
        email_verified: boolean;
        country: string[]; // 数组
        channel_type: string;
      }>;

      // --- 获取邮件统计 ---
      let emailQuery = supabase.from('email_campaigns').select('status');
      if (currentDepartment) {
        emailQuery = emailQuery.eq('department_id', currentDepartment.id);
      }
      const { data: emails } = await emailQuery;
      const emailList = (emails || []) as Array<{ status: string }>;

      // --- 2. 新增：获取抓取任务统计 (用于关键词) ---
      let taskQuery = supabase.from('scrape_tasks').select('keywords');
      if (currentDepartment) {
        taskQuery = taskQuery.eq('department_id', currentDepartment.id);
      }
      const { data: tasks } = await taskQuery;
      const taskList = (tasks || []) as Array<{ keywords: string[] }>;

      // 设置基础统计数据
      setStats({
        totalCustomers: customerList.length,
        verifiedEmails: customerList.filter(c => c.email_verified).length,
        totalSent: emailList.filter(e => e.status === 'sent' || e.status === 'read').length,
        emailsRead: emailList.filter(e => e.status === 'read').length,
        emailsFailed: emailList.filter(e => e.status === 'failed').length,
        emailsPending: emailList.filter(e => e.status === 'pending').length,
      });

      // --- 处理国家数据 (数组) ---
      const countryMap: Record<string, number> = {};
      customerList.forEach(c => {
        const countries = c.country || [];
        countries.forEach(singleCountry => {
          const name = singleCountry || '未知';
          countryMap[name] = (countryMap[name] || 0) + 1;
        });
      });
      const sortedCountries = Object.entries(countryMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setCountryData(sortedCountries);

      // --- 处理渠道数据 (保持不变) ---
      const channelMap: Record<string, number> = {};
      customerList.forEach(c => {
        const channel = c.channel_type || '其他';
        channelMap[channel] = (channelMap[channel] || 0) + 1;
      });
      setChannelData(
        Object.entries(channelMap).map(([name, value]) => ({ name, value }))
      );

      // --- 3. 新增：处理关键词数据 (数组) ---
      const keywordMap: Record<string, number> = {};
      taskList.forEach(t => {
        const kws = t.keywords || [];
        kws.forEach(k => {
          if (k) { // 排除空字符串
            keywordMap[k] = (keywordMap[k] || 0) + 1;
          }
        });
      });
      const sortedKeywords = Object.entries(keywordMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8); // 取前8个
      setKeywordData(sortedKeywords);

    } catch (error) {
      console.error('加载统计数据失败:', error);
      // 显示更详细的错误信息
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: '总客户数',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%',
    },
    {
      title: '有效邮箱',
      value: stats.verifiedEmails,
      icon: CheckCircle,
      color: 'bg-green-500',
      change: `${stats.totalCustomers > 0 ? Math.round((stats.verifiedEmails / stats.totalCustomers) * 100) : 0}%`,
    },
    {
      title: '已发送邮件',
      value: stats.totalSent,
      icon: Mail,
      color: 'bg-purple-500',
      change: '+8%',
    },
    {
      title: '邮件已读',
      value: stats.emailsRead,
      icon: TrendingUp,
      color: 'bg-yellow-500',
      change: `${stats.totalSent > 0 ? Math.round((stats.emailsRead / stats.totalSent) * 100) : 0}%`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
                  <p className="text-sm text-green-600 mt-1">{card.change}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 国家分布 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center mb-4">
            <Globe className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">客户国家分布</h3>
          </div>
          {countryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={countryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              暂无数据
            </div>
          )}
        </div>

        {/* 渠道类型分布 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center mb-4">
            <Building className="w-5 h-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">客户类型分布</h3>
          </div>
          {channelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              暂无数据
            </div>
          )}
        </div>
      </div>

      {/* 4. 新增：热门关键词图表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center mb-4">
          <Search className="w-5 h-5 text-orange-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">热门搜索关键词</h3>
        </div>
        {keywordData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={keywordData} layout="horizontal"> {/* 水平条形图适合较长的关键词文本 */}
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" hide /> /* 隐藏X轴数值，保持简洁，或者显示: <XAxis type="number" /> */
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: any) => [value, '搜索次数']}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              />
              <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-400">
            暂无搜索关键词数据
          </div>
        )}
      </div>

      {/* 邮件发送状态 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center mb-6">
          <Mail className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">邮件发送状态</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{stats.emailsPending}</p>
            <p className="text-sm text-blue-500">待发送</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <Mail className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.totalSent}</p>
            <p className="text-sm text-green-500">已发送</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <CheckCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-600">{stats.emailsRead}</p>
            <p className="text-sm text-yellow-500">已阅读</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats.emailsFailed}</p>
            <p className="text-sm text-red-500">发送失败</p>
          </div>
        </div>
      </div>
    </div>
  );
};