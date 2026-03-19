import type { VercelRequest, VercelResponse } from '@vercel/node';

// 客户类型对应的邮件模板策略 - 与前端统一
const EMAIL_TEMPLATES: Record<string, { name: string; focus: string; tone: string }> = {
  factory: {
    name: '工厂/OEM',
    focus: '定制生产、技术支持、质量保证、OEM合作',
    tone: '专业、技术',
  },
  distributor: {
    name: '经销商',
    focus: '批量采购优惠、快速发货、售后支持、区域代理',
    tone: '商务、实惠',
  },
  brand_agent: {
    name: '品牌代理商',
    focus: '品牌合作、市场推广、独家代理权',
    tone: '专业、合作共赢',
  },
  joint_venture: {
    name: '合资公司',
    focus: '战略合作、长期发展、资源共享、共同投资',
    tone: '战略、长远',
  },
  supermarket: {
    name: '商超',
    focus: '稳定供货、产品陈列、促销支持、品类管理',
    tone: '合作、稳定',
  },
  trading_company: {
    name: '进出口商',
    focus: '国际贸易、物流支持、关税优惠、市场信息',
    tone: '专业、高效',
  },
  retailer: {
    name: '零售商',
    focus: '产品质量、价格优势、快速交付、售后保障',
    tone: '友好、服务',
  },
  end_customer: {
    name: '终端客户',
    focus: '产品质量、价格优势、快速交付、使用指导',
    tone: '友好、服务',
  },
  contractor: {
    name: '工程商',
    focus: '项目供货、技术方案、工程配套、项目管理',
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

// AI 模型配置 - 支持多个免费模型（按优先级排序）
const AI_MODELS = [
  // 智谱 GLM 系列免费模型（优先使用）
  {
    name: 'GLM-4-Flash',
    provider: 'zhipu',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    getModelParam: (apiKey: string) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        model: 'glm-4-flash',
        messages: [] as Array<{role: string, content: string}>,
        temperature: 0.7,
        max_tokens: 1500,
      },
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  {
    name: 'GLM-4-Air',
    provider: 'zhipu',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-air',
    getModelParam: (apiKey: string) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        model: 'glm-4-air',
        messages: [] as Array<{role: string, content: string}>,
        temperature: 0.7,
        max_tokens: 1500,
      },
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  {
    name: 'GLM-4-AirX',
    provider: 'zhipu',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-airx',
    getModelParam: (apiKey: string) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        model: 'glm-4-airx',
        messages: [] as Array<{role: string, content: string}>,
        temperature: 0.7,
        max_tokens: 1500,
      },
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  {
    name: 'GLM-4-FlashX',
    provider: 'zhipu',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flashx',
    getModelParam: (apiKey: string) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        model: 'glm-4-flashx',
        messages: [] as Array<{role: string, content: string}>,
        temperature: 0.7,
        max_tokens: 1500,
      },
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  {
    name: 'GLM-3-Turbo',
    provider: 'zhipu',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-3-turbo',
    getModelParam: (apiKey: string) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        model: 'glm-3-turbo',
        messages: [] as Array<{role: string, content: string}>,
        temperature: 0.7,
        max_tokens: 1500,
      },
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
  // DeepSeek 作为备用
  {
    name: 'DeepSeek-V3',
    provider: 'deepseek',
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    getModelParam: (apiKey: string) => ({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: {
        model: 'deepseek-chat',
        messages: [] as Array<{role: string, content: string}>,
        temperature: 0.7,
        max_tokens: 1500,
      },
    }),
    parseResponse: (data: any) => data.choices?.[0]?.message?.content || '',
  },
];

// 调用单个 AI 模型
async function callAIModel(
  modelConfig: typeof AI_MODELS[0],
  apiKey: string,
  prompt: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const modelParam = modelConfig.getModelParam(apiKey);
    modelParam.body.messages = [{ role: 'user', content: prompt }];

    const response = await fetch(modelConfig.url, {
      method: 'POST',
      headers: modelParam.headers,
      body: JSON.stringify(modelParam.body),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      return {
        success: false,
        error: errorData.error?.message || `${modelConfig.name} API 调用失败`,
      };
    }

    const result = await response.json() as any;
    const content = modelConfig.parseResponse(result);

    if (!content) {
      return { success: false, error: `${modelConfig.name} 返回内容为空` };
    }

    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : `${modelConfig.name} 调用异常`,
    };
  }
}

// 尝试所有 AI 模型，直到成功
async function tryAllModels(
  apiKeys: { zhipu?: string; deepseek?: string },
  prompt: string
): Promise<{ success: boolean; content?: string; usedModel?: string; error?: string }> {
  const errors: string[] = [];

  for (const modelConfig of AI_MODELS) {
    // 获取对应的 API Key
    let apiKey: string | undefined;
    if (modelConfig.provider === 'zhipu') {
      apiKey = apiKeys.zhipu;
    } else if (modelConfig.provider === 'deepseek') {
      apiKey = apiKeys.deepseek;
    }

    if (!apiKey) {
      continue; // 没有配置该模型的 API Key，跳过
    }

    console.log(`[AI] 尝试模型: ${modelConfig.name}`);
    const result = await callAIModel(modelConfig, apiKey, prompt);

    if (result.success && result.content) {
      console.log(`[AI] 成功使用模型: ${modelConfig.name}`);
      return {
        success: true,
        content: result.content,
        usedModel: modelConfig.name,
      };
    }

    errors.push(`${modelConfig.name}: ${result.error}`);
    console.log(`[AI] 模型 ${modelConfig.name} 失败: ${result.error}`);
  }

  return {
    success: false,
    error: `所有 AI 模型均失败: ${errors.join('; ')}`,
  };
}

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
      apiKey, // 兼容旧版：智谱 API Key
      deepseekApiKey, // 新增：DeepSeek API Key
      customerName,
      companyName,
      country,
      industry,
      channelType,
      mainProducts,
      targetLanguage
    } = req.body;

    // 至少需要一个 API Key
    if (!apiKey && !deepseekApiKey) {
      return res.status(400).json({ error: '至少需要配置一个 AI API Key' });
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

    // 尝试所有可用的 AI 模型
    const apiKeys = {
      zhipu: apiKey,
      deepseek: deepseekApiKey,
    };

    const result = await tryAllModels(apiKeys, prompt);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'AI 模型调用失败',
      });
    }

    const content = result.content || '';
    console.log(`[AI] 最终使用模型: ${result.usedModel}`);

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
      usedModel: result.usedModel,
    });
  } catch (error) {
    console.error('Generate email error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
