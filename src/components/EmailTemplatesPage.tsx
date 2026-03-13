import { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Copy, X, ChevronDown, ChevronUp, Globe, Check } from 'lucide-react';
import { getSupabase, EmailTemplate } from '../lib/supabase';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

// 客户类型选项
const CHANNEL_TYPES = [
  { value: 'brand_agent', label: '品牌代理商', color: 'bg-purple-100 text-purple-800' },
  { value: 'distributor', label: '经销商', color: 'bg-blue-100 text-blue-800' },
  { value: 'factory', label: '工厂/OEM', color: 'bg-orange-100 text-orange-800' },
  { value: 'joint_venture', label: '合资公司', color: 'bg-green-100 text-green-800' },
  { value: 'end_customer', label: '终端客户', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'contractor', label: '工程商', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'service_provider', label: '服务商', color: 'bg-pink-100 text-pink-800' },
  { value: 'supermarket', label: '商超', color: 'bg-red-100 text-red-800' },
];

// 语言选项
const LANGUAGES = [
  { value: 'en', label: '英语', flag: '🇬🇧' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'es', label: '西班牙语', flag: '🇪🇸' },
  { value: 'fr', label: '法语', flag: '🇫🇷' },
  { value: 'de', label: '德语', flag: '🇩🇪' },
  { value: 'ar', label: '阿拉伯语', flag: '🇸🇦' },
  { value: 'ru', label: '俄语', flag: '🇷🇺' },
  { value: 'pt', label: '葡萄牙语', flag: '🇵🇹' },
  { value: 'ja', label: '日语', flag: '🇯🇵' },
  { value: 'ko', label: '韩语', flag: '🇰🇷' },
];

// 默认模板示例 - 覆盖所有客户类型
const DEFAULT_TEMPLATES = [
  // 品牌代理商
  {
    name: '品牌代理商开发信 - 英文',
    channel_type: 'brand_agent',
    language: 'en',
    subject_template: 'Exclusive Agency Partnership - Premium Construction Equipment',
    content_template: `Dear {{contact_name}},

I hope this email finds you well. I am {{sender_name}} from Yuantuo Building Materials Group, a leading manufacturer of scaffolding and aluminum formwork systems.

We are actively seeking exclusive brand agents in {{country}} to represent our premium construction equipment line. Given {{company_name}}'s excellent reputation and market presence in the {{industry}} sector, we believe you could be an ideal partner.

Why partner with us as Brand Agent:
✓ Exclusive territory rights
✓ Attractive profit margins (30-50%)
✓ Marketing support and brand materials
✓ Technical training for your team
✓ Protected pricing policy

Our flagship products include:
• Ringlock Scaffolding Systems (EN12810 certified)
• Aluminum Formwork for High-rise Construction
• Heavy-duty Shoring Systems

We are prepared to offer competitive terms for the right partner. Would you be interested in discussing this opportunity further?

Best regards,
{{sender_name}}
Yuantuo Building Materials Group`,
  },
  // 经销商
  {
    name: '经销商开发信 - 英文',
    channel_type: 'distributor',
    language: 'en',
    subject_template: 'Partnership Opportunity - Premium Scaffolding & Formwork Solutions',
    content_template: `Dear {{contact_name}},

I hope this email finds you well. My name is {{sender_name}} from Yuantuo Building Materials Group, a leading manufacturer of scaffolding and aluminum formwork systems in China.

I noticed that {{company_name}} is a well-established company in the {{industry}} sector in {{country}}. We believe there could be a great opportunity for us to collaborate and bring high-quality, cost-effective construction solutions to your market.

Our product range includes:
• Ringlock Scaffolding Systems
• Aluminum Formwork for Construction
• Steel Props and Shoring Systems
• Safety Equipment and Accessories

As a manufacturer with our own factory, we offer:
✓ Competitive factory-direct pricing
✓ OEM/ODM customization services
✓ Strict quality control (ISO certified)
✓ Reliable delivery and logistics support

Would you be interested in learning more about our products and potential cooperation models? I would be happy to send you our product catalog and price list.

Looking forward to your reply.

Best regards,
{{sender_name}}
Yuantuo Building Materials Group`,
  },
  // 工厂/OEM
  {
    name: '工厂OEM合作 - 英文',
    channel_type: 'factory',
    language: 'en',
    subject_template: 'OEM Manufacturing Partnership - Scaffolding & Formwork',
    content_template: `Dear {{contact_name}},

Greetings from Yuantuo Building Materials Group!

We are reaching out to explore potential OEM manufacturing partnership opportunities with {{company_name}}.

As one of China's leading manufacturers of scaffolding and formwork systems, we have:
• 20+ years of manufacturing experience
• Modern production facilities with annual capacity of 50,000+ tons
• Complete R&D and quality testing capabilities
• Experience serving major international brands

Our OEM services include:
1. Custom product development based on your specifications
2. Private labeling and branding
3. Flexible MOQ to meet your needs
4. Competitive pricing with consistent quality

We would be honored to discuss how we can support your business growth. May I schedule a call or video meeting at your convenience?

Best regards,
{{sender_name}}`,
  },
  // 合资公司
  {
    name: '合资公司合作 - 英文',
    channel_type: 'joint_venture',
    language: 'en',
    subject_template: 'Strategic Partnership Opportunity - Joint Venture in {{country}}',
    content_template: `Dear {{contact_name}},

I am writing to explore a potential strategic partnership between Yuantuo Building Materials Group and {{company_name}}.

As {{country}}'s construction industry continues to grow, we see tremendous opportunity for a joint venture that combines:
• Your local market expertise and relationships
• Our manufacturing capabilities and product technology

Our vision for partnership:
1. Establish local manufacturing/assembly facility
2. Combine sales networks for market expansion
3. Share technology and best practices
4. Create sustainable competitive advantages

We have successfully established similar partnerships in other markets and would be delighted to share our experience.

Would you be open to an exploratory discussion?

Best regards,
{{sender_name}}
Yuantuo Building Materials Group`,
  },
  // 终端客户
  {
    name: '终端客户项目合作 - 英文',
    channel_type: 'end_customer',
    language: 'en',
    subject_template: 'Construction Project Solutions - Direct Factory Supply',
    content_template: `Dear {{contact_name}},

I am writing to introduce our construction material solutions that may benefit your upcoming projects.

Yuantuo Building Materials Group specializes in providing comprehensive scaffolding and formwork solutions for construction projects of all scales.

For project customers, we offer:
• Complete project solutions from design to delivery
• Technical support and on-site guidance
• Competitive project pricing
• Fast production and shipping

Our products have been used in:
- High-rise residential buildings
- Commercial complexes
- Infrastructure projects
- Industrial facilities

Would you have any ongoing or upcoming projects where our solutions could add value?

Looking forward to learning more about your project needs.

Best regards,
{{sender_name}}
Yuantuo Building Materials Group`,
  },
  // 工程商
  {
    name: '工程商合作 - 英文',
    channel_type: 'contractor',
    language: 'en',
    subject_template: 'Construction Equipment Supply - Contractor Special Pricing',
    content_template: `Dear {{contact_name}},

I hope this message finds you in the midst of successful projects. I am {{sender_name}} from Yuantuo Building Materials Group.

We understand that as a contractor in {{country}}, you need reliable equipment suppliers who can deliver quality products on time and within budget.

What we offer contractors like {{company_name}}:
✓ Contractor-special pricing (10-20% below market)
✓ Flexible rental and purchase options
✓ On-site technical support
✓ Emergency supply capability
✓ Long-term partnership programs

Our equipment range:
• Scaffolding systems for all building types
• Aluminum formwork for concrete works
• Shoring and support systems
• Safety equipment and accessories

Let's discuss how we can support your upcoming projects.

Best regards,
{{sender_name}}`,
  },
  // 服务商
  {
    name: '服务商合作 - 英文',
    channel_type: 'service_provider',
    language: 'en',
    subject_template: 'Equipment Supply Partnership for Service Providers',
    content_template: `Dear {{contact_name}},

Greetings from Yuantuo Building Materials Group!

We are reaching out to {{company_name}} as we expand our network of service partners in {{country}}.

As a service provider in the {{industry}} sector, you understand the importance of having reliable equipment sources. We can offer:

Partner Benefits:
• Preferred pricing for regular orders
• Priority production scheduling
• Technical training for your team
• Marketing collaboration opportunities
• Referral commission program

Our product expertise spans scaffolding, formwork, and construction support systems - all manufactured in our own facilities with strict quality control.

Would you be interested in exploring a partnership?

Best regards,
{{sender_name}}`,
  },
  // 商超
  {
    name: '商超渠道合作 - 英文',
    channel_type: 'supermarket',
    language: 'en',
    subject_template: 'Retail Partnership - Construction & DIY Products',
    content_template: `Dear {{contact_name}},

I am {{sender_name}} from Yuantuo Building Materials Group, and I am reaching out regarding a potential retail partnership with {{company_name}}.

We manufacture a range of construction products suitable for retail channels, including:
• DIY scaffolding kits
• Portable work platforms
• Safety accessories
• Small-scale construction tools

Why stock our products:
✓ Competitive retail margins
✓ Professional packaging design
✓ Marketing display support
✓ Reliable stock replenishment
✓ Quality guaranteed products

We have experience working with major retail chains and understand the requirements of retail partnerships.

I would be happy to send product catalogs and discuss potential terms.

Best regards,
{{sender_name}}
Yuantuo Building Materials Group`,
  },
];

export function EmailTemplatesPage() {
  const { currentUser } = useStore();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    channel_type: '',
    language: 'en',
    subject_template: '',
    content_template: ''
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('数据库未连接');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase.from('email_templates').select('*');
      
      // 如果是普通用户，只显示其事业部的模板
      if (currentUser?.role !== 'admin' && currentUser?.department_id) {
        query = query.or(`department_id.eq.${currentUser.department_id},department_id.is.null`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data as EmailTemplate[]) || []);
    } catch (err) {
      console.error('Load templates error:', err);
      toast.error('加载模板失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.channel_type || !formData.subject_template || !formData.content_template) {
      toast.error('请填写所有必填字段');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      toast.error('数据库未连接');
      return;
    }

    try {
      const templateData = {
        name: formData.name,
        channel_type: formData.channel_type,
        language: formData.language,
        subject_template: formData.subject_template,
        content_template: formData.content_template,
        department_id: currentUser?.department_id || null
      };

      if (editingTemplate) {
        const { error } = await supabase.from('email_templates')
          .update(templateData as never)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('模板更新成功');
      } else {
        const { error } = await supabase.from('email_templates')
          .insert([templateData] as never);

        if (error) throw error;
        toast.success('模板创建成功');
      }

      setShowModal(false);
      resetForm();
      loadTemplates();
    } catch (err) {
      console.error('Save template error:', err);
      toast.error('操作失败');
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (!confirm(`确定要删除模板 "${template.name}" 吗？`)) return;

    const supabase = getSupabase();
    if (!supabase) {
      toast.error('数据库未连接');
      return;
    }

    try {
      const { error } = await supabase.from('email_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      toast.success('模板已删除');
      loadTemplates();
    } catch (err) {
      console.error('Delete template error:', err);
      toast.error('删除失败');
    }
  };

  const handleCopyTemplate = (template: EmailTemplate) => {
    setFormData({
      name: `${template.name} (副本)`,
      channel_type: template.channel_type,
      language: template.language,
      subject_template: template.subject_template,
      content_template: template.content_template
    });
    setEditingTemplate(null);
    setShowModal(true);
  };

  const handleImportDefaults = async () => {
    if (!confirm('确定要导入默认模板吗？这将添加多个常用模板。')) return;

    const supabase = getSupabase();
    if (!supabase) {
      toast.error('数据库未连接');
      return;
    }

    try {
      const templatesData = DEFAULT_TEMPLATES.map(t => ({
        ...t,
        department_id: currentUser?.department_id || null
      }));

      const { error } = await supabase.from('email_templates')
        .insert(templatesData as never);

      if (error) throw error;
      toast.success('默认模板导入成功');
      loadTemplates();
    } catch (err) {
      console.error('Import defaults error:', err);
      toast.error('导入失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      channel_type: '',
      language: 'en',
      subject_template: '',
      content_template: ''
    });
    setEditingTemplate(null);
  };

  const openEditModal = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      channel_type: template.channel_type,
      language: template.language,
      subject_template: template.subject_template,
      content_template: template.content_template
    });
    setShowModal(true);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTemplates(newExpanded);
  };

  const filteredTemplates = templates.filter(t => {
    const matchType = !filterType || t.channel_type === filterType;
    const matchLanguage = !filterLanguage || t.language === filterLanguage;
    return matchType && matchLanguage;
  });

  const getChannelTypeInfo = (type: string) => {
    return CHANNEL_TYPES.find(t => t.value === type) || { label: type, color: 'bg-gray-100 text-gray-800' };
  };

  const getLanguageInfo = (lang: string) => {
    return LANGUAGES.find(l => l.value === lang) || { label: lang, flag: '🌐' };
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileText className="w-7 h-7 mr-3 text-blue-600" />
            邮件模板管理
          </h1>
          <p className="text-gray-500 mt-1">为不同类型的客户创建定制化的开发信模板</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleImportDefaults}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Copy className="w-5 h-5 mr-2" />
            导入默认模板
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            新建模板
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部客户类型</option>
          {CHANNEL_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <select
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部语言</option>
          {LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.flag} {lang.label}</option>
          ))}
        </select>
      </div>

      {/* 模板变量说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-medium text-blue-900 mb-2">可用变量说明</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{contact_name}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{company_name}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{country}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{industry}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{sender_name}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{sender_email}}'}</code>
        </div>
        <p className="text-sm text-blue-700 mt-2">这些变量将在发送时自动替换为实际内容。AI 会基于模板和客户信息进一步优化邮件内容。</p>
      </div>

      {/* 模板列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-12 text-gray-500">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg">暂无邮件模板</p>
            <p className="text-sm mt-2">点击"导入默认模板"快速开始，或手动创建新模板</p>
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const typeInfo = getChannelTypeInfo(template.channel_type);
            const langInfo = getLanguageInfo(template.language);
            const isExpanded = expandedTemplates.has(template.id || '');

            return (
              <div key={template.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(template.id || '')}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className="flex items-center text-xs text-gray-500">
                          <Globe className="w-3 h-3 mr-1" />
                          {langInfo.flag} {langInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyTemplate(template); }}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      title="复制模板"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(template); }}
                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="编辑模板"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(template); }}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      title="删除模板"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">邮件主题</label>
                      <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                        {template.subject_template}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">邮件正文</label>
                      <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                        {template.content_template}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 添加/编辑模板弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTemplate ? '编辑邮件模板' : '新建邮件模板'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    模板名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="如：经销商开发信 - 英文"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      客户类型 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.channel_type}
                      onChange={(e) => setFormData({ ...formData, channel_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">选择类型</option>
                      {CHANNEL_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">语言</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.value} value={lang.value}>{lang.flag} {lang.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮件主题模板 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject_template}
                  onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="如：Partnership Opportunity - {{company_name}}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮件正文模板 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content_template}
                  onChange={(e) => setFormData({ ...formData, content_template: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="请输入邮件正文模板，可使用 {{变量名}} 插入变量..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Check className="w-5 h-5 mr-2" />
                  {editingTemplate ? '保存修改' : '创建模板'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
