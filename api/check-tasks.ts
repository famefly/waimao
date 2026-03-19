import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface TaskStatus {
  id: string;
  platform: string;
  apify_run_id: string;
  status: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[Check Tasks] Environment check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
  });

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Check Tasks] Missing environment variables');
    return res.status(500).json({ 
      success: false, 
      error: 'Database configuration missing',
      details: `VITE_SUPABASE_URL: ${supabaseUrl ? 'set' : 'missing'}, SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? 'set' : 'missing'}`
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' });
    }

    // 1. 获取所有运行中或待处理的任务
    const { data: runningTasks, error: fetchError } = await supabase
      .from('scrape_tasks')
      .select('id, platform, apify_run_id, status, industry, department_id')
      .in('status', ['running', 'pending']);

    if (fetchError) {
      console.error('[Check Tasks] Fetch error:', fetchError);
      return res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
    }

    if (!runningTasks || runningTasks.length === 0) {
      return res.status(200).json({ success: true, message: 'No running tasks', updated: 0 });
    }

    console.log(`[Check Tasks] Found ${runningTasks.length} running tasks`);

    let updatedCount = 0;
    const results: { taskId: string; status: string; resultsCount: number; emailsCount: number }[] = [];

    // 2. 检查每个任务的状态
    for (const task of runningTasks as TaskStatus[]) {
      console.log(`[Check Tasks] Processing task ${task.id}, apify_run_id: ${task.apify_run_id || 'missing'}`);
      
      if (!task.apify_run_id) {
        // 如果没有 apify_run_id，标记为失败
        console.log(`[Check Tasks] Task ${task.id} has no apify_run_id, marking as failed`);
        await supabase
          .from('scrape_tasks')
          .update({
            status: 'failed',
            error_message: 'No Apify run ID found',
          })
          .eq('id', task.id);
        continue;
      }

      try {
        // 检查 Apify 运行状态
        const statusResponse = await fetch(
          `https://api.apify.com/v2/actor-runs/${task.apify_run_id}`,
          {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          }
        );

        if (!statusResponse.ok) {
          console.error(`[Check Tasks] Status check failed for ${task.apify_run_id}`);
          continue;
        }

        const statusData: any = await statusResponse.json();
        const apifyStatus = statusData.data?.status;

        console.log(`[Check Tasks] Task ${task.id} status: ${apifyStatus}`);

        // 如果还在运行，跳过
        if (apifyStatus === 'RUNNING' || apifyStatus === 'READY') {
          continue;
        }

        // 如果失败
        if (apifyStatus === 'FAILED' || apifyStatus === 'ABORTED' || apifyStatus === 'TIMED-OUT') {
          await supabase
            .from('scrape_tasks')
            .update({
              status: 'failed',
              error_message: statusData.data?.error?.message || `Apify ${apifyStatus}`,
            })
            .eq('id', task.id);

          updatedCount++;
          continue;
        }

        // 如果成功，获取结果
        if (apifyStatus === 'SUCCEEDED') {
          const resultsResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${task.apify_run_id}/dataset/items?clean=true&limit=500`,
            {
              headers: { 'Authorization': `Bearer ${apiKey}` },
            }
          );

          if (!resultsResponse.ok) {
            console.error(`[Check Tasks] Results fetch failed for ${task.apify_run_id}`);
            continue;
          }

          const rawData: any = await resultsResponse.json();
          const items = Array.isArray(rawData) ? rawData : [];

          console.log(`[Check Tasks] Got ${items.length} items for task ${task.id}`);

          // 解析结果
          const customers = parseScrapedData(
            task.platform,
            items,
            (task as any).industry || '',
            (task as any).department_id || ''
          );

          // ===== 邮箱提取：对有网站但无邮箱的客户提取邮箱 =====
          const customersNeedingEmail = customers.filter(
            (c: any) => c.source_url && !c.contact_email
          );
          
          if (customersNeedingEmail.length > 0) {
            console.log(`[Check Tasks] Extracting emails for ${customersNeedingEmail.length} customers...`);
            
            // 提取网站 URL（去重）
            const urlsToExtract = [...new Set(
              customersNeedingEmail
                .map((c: any) => c.source_url)
                .filter((url: string) => url && url.startsWith('http'))
            )] as string[];
            
            if (urlsToExtract.length > 0) {
              const batchSize = 20;
              const emailResults: Record<string, { email: string; phone: string }> = {};
              
              for (let i = 0; i < urlsToExtract.length; i += batchSize) {
                const batch = urlsToExtract.slice(i, i + batchSize);
                
                try {
                  // 调用 Apify 邮箱提取器
                  const extractResponse = await fetch(
                    `https://api.apify.com/v2/acts/logical_scrapers~extract-email-from-any-website/runs?token=${apiKey}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ urls: batch }),
                    }
                  );
                  
                  if (extractResponse.ok) {
                    const runData = await extractResponse.json() as { data: { id: string } };
                    const runId = runData.data.id;
                    
                    // 等待提取完成（最多60秒）
                    let attempts = 0;
                    let status = 'RUNNING';
                    
                    while (attempts < 12 && status === 'RUNNING') {
                      await new Promise(r => setTimeout(r, 5000));
                      
                      const statusRes = await fetch(
                        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
                      );
                      
                      if (statusRes.ok) {
                        const statusData = await statusRes.json() as { data: { status: string } };
                        status = statusData.data.status;
                      }
                      attempts++;
                    }
                    
                    if (status === 'SUCCEEDED') {
                      const emailRes = await fetch(
                        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}`
                      );
                      
                      if (emailRes.ok) {
                        const emailData = await emailRes.json() as any[];
                        
                        for (const item of emailData) {
                          const originalUrl = item.url || item.inputUrl;
                          if (originalUrl) {
                            for (const url of batch) {
                              const domain = url.replace('https://', '').replace('http://', '').split('/')[0];
                              if (originalUrl.includes(domain)) {
                                emailResults[url] = {
                                  email: item.email || item.emails?.[0] || '',
                                  phone: item.phone || item.phones?.[0] || '',
                                };
                                break;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error('[Check Tasks] Email extraction error:', e);
                }
              }
              
              // 更新客户邮箱和电话
              for (const customer of customers) {
                if (customer.source_url && emailResults[customer.source_url]) {
                  const extracted = emailResults[customer.source_url];
                  if (extracted.email && !customer.contact_email) {
                    customer.contact_email = extracted.email;
                  }
                  if (extracted.phone && !customer.contact_phone) {
                    customer.contact_phone = extracted.phone;
                  }
                }
              }
              
              console.log(`[Check Tasks] Extracted contacts for ${Object.keys(emailResults).length} websites`);
            }
          }

          // 保存客户数据
          let savedCount = 0;
          let emailsCount = 0;

          for (const customer of customers) {
            try {
              const { error: insertError } = await supabase
                .from('customers')
                .insert(customer);

              if (!insertError) {
                savedCount++;
                if (customer.contact_email) {
                  emailsCount++;
                }
              }
            } catch (e) {
              // 忽略重复数据
            }
          }

          // 更新任务状态
          await supabase
            .from('scrape_tasks')
            .update({
              status: 'completed',
              results_count: savedCount,
              emails_count: emailsCount,
              completed_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          results.push({
            taskId: task.id,
            status: 'completed',
            resultsCount: savedCount,
            emailsCount: emailsCount,
          });

          updatedCount++;
        }
      } catch (taskError) {
        console.error(`[Check Tasks] Error processing task ${task.id}:`, taskError);
      }
    }

    return res.status(200).json({
      success: true,
      updated: updatedCount,
      results,
    });

  } catch (error) {
    console.error('[Check Tasks] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// 解析抓取结果 - 优化版本，提取更多字段
function parseScrapedData(
  platform: string,
  rawData: any[],
  taskIndustry: string,
  departmentId: string | null
): any[] {
  const customers: any[] = [];

  // 处理 department_id：空字符串转为 null
  const safeDepartmentId = departmentId && departmentId.trim() !== '' ? departmentId : null;

  rawData.forEach((item: any) => {
    // 基础字段
    let customer: any = {
      source_platform: platform,
      status: 'pending',
      department_id: safeDepartmentId,
      industry: taskIndustry.split(' ')[0] || taskIndustry,
      channel_type: '待分类', // 用户后续手动分类
      email_verified: false,
      raw_data: JSON.stringify(item),
    };

    // 辅助函数：将国家字符串转为数组
    const countryToArray = (countryStr: string | undefined | null): string[] | undefined => {
      if (!countryStr || countryStr.trim() === '') return undefined;
      return [countryStr.trim()];
    };

    // 辅助函数：从地址提取国家
    const extractCountryFromAddress = (address: string | undefined): string[] | undefined => {
      if (!address) return undefined;
      const parts = address.split(',').map(p => p.trim());
      const country = parts[parts.length - 1];
      return countryToArray(country);
    };

    // 辅助函数：提取邮箱（支持多种格式）
    const extractEmail = (item: any): string => {
      return item.email || 
             item.emails?.[0] || 
             item.emailAddress || 
             item.contactEmail ||
             item.businessEmail ||
             '';
    };

    // 辅助函数：提取电话（支持多种格式）
    const extractPhone = (item: any): string => {
      return item.phone || 
             item.phones?.[0] || 
             item.phoneNumber || 
             item.contactPhone ||
             item.phoneUnformatted ||
             '';
    };

    // 辅助函数：根据抓取信息自动判断渠道类型 - 与前端统一
    const detectChannelType = (item: any, platform: string): string => {
      const texts = [
        item.categoryName || item.category || '',
        item.categories?.join(' ') || '',
        item.industry || item.industries?.join(' ') || '',
        item.main_products || item.products || item.services || '',
        item.description || item.about || item.biography || '',
        item.specialties?.join(' ') || '',
        item.companyName || item.name || item.title || '',
      ].filter(Boolean).join(' ').toLowerCase();

      const rules = [
        { keywords: ['factory', 'manufacturer', 'manufacturing', 'production', 'oem', '工业', '制造', '工厂', '生产', '代工'], type: 'factory' },
        { keywords: ['brand agent', 'authorized dealer', '品牌代理', '授权代理', '独家代理'], type: 'brand_agent' },
        { keywords: ['wholesale', 'wholesaler', 'distributor', 'dealer', '批发', '分销', '经销'], type: 'distributor' },
        { keywords: ['joint venture', 'jv', '合资', '合作公司', '联营'], type: 'joint_venture' },
        { keywords: ['supermarket', 'hypermarket', 'grocery', 'mall', '商超', '超市', '卖场', '百货', '购物中心'], type: 'supermarket' },
        { keywords: ['import', 'export', 'trading company', 'trading', 'trade', '进出口', '贸易', '外贸', '跨国'], type: 'trading_company' },
        { keywords: ['retail', 'retailer', 'store', 'shop', 'mart', '零售', '商店', '店铺'], type: 'retailer' },
        { keywords: ['end user', 'consumer', '终端', '最终用户'], type: 'end_customer' },
        { keywords: ['construction', 'building', 'contractor', 'engineering', '建筑', '工程', '装修', '施工'], type: 'contractor' },
        { keywords: ['agency', 'consulting', 'consultant', 'service', '服务', '咨询', '代理'], type: 'service_provider' },
      ];

      for (const rule of rules) {
        if (rule.keywords.some(kw => texts.includes(kw))) {
          return rule.type;
        }
      }

      const platformDefaults: Record<string, string> = {
        'linkedin': 'trading_company',
        'instagram': 'brand_agent',
        'facebook': 'retailer',
        'yelp': 'service_provider',
        'yellow_pages': 'service_provider',
        'yellow_pages_world': 'service_provider',
        'google_maps': 'retailer',
        'forum': 'end_customer',
        'alibaba': 'trading_company',
        'global_sources': 'trading_company',
        'tradeshow': 'trading_company',
        'houzz': 'contractor',
      };

      return platformDefaults[platform] || 'service_provider';
    };

    switch (platform) {
      // ===== Google Maps（最优：$2/1000条，95%+邮箱率）=====
      case 'google_maps':
      case 'google_maps_leads':
        customer = {
          ...customer,
          company_name: item.title || item.name || item.businessName || '未知公司',
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          industry: item.categoryName || item.category || taskIndustry.split(' ')[0],
          main_products: item.categories?.join(', ') || item.categoryName || '',
          contact_name: item.ownerName || item.proprietor || item.contactName || '',
          contact_phone: extractPhone(item),
          contact_email: extractEmail(item),
          annual_revenue: item.revenue || item.annualRevenue || '',
          annual_purchase: item.employeeCount || item.employeeSize || '',
          source_url: item.website || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'email_extractor':
        // 网站邮箱提取器
        customer = {
          ...customer,
          company_name: item.companyName || item.company || item.domain || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || item.contact || '',
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          industry: item.industry || taskIndustry.split(' ')[0],
          main_products: item.description || item.services || '',
          source_url: item.website || item.url || item.domain || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'linkedin':
        // 新 actor 输出人员档案格式
        customer = {
          ...customer,
          company_name: item.company || item.companyName || item.current_company || '未知公司',
          country: countryToArray(item.location) || extractCountryFromAddress(item.location),
          industry: item.industry || taskIndustry.split(' ')[0],
          main_products: item.headline || '',
          contact_email: item.email || extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: `${item.firstname || ''} ${item.lastname || ''}`.trim() || item.name || '',
          annual_revenue: '',
          source_url: item.linkedin_url || item.profileUrl || item.url || '',
          annual_purchase: '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'instagram':
        customer = {
          ...customer,
          company_name: item.fullName || item.username || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.fullName || item.username || '',
          source_url: item.url || `https://instagram.com/${item.username}`,
          industry: item.biography?.split('\n')[0] || taskIndustry.split(' ')[0],
          main_products: item.biography || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'facebook':
        customer = {
          ...customer,
          company_name: item.name || item.pageName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          country: countryToArray(item.location?.country) || extractCountryFromAddress(item.location?.city),
          contact_name: item.ownerName || '',
          source_url: item.url || item.link || '',
          industry: item.category || item.about?.split('\n')[0] || taskIndustry.split(' ')[0],
          main_products: item.about || item.description || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      // ===== 商业目录 =====
      case 'yellow_pages':
      case 'yellow_pages_world':
        customer = {
          ...customer,
          company_name: item.businessName || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || '',
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          industry: item.category || item.categories?.[0] || taskIndustry.split(' ')[0],
          main_products: item.categories?.join(', ') || '',
          source_url: item.website || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'yellow_pages_au':
        customer = {
          ...customer,
          company_name: item.businessName || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || '',
          country: ['Australia'],
          industry: item.category || item.categories?.[0] || taskIndustry.split(' ')[0],
          main_products: item.categories?.join(', ') || item.description || '',
          source_url: item.website || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'yelp':
        customer = {
          ...customer,
          company_name: item.name || item.businessName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.ownerName || '',
          country: countryToArray(item.location?.country) || ['United States'],
          industry: item.categories?.[0]?.title || taskIndustry.split(' ')[0],
          main_products: item.categories?.map((c: any) => c.title).join(', ') || '',
          source_url: item.url || item.website || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      // ===== B2B 采购平台 =====
      case 'alibaba':
        customer = {
          ...customer,
          company_name: item.companyName || item.supplierName || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactPerson || item.contactName || '',
          country: countryToArray(item.country) || countryToArray(item.location) || ['China'],
          industry: item.mainProduct || item.category || taskIndustry.split(' ')[0],
          main_products: item.mainProducts || item.products?.join(', ') || '',
          source_url: item.url || item.shopUrl || '',
          annual_revenue: item.tradeAssurance || item.yearEstablished || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'global_sources':
        customer = {
          ...customer,
          company_name: item.companyName || item.supplierName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactPerson || '',
          country: countryToArray(item.country) || ['China'],
          industry: item.category || taskIndustry.split(' ')[0],
          main_products: item.products?.join(', ') || item.mainProduct || '',
          source_url: item.url || item.website || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      // ===== 展会 =====
      case 'tradeshow':
        customer = {
          ...customer,
          company_name: item.companyName || item.name || item.exhibitorName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || '',
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          industry: item.category || item.industry || taskIndustry.split(' ')[0],
          main_products: item.products || item.description || '',
          source_url: item.website || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      // ===== 家居 =====
      case 'houzz':
        customer = {
          ...customer,
          company_name: item.companyName || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactName || item.ownerName || '',
          country: countryToArray(item.location?.country) || extractCountryFromAddress(item.address),
          industry: item.specialty || item.category || taskIndustry.split(' ')[0],
          main_products: item.services?.join(', ') || item.description || '',
          source_url: item.website || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'forum':
        customer = {
          ...customer,
          company_name: item.author || item.username || item.companyMentioned || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: '',
          contact_name: item.author || item.username || '',
          country: countryToArray(item.location),
          industry: taskIndustry.split(' ')[0],
          main_products: item.title || item.question || '',
          source_url: item.url || item.permalink || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'reddit':
        customer = {
          ...customer,
          company_name: item.subreddit || item.author || '未知来源',
          contact_email: '',
          contact_phone: '',
          contact_name: item.author || '',
          country: undefined,
          industry: taskIndustry.split(' ')[0],
          main_products: item.title || item.selftext?.substring(0, 200) || '',
          source_url: item.url || `https://reddit.com${item.permalink}`,
          channel_type: 'end_customer',
        };
        break;

      case 'alibaba':
      case 'made_in_china':
        customer = {
          ...customer,
          company_name: item.companyName || item.supplierName || item.name || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactPerson || item.contactName || '',
          country: countryToArray(item.country) || countryToArray(item.location) || ['China'],
          industry: item.mainProduct || item.category || taskIndustry.split(' ')[0],
          main_products: item.mainProducts || item.products?.join(', ') || '',
          source_url: item.url || item.shopUrl || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      case 'customs_data':
        customer = {
          ...customer,
          company_name: item.importerName || item.exporterName || item.companyName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          contact_name: item.contactPerson || '',
          country: countryToArray(item.country) || countryToArray(item.originCountry),
          industry: item.hsCodeDescription || item.productDescription || taskIndustry.split(' ')[0],
          main_products: item.productDescription || item.goodsDescription || '',
          source_url: item.url || '',
          channel_type: 'trading_company',
          annual_purchase: item.value || item.quantity || '',
        };
        break;

      default:
        customer = {
          ...customer,
          company_name: item.name || item.title || item.companyName || item.businessName || '未知公司',
          contact_email: extractEmail(item),
          contact_phone: extractPhone(item),
          country: countryToArray(item.country) || extractCountryFromAddress(item.address),
          contact_name: item.contactName || item.contact_name || item.ownerName || '',
          industry: item.industry || item.category || taskIndustry.split(' ')[0],
          main_products: item.products || item.services || item.categories?.join(', ') || '',
          source_url: item.url || item.website || '',
          channel_type: detectChannelType(item, platform),
        };
    }

    // 只添加有效客户（有公司名称且不是"未知公司"）
    if (customer.company_name && customer.company_name !== '未知公司') {
      customers.push(customer);
    }
  });

  return customers;
}
