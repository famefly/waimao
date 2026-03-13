import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Eye,
  RefreshCw,
  Loader2,
  XCircle,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import { getSupabase, Customer, EmailCampaign } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { generateDevelopmentEmail, EMAIL_TEMPLATES, LANGUAGES } from '../services/zhipuService';
import { sendEmailsBatch, resendFailedEmails, getEmailStats } from '../services/resendService';
import toast from 'react-hot-toast';

export const EmailsPage: React.FC = () => {
  const { currentUser, currentDepartment, addNotification } = useStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'compose' | 'history'>('compose');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, { subject: string; content: string; language: string }>>({});
  const [stats, setStats] = useState({ total: 0, sent: 0, read: 0, failed: 0, pending: 0 });
  const [previewEmail, setPreviewEmail] = useState<{ subject: string; content: string } | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sent' | 'read' | 'failed'>('all');

  useEffect(() => {
    loadData();
  }, [currentDepartment]);

  const loadData = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 加载已验证的客户
      let customerQuery = supabase
        .from('customers')
        .select('*')
        .eq('status', 'verified')
        .order('created_at', { ascending: false });

      // 根据用户权限过滤
      if (currentUser?.role !== 'admin' && currentUser?.department_id) {
        customerQuery = customerQuery.eq('department_id', currentUser.department_id);
      } else if (currentDepartment?.id) {
        customerQuery = customerQuery.eq('department_id', currentDepartment.id);
      }

      const { data: customerData } = await customerQuery;
      setCustomers((customerData || []) as Customer[]);

      // 加载邮件历史
      let campaignQuery = supabase
        .from('email_campaigns')
        .select('*, customers(*)')
        .order('created_at', { ascending: false });

      if (currentUser?.role !== 'admin' && currentUser?.department_id) {
        campaignQuery = campaignQuery.eq('department_id', currentUser.department_id);
      } else if (currentDepartment?.id) {
        campaignQuery = campaignQuery.eq('department_id', currentDepartment.id);
      }

      const { data: campaignData } = await campaignQuery;
      setCampaigns((campaignData || []) as EmailCampaign[]);

      // 加载统计
      const deptId = currentUser?.department_id || currentDepartment?.id;
      const emailStats = await getEmailStats(deptId);
      setStats(emailStats);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomer = (id: string | undefined) => {
    if (!id) return;
    setSelectedCustomerIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllCustomers = () => {
    if (selectedCustomerIds.length === customers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(customers.map(c => c.id).filter((id): id is string => !!id));
    }
  };

  const generateEmails = async () => {
    if (selectedCustomerIds.length === 0) {
      toast.error('请选择要发送的客户');
      return;
    }

    setGenerating(true);
    setProgress({ current: 0, total: selectedCustomerIds.length });
    const emails: Record<string, { subject: string; content: string; language: string }> = {};

    const selectedCustomers = customers.filter(c => c.id && selectedCustomerIds.includes(c.id));

    for (let i = 0; i < selectedCustomers.length; i++) {
      const customer = selectedCustomers[i];
      setProgress({ current: i + 1, total: selectedCustomers.length });

      try {
        // 修改：处理 country 数组
        // 如果 country 是数组，取第一个元素，或者用逗号连接
        let countryString = '';
        if (Array.isArray(customer.country)) {
          if (customer.country.length > 0) {
            // 优先取第一个国家作为主要目标市场，或者用 join(', ')
            // 这里为了生成邮件的准确性，通常取第一个
            countryString = customer.country[0]; 
          }
        } else {
          countryString = customer.country || '';
        }

        const email = await generateDevelopmentEmail({
          customerName: customer.contact_name || '',
          companyName: customer.company_name || '',
          country: countryString, // <--- 修改：传入处理后的字符串
          industry: customer.industry || '',
          channelType: (customer.channel_type as keyof typeof EMAIL_TEMPLATES) || 'distributor',
          mainProducts: customer.main_products || '',
        });

        if (customer.id) {
          emails[customer.id] = email;
        }
      } catch (error) {
        console.error(`生成邮件失败 (${customer.company_name}):`, error);
        toast.error(`${customer.company_name} 邮件生成失败`);
      }
    }

    setGeneratedEmails(emails);
    setGenerating(false);
    
    // 添加通知
    addNotification({
      type: 'success',
      title: '邮件生成完成',
      message: `成功生成 ${Object.keys(emails).length} 封开发信`
    });
    
    toast.success(`成功生成 ${Object.keys(emails).length} 封开发信`);
  };

  const sendAllEmails = async () => {
    const emailsToSend = Object.entries(generatedEmails).map(([customerId, email]) => {
      const customer = customers.find(c => c.id === customerId);
      return {
        customerId,
        to: customer?.contact_email || '',
        subject: email.subject,
        content: email.content,
        language: email.language,
      };
    }).filter(e => e.to);

    if (emailsToSend.length === 0) {
      toast.error('没有可发送的邮件');
      return;
    }

    setSending(true);
    setProgress({ current: 0, total: emailsToSend.length });

    try {
      const deptId = currentUser?.department_id || currentDepartment?.id || '';
      const results = await sendEmailsBatch(
        emailsToSend,
        deptId,
        (processed, total) => setProgress({ current: processed, total })
      );

      const successCount = results.filter(r => r.result.success).length;
      const failCount = results.filter(r => !r.result.success).length;

      // 添加通知
      if (failCount > 0) {
        addNotification({
          type: 'warning',
          title: '邮件发送部分失败',
          message: `成功: ${successCount}, 失败: ${failCount}`
        });
      } else {
        addNotification({
          type: 'success',
          title: '邮件发送完成',
          message: `成功发送 ${successCount} 封邮件`
        });
      }

      toast.success(`发送完成！成功: ${successCount}, 失败: ${failCount}`);
      setGeneratedEmails({});
      setSelectedCustomerIds([]);
      loadData();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '邮件发送失败',
        message: '发送过程中出现错误，请检查网络和API配置'
      });
      toast.error('发送失败');
    } finally {
      setSending(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const resendFailed = async () => {
    const failedCampaigns = campaigns.filter(c => c.status === 'failed');
    if (failedCampaigns.length === 0) {
      toast.error('没有失败的邮件');
      return;
    }

    setSending(true);
    setProgress({ current: 0, total: failedCampaigns.length });

    try {
      const campaignIds = failedCampaigns.map(c => c.id).filter((id): id is string => !!id);
      const successCount = await resendFailedEmails(
        campaignIds,
        (processed, total) => setProgress({ current: processed, total })
      );

      addNotification({
        type: 'success',
        title: '重发完成',
        message: `成功重发 ${successCount} 封邮件`
      });
      
      toast.success(`重发完成！成功: ${successCount}`);
      loadData();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '重发失败',
        message: '重发过程中出现错误'
      });
      toast.error('重发失败');
    } finally {
      setSending(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (historyFilter === 'all') return true;
    return c.status === historyFilter;
  });

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Mail className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-sm text-gray-500">总邮件</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Send className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
          <p className="text-sm text-gray-500">已发送</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Eye className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-600">{stats.read}</p>
          <p className="text-sm text-gray-500">已阅读</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          <p className="text-sm text-gray-500">发送失败</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
          <p className="text-sm text-gray-500">待发送</p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setTab('compose')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tab === 'compose'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />
              AI 生成开发信
            </button>
            <button
              onClick={() => setTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-2" />
              发送历史
            </button>
          </nav>
        </div>

        <div className="p-6">
          {tab === 'compose' ? (
            <div className="space-y-6">
              {/* 客户选择 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-blue-600" />
                    选择目标客户（已验证邮箱）
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllCustomers}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {selectedCustomerIds.length === customers.length ? '取消全选' : '全选'}
                    </button>
                    <span className="text-sm text-gray-500">
                      已选 {selectedCustomerIds.length}/{customers.length}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : customers.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    暂无已验证邮箱的客户，请先抓取并验证客户数据
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {customers.map(customer => (
                      <label
                        key={customer.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          customer.id && selectedCustomerIds.includes(customer.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!customer.id && selectedCustomerIds.includes(customer.id)}
                          onChange={() => toggleCustomer(customer.id)}
                          className="rounded border-gray-300 mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{customer.company_name}</p>
                          {/* 修改：显示国家数组 */}
                          <p className="text-xs text-gray-500 truncate">
                            {Array.isArray(customer.country) ? customer.country.join(', ') : customer.country} · {customer.contact_email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-4">
                <button
                  onClick={generateEmails}
                  disabled={selectedCustomerIds.length === 0 || generating}
                  className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      生成中 ({progress.current}/{progress.total})
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      AI 生成开发信
                    </>
                  )}
                </button>

                {Object.keys(generatedEmails).length > 0 && (
                  <button
                    onClick={sendAllEmails}
                    disabled={sending}
                    className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        发送中 ({progress.current}/{progress.total})
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        发送全部 ({Object.keys(generatedEmails).length})
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 生成的邮件预览 */}
              {Object.keys(generatedEmails).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-semibold text-gray-800 mb-3">已生成的开发信预览</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {Object.entries(generatedEmails).map(([customerId, email]) => {
                      const customer = customers.find(c => c.id === customerId);
                      return (
                        <div
                          key={customerId}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer"
                          onClick={() => setPreviewEmail(email)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-800">{customer?.company_name}</span>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {LANGUAGES[email.language]?.name || email.language}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">主题：{email.subject}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* 筛选 */}
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    historyFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setHistoryFilter('sent')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    historyFilter === 'sent' ? 'bg-green-100 text-green-700' : 'text-gray-500'
                  }`}
                >
                  已发送
                </button>
                <button
                  onClick={() => setHistoryFilter('read')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    historyFilter === 'read' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-500'
                  }`}
                >
                  已阅读
                </button>
                <button
                  onClick={() => setHistoryFilter('failed')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    historyFilter === 'failed' ? 'bg-red-100 text-red-700' : 'text-gray-500'
                  }`}
                >
                  发送失败
                </button>

                {stats.failed > 0 && (
                  <button
                    onClick={resendFailed}
                    disabled={sending}
                    className="ml-auto flex items-center px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${sending ? 'animate-spin' : ''}`} />
                    重发失败邮件
                  </button>
                )}
              </div>

              {/* 邮件列表 */}
              <div className="space-y-3">
                {filteredCampaigns.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    暂无邮件记录
                  </div>
                ) : (
                  filteredCampaigns.map(campaign => (
                    <div
                      key={campaign.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer"
                      onClick={() => setPreviewEmail({ subject: campaign.subject, content: campaign.content })}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {campaign.status === 'sent' && <Send className="w-4 h-4 text-green-500" />}
                          {campaign.status === 'read' && <Eye className="w-4 h-4 text-yellow-500" />}
                          {campaign.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                          {campaign.status === 'pending' && <Clock className="w-4 h-4 text-gray-500" />}
                          <span className="font-medium text-gray-800">{campaign.subject}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {campaign.sent_at ? new Date(campaign.sent_at).toLocaleString('zh-CN') : '-'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{campaign.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 邮件预览模态框 */}
      {previewEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">邮件预览</h3>
              <button
                onClick={() => setPreviewEmail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <label className="text-sm text-gray-500">主题</label>
                <p className="font-medium text-gray-800">{previewEmail.subject}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">内容</label>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-gray-700">
                  {previewEmail.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};