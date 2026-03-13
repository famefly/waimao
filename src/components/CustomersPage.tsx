import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Mail,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { getSupabase, Customer } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { verifyEmailsBatch } from '../services/emailVerifyService';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const channelTypes = [
  { value: '', label: '全部类型' },
  { value: 'factory_oem', label: 'OEM工厂' },
  { value: 'distributor', label: '经销商' },
  { value: 'brand_agent', label: '品牌代理商' },
  { value: 'end_customer', label: '终端客户' },
  { value: 'contractor', label: '工程商' },
  { value: 'service_provider', label: '服务商' },
];

const statusFilters = [
  { value: '', label: '全部状态' },
  { value: 'verified', label: '已验证' },
  { value: 'invalid', label: '无效' },
  { value: 'pending', label: '待验证' },
];

export const CustomersPage: React.FC = () => {
  const { currentDepartment } = useStore();
  const currentUser = useStore(state => state.currentUser);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState({ current: 0, total: 0 });
  // 修改：countries 状态现在存储从所有客户中提取的唯一国家列表
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    loadCustomers();
  }, [currentDepartment, channelFilter, statusFilter, countryFilter]);

  const loadCustomers = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (currentUser?.role !== 'admin' && currentUser?.department_id) {
        query = query.eq('department_id', currentUser.department_id);
      } else if (currentDepartment) {
        query = query.eq('department_id', currentDepartment.id);
      }
      
      if (channelFilter) {
        query = query.eq('channel_type', channelFilter);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      // 修改 1: 移除这里的 countryFilter 查询条件
      // 原因：Supabase 的 .eq() 不直接支持数组的“包含”查询（需要 .contains() 或 .overlaps()）
      // 且如果 country 是 null，直接 eq 可能会有问题。
      // 我们将在前端进行筛选，这样更灵活。
      
      const { data } = await query;
      const customerList = (data || []) as Customer[];
      setCustomers(customerList);

      // 修改 2: 提取所有国家列表
      // 因为 country 现在是数组，我们需要先展平数组，再去重
      const allCountries = customerList.flatMap(c => c.country || []);
      const uniqueCountries = [...new Set(allCountries)].sort();
      setCountries(uniqueCountries);

    } catch (error) {
      console.error('加载客户失败:', error);
      toast.error('加载客户数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 修改 3: 前端筛选逻辑
  const filteredCustomers = customers.filter(customer => {
    // 搜索词筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const countryString = (customer.country || []).join(', ').toLowerCase();
      const matchText =
        customer.company_name?.toLowerCase().includes(term) ||
        customer.contact_name?.toLowerCase().includes(term) ||
        customer.contact_email?.toLowerCase().includes(term) ||
        countryString.includes(term);
      
      if (!matchText) return false;
    }

    // 国家筛选 (数组包含逻辑)
    if (countryFilter) {
      // 检查 customer.country 数组中是否包含 countryFilter
      // 并且处理 country 可能为 null 的情况
      if (!customer.country || !customer.country.includes(countryFilter)) {
        return false;
      }
    }

    return true;
  });

  const toggleSelect = (id: string | undefined) => {
    if (!id) return;
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCustomers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id).filter((id): id is string => !!id));
    }
  };

  const verifySelectedEmails = async () => {
    if (selectedIds.length === 0) {
      toast.error('请选择要验证的客户');
      return;
    }

    setVerifying(true);
    const customersToVerify = customers.filter(c => c.id && selectedIds.includes(c.id) && c.contact_email);
    const emails = customersToVerify.map(c => c.contact_email).filter((e): e is string => !!e);

    try {
      const results = await verifyEmailsBatch(
        emails,
        (processed, total) => setVerifyProgress({ current: processed, total })
      );

      const supabase = getSupabase();
      if (supabase) {
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const customer = customersToVerify[i];
          if (customer.id) {
            await supabase
              .from('customers')
              .update({
                email_verified: result.isValid,
                status: result.isValid ? 'verified' : 'invalid',
              } as never)
              .eq('id', customer.id);
          }
        }
      }

      toast.success(`验证完成！有效: ${results.filter(r => r.isValid).length}, 无效: ${results.filter(r => !r.isValid).length}`);
      loadCustomers();
    } catch (error) {
      toast.error('验证失败');
    } finally {
      setVerifying(false);
      setVerifyProgress({ current: 0, total: 0 });
      setSelectedIds([]);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确定要删除 ${selectedIds.length} 条记录吗？`)) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      await supabase.from('customers').delete().in('id', selectedIds);
      toast.success('删除成功');
      loadCustomers();
      setSelectedIds([]);
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 修改 4: 导出逻辑 - 将数组转为字符串
  const exportToExcel = () => {
    const exportData = filteredCustomers.map(c => ({
      '国家': (c.country || []).join(', '), // <--- 修改：数组转字符串
      '公司名称': c.company_name,
      '行业': c.industry,
      '主营产品': c.main_products,
      '渠道类型': channelTypes.find(t => t.value === c.channel_type)?.label || c.channel_type,
      '年营业额': c.annual_revenue,
      '年采购量': c.annual_purchase,
      '联系人': c.contact_name,
      '电话': c.contact_phone,
      '邮箱': c.contact_email,
      '邮箱验证': c.email_verified ? '有效' : '未验证',
      '数据来源': c.source_platform,
      '状态': statusFilters.find(s => s.value === c.status)?.label || c.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '客户数据');
    XLSX.writeFile(wb, `客户数据_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('导出成功');
  };

  // 修改 5: 导入逻辑 - 将字符串拆分为数组
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(ws) as Record<string, string>[];

      const supabase = getSupabase();
      if (!supabase) return;

      const deptId = currentUser?.department_id || currentDepartment?.id;
      
      const customersToInsert = jsonData.map(row => {
        // 处理国家：可能是字符串 "US, CN"，需要拆分
        let rawCountry = row['国家'] || row['Country'] || '';
        let countryArray: string[] = [];
        if (rawCountry) {
          // 按逗号分隔，并去除首尾空格
          countryArray = rawCountry.toString().split(/,|，/).map(s => s.trim()).filter(s => s);
        }

        return {
          country: countryArray.length > 0 ? countryArray : null, // <--- 修改：存入数组
          company_name: row['公司名称'] || row['Company Name'] || row['company_name'],
          industry: row['行业'] || row['Industry'],
          main_products: row['主营产品'] || row['Main Products'],
          channel_type: row['渠道类型'] || row['Channel Type'] || 'distributor',
          annual_revenue: row['年营业额'] || row['Annual Revenue'],
          annual_purchase: row['年采购量'] || row['Annual Purchase'],
          contact_name: row['联系人'] || row['Contact Name'],
          contact_phone: row['电话'] || row['Phone'],
          contact_email: row['邮箱'] || row['Email'],
          department_id: deptId,
          status: 'pending',
        };
      });

      await supabase.from('customers').insert(customersToInsert as never);
      toast.success(`成功导入 ${customersToInsert.length} 条数据`);
      loadCustomers();
    } catch (error) {
      console.error(error);
      toast.error('导入失败，请检查文件格式');
    }

    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索公司、联系人、邮箱..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 筛选 */}
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {channelTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {statusFilters.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>

          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部国家</option>
            {countries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={verifySelectedEmails}
              disabled={selectedIds.length === 0 || verifying}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1" />
              )}
              验证邮箱
            </button>

            <button
              onClick={deleteSelected}
              disabled={selectedIds.length === 0}
              className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              删除
            </button>

            <button
              onClick={exportToExcel}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-1" />
              导出
            </button>

            <label className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
              <Upload className="w-4 h-4 mr-1" />
              导入
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={loadCustomers}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 验证进度 */}
        {verifying && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>正在验证邮箱...</span>
              <span>{verifyProgress.current}/{verifyProgress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${(verifyProgress.current / verifyProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 客户列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            客户列表
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredCustomers.length} 条记录)
            </span>
          </h3>
          {selectedIds.length > 0 && (
            <span className="text-sm text-blue-600">已选择 {selectedIds.length} 条</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">公司名称</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">国家</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">行业</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">渠道类型</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">联系人</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">邮箱</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">状态</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    暂无客户数据
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={!!customer.id && selectedIds.includes(customer.id)}
                        onChange={() => toggleSelect(customer.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">{customer.company_name}</td>
                    {/* 修改 6: 显示国家数组 */}
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {(customer.country || []).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{customer.industry}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {channelTypes.find(t => t.value === customer.channel_type)?.label || customer.channel_type}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{customer.contact_name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Mail className="w-3 h-3 mr-1 text-gray-400" />
                        {customer.contact_email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {customer.status === 'verified' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已验证
                        </span>
                      )}
                      {customer.status === 'invalid' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <XCircle className="w-3 h-3 mr-1" />
                          无效
                        </span>
                      )}
                      {customer.status === 'pending' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          待验证
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};