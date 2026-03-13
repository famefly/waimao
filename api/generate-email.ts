import type { VercelRequest, VercelResponse } from '@vercel/node';

// 客户类型对应的邮件模板策略
const EMAIL_TEMPLATES: Record<string, { name: string; focus: string; tone: string }> = {
  brand_agent: {
    name: '品牌代理商',
    focus: '品牌合作、市场推广、独家代理权',
    tone: '专业、合作共赢',
  },
  distributor: {
    name: '经销商',
    focus: '批量采购优惠、快速发货、售后支持',
    tone: '商务、实惠',
  },
  factory_oem: {
    name: 'OEM工厂',
    focus: '定制生产、技术支持、质量保证',
    tone: '技术、专业',
  },
  joint_venture: {
    name: '合资公司',
    focus: '战略合作、长期发展、资源共享',
    tone: '战略、长远',
  },
  end_customer: {
    name: '终端客户',
    focus: '产品质量、价格优势、快速交付',
    tone: '友好、服务',
  },
  contractor: {
    name: '工程商',
    focus: '项目供货、技术方案、工程配套',
    tone: '专业、可靠',
  },
  service_provider: {
    name: '服务商',
    focus: '合作模式、服务支持、共同发展',
    tone: '合作、共赢',
  },
};

// 语言映射
const LANGUAGES: Record<string, { name: string; code: string }> = {
  en: { name: 'English', code: 'en' },
  es: { name: 'Español', code: 'es' },
  fr: { name: 'Français', code: 'fr' },
  de: { name: 'Deutsch', code: 'de' },
  pt: { name: 'Português', code: 'pt' },
  ru: { name: 'Русский', code: 'ru' },
  ar: { name: 'العربية', code: 'ar' },
  ja: { name: '日本語', code: 'ja' },
  ko: { name: '한국어', code: 'ko' },
  zh: { name: '中文', code: 'zh' },
};

// 国家到语言的映射
const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  'United States': 'en',
  'United Kingdom': 'en',
  'Canada': 'en',
  'Australia': 'en',
  'Spain': 'es',
  'Mexico': 'es',
  'France': 'fr',
  'Germany': 'de',
  'Portugal': 'pt',
  'Brazil': 'pt',
  'Russia': 'ru',
  'Saudi Arabia': 'ar',
  'UAE': 'ar',
  'Japan': 'ja',
  'South Korea': 'ko',
  'China': 'zh',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      apiKey,
      customerName,
      companyName,
      country,
      industry,
      channelType,
      mainProducts,
      targetLanguage
    } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is required' });
    }

    // 确定目标语言
    const language = targetLanguage || COUNTRY_LANGUAGE_MAP[country] || 'en';
    const languageName = LANGUAGES[language]?.name || 'English';
    const templateInfo = EMAIL_TEMPLATES[channelType] || EMAIL_TEMPLATES.distributor;

    // 构建提示词
    const prompt = `你是一个专业的外贸业务开发专家，需要为元拓建材集团撰写一封开发信。

公司背景：
- 元拓建材集团是中国领先的建筑材料供应商
- 自有模架工厂，主营产品包括：脚手架、铝模板、建筑模架系统
- 提供建筑材料一站式采购服务
- 拥有完善的质量控制体系和国际认证

目标客户信息：
- 客户名称：${customerName || '尊敬的客户'}
- 公司名称：${companyName}
- 所在国家：${country}
- 所属行业：${industry}
- 客户类型：${templateInfo.name}
- 主营产品/业务：${mainProducts || '建筑相关'}

邮件要求：
1. 语言：必须使用${languageName}撰写整封邮件
2. 风格：${templateInfo.tone}
3. 重点突出：${templateInfo.focus}
4. 邮件长度：中等，200-300词
5. 包含：
   - 吸引眼球的主题行
   - 简短的自我介绍
   - 针对客户类型的价值主张
   - 明确的行动号召（CTA）
   - 专业的结尾

请生成邮件，格式如下：
[SUBJECT]
邮件主题

[CONTENT]
邮件正文`;

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({
        success: false,
        error: error.error?.message || '智谱 API 调用失败'
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // 解析返回的内容
    const subjectMatch = content.match(/\[SUBJECT\]\s*([\s\S]*?)\s*\[CONTENT\]/);
    const contentMatch = content.match(/\[CONTENT\]\s*([\s\S]*?)$/);

    const subject = subjectMatch?.[1]?.trim() || 'Business Inquiry from Yuanto Building Materials';
    const emailContent = contentMatch?.[1]?.trim() || content;

    return res.status(200).json({
      success: true,
      subject,
      content: emailContent,
      language,
    });
  } catch (error) {
    console.error('Generate email error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
