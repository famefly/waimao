import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ success: false, error: 'Database configuration missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    // 获取任务信息
    const { data: task, error: taskError } = await supabase
      .from('scrape_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const taskData = task as any;
    
    if (!taskData.apify_run_id) {
      return res.status(400).json({ success: false, error: 'Task has no apify_run_id' });
    }

    // 获取 Apify Token
    const { data: tokenData } = await supabase
      .from('api_configs')
      .select('key_value')
      .eq('key_name', 'apify_token')
      .single();

    const apiKey = (tokenData as any)?.key_value;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Apify token not found' });
    }

    console.log(`[Sync Task] Syncing task ${taskId}, runId: ${taskData.apify_run_id}`);

    // 获取 Apify 结果
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${taskData.apify_run_id}/dataset/items?clean=true&limit=500`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );

    if (!resultsResponse.ok) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch Apify results',
        status: resultsResponse.status 
      });
    }

    const rawData = await resultsResponse.json();
    const items = Array.isArray(rawData) ? rawData : [];

    console.log(`[Sync Task] Got ${items.length} items from Apify`);

    // 解析结果 - 确保 department_id 是有效的 UUID 或 null
    const departmentId = taskData.department_id && taskData.department_id.trim() !== '' 
      ? taskData.department_id 
      : null;
    
    const customers = parseScrapedData(
      taskData.platform,
      items,
      taskData.industry || '',
      departmentId
    );

    console.log(`[Sync Task] Parsed ${customers.length} customers`);

    // ===== 邮箱提取：对有网站但无邮箱的客户提取邮箱 =====
    // 注意：Email Extractor 需要 Apify 资源，免费用户可能内存不足
    // 建议：用户可以手动在 Apify 控制台运行邮箱提取，或升级付费版
    const customersNeedingEmail = customers.filter(
      (c: any) => c.source_url && !c.contact_email
    );
    
    let emailExtractSuccess = false;
    
    if (customersNeedingEmail.length > 0) {
      console.log(`[Sync Task] Found ${customersNeedingEmail.length} customers with websites but no email`);
      
      // 提取网站 URL（去重，只取前10个以节省资源）
      const urlsToExtract = [...new Set(
        customersNeedingEmail
          .map((c: any) => c.source_url)
          .filter((url: string) => url && url.startsWith('http'))
      )].slice(0, 10) as string[]; // 限制为10个，避免内存不足
      
      if (urlsToExtract.length > 0) {
        console.log(`[Sync Task] Attempting email extraction for ${urlsToExtract.length} websites (limited to save memory)`);
        
        // 先检查 Apify 账户是否有足够资源
        try {
          const userResponse = await fetch(
            `https://api.apify.com/v2/users/me?token=${apiKey}`
          );
          
          if (userResponse.ok) {
            const userData = await userResponse.json() as { data?: { monthlyUsage?: number; plan?: string } };
            console.log(`[Sync Task] Apify user info:`, userData.data);
          }
        } catch (e) {
          console.log('[Sync Task] Could not fetch user info');
        }
        
        // 小批量提取邮箱（每次5个URL）
        const batchSize = 5;
        const emailResults: Record<string, { email: string; phone: string }> = {};
        
        for (let i = 0; i < urlsToExtract.length; i += batchSize) {
          const batch = urlsToExtract.slice(i, i + batchSize);
          
          try {
            console.log(`[Sync Task] Extracting emails for batch ${Math.floor(i/batchSize) + 1}:`, batch);
            
            // 调用 Apify 邮箱提取器
            const extractResponse = await fetch(
              `https://api.apify.com/v2/acts/logical_scrapers~extract-email-from-any-website/runs?token=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  urls: batch,
                  maxEmails: 1,
                }),
              }
            );
            
            if (!extractResponse.ok) {
              const errorText = await extractResponse.text();
              console.error(`[Sync Task] Email extraction failed (${extractResponse.status}):`, errorText);
              
              // 如果是内存不足或付费限制，跳过邮箱提取
              if (extractResponse.status === 402 || extractResponse.status === 403) {
                console.log('[Sync Task] Email extraction requires more resources. Skipping...');
                break;
              }
              continue;
            }
            
            const runData = await extractResponse.json() as { data: { id: string } };
            const runId = runData.data.id;
            console.log(`[Sync Task] Email extraction started, runId: ${runId}`);
            
            // 等待提取完成（最多等待30秒）
            let attempts = 0;
            let status = 'RUNNING';
            
            while (attempts < 6 && status === 'RUNNING') {
              await new Promise(r => setTimeout(r, 5000));
              
              const statusResponse = await fetch(
                `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
              );
              
              if (statusResponse.ok) {
                const statusData = await statusResponse.json() as { data: { status: string } };
                status = statusData.data.status;
                console.log(`[Sync Task] Email extraction status: ${status}`);
              }
              attempts++;
            }
            
            // 获取提取结果
            if (status === 'SUCCEEDED') {
              const resultsResponse = await fetch(
                `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}`
              );
              
              if (resultsResponse.ok) {
                const emailData = await resultsResponse.json() as any[];
                console.log(`[Sync Task] Got ${emailData.length} email extraction results`);
                
                for (const item of emailData) {
                  const originalUrl = item.url || item.inputUrl;
                  if (originalUrl && (item.email || item.emails?.length > 0 || item.phone)) {
                    // 尝试匹配原始 URL
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
                emailExtractSuccess = true;
              }
            }
          } catch (e) {
            console.error('[Sync Task] Email extraction error:', e);
          }
        }
        
        // 更新客户的邮箱和电话
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
        
        console.log(`[Sync Task] Extracted emails for ${Object.keys(emailResults).length} websites`);
      }
    } else {
      console.log('[Sync Task] No customers need email extraction');
    }

    // ===== 去重处理 =====
    // 1. 本次抓取结果内部去重（基于公司名+电话 或 公司名+网站）
    const uniqueCustomers: any[] = [];
    const seenKeys = new Set<string>();
    
    for (const customer of customers) {
      // 生成去重键：公司名 + 电话 或 公司名 + 网站
      const key1 = `${customer.company_name}|${customer.contact_phone}`;
      const key2 = `${customer.company_name}|${customer.source_url}`;
      const key3 = customer.contact_email ? `${customer.company_name}|${customer.contact_email}` : '';
      
      if (!seenKeys.has(key1) && !seenKeys.has(key2) && (key3 === '' || !seenKeys.has(key3))) {
        seenKeys.add(key1);
        seenKeys.add(key2);
        if (key3) seenKeys.add(key3);
        uniqueCustomers.push(customer);
      }
    }
    
    console.log(`[Sync Task] Deduplicated: ${customers.length} → ${uniqueCustomers.length} customers`);
    
    // 2. 检查数据库中已存在的客户（避免重复插入）
    const existingCustomers = new Set<string>();
    
    // 批量查询已存在的公司名
    const companyNames = uniqueCustomers.map(c => c.company_name).filter(Boolean);
    if (companyNames.length > 0) {
      const { data: existingData } = await supabase
        .from('customers')
        .select('company_name, contact_phone, contact_email, source_url')
        .in('company_name', companyNames.slice(0, 500)); // 限制查询数量
      
      if (existingData && existingData.length > 0) {
        for (const existing of existingData) {
          const exKey1 = `${existing.company_name}|${existing.contact_phone}`;
          const exKey2 = `${existing.company_name}|${existing.source_url}`;
          const exKey3 = existing.contact_email ? `${existing.company_name}|${existing.contact_email}` : '';
          existingCustomers.add(exKey1);
          existingCustomers.add(exKey2);
          if (exKey3) existingCustomers.add(exKey3);
        }
        console.log(`[Sync Task] Found ${existingCustomers.size} existing records in database`);
      }
    }
    
    // 过滤掉已存在的客户
    const newCustomers = uniqueCustomers.filter(customer => {
      const key1 = `${customer.company_name}|${customer.contact_phone}`;
      const key2 = `${customer.company_name}|${customer.source_url}`;
      const key3 = customer.contact_email ? `${customer.company_name}|${customer.contact_email}` : '';
      
      return !existingCustomers.has(key1) && !existingCustomers.has(key2) && (key3 === '' || !existingCustomers.has(key3));
    });
    
    console.log(`[Sync Task] After DB dedup: ${uniqueCustomers.length} → ${newCustomers.length} new customers`);

    // 保存客户数据
    let savedCount = 0;
    let emailsCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    for (const customer of newCustomers) {
      try {
        const { error: insertError } = await supabase
          .from('customers')
          .insert(customer);

        if (insertError) {
          if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
            duplicateCount++;
          } else {
            errors.push(insertError.message);
          }
        } else {
          savedCount++;
          if (customer.contact_email) {
            emailsCount++;
          }
        }
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    // 更新任务
    await supabase
      .from('scrape_tasks')
      .update({
        results_count: savedCount,
        emails_count: emailsCount,
      })
      .eq('id', taskId);

    return res.status(200).json({
      success: true,
      taskId,
      platform: taskData.platform,
      apifyRunId: taskData.apify_run_id,
      totalItems: items.length,
      parsedCustomers: customers.length,
      deduplicated: uniqueCustomers.length,
      existingInDb: uniqueCustomers.length - newCustomers.length,
      savedCustomers: savedCount,
      duplicateCount,
      emailsCount,
      websitesCount: uniqueCustomers.filter((c: any) => c.source_url).length,
      emailExtractSuccess,
      errors: errors.slice(0, 5),
    });

  } catch (error) {
    console.error('[Sync Task] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// 解析抓取结果 - 优化版本
function parseScrapedData(
  platform: string,
  rawData: any[],
  taskIndustry: string,
  departmentId: string | null
): any[] {
  const customers: any[] = [];

  const countryToArray = (countryStr: string | undefined | null): string[] | undefined => {
    if (!countryStr || countryStr.trim() === '') return undefined;
    return [countryStr.trim()];
  };

  const extractCountryFromAddress = (address: string | undefined): string[] | undefined => {
    if (!address) return undefined;
    const parts = address.split(',').map(p => p.trim());
    const country = parts[parts.length - 1];
    return countryToArray(country);
  };

  const extractEmail = (item: any): string => {
    return item.email || item.emails?.[0] || item.emailAddress || item.contactEmail || item.businessEmail || '';
  };

  const extractPhone = (item: any): string => {
    return item.phone || item.phones?.[0] || item.phoneNumber || item.contactPhone || item.phoneUnformatted || '';
  };

      // 根据抓取信息自动判断渠道类型 - 与前端统一
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
          'leads_finder': 'trading_company',
          'facebook': 'retailer',
          'yelp': 'service_provider',
          'yellow_pages': 'service_provider',
          'yellow_pages_world': 'service_provider',
          'google_maps': 'retailer',
          'alibaba': 'supplier',
          'made_in_china': 'supplier',
          'amazon_seller': 'importer',
          'thomasnet': 'manufacturer',
          'crunchbase': 'startup',
        };
  
        return platformDefaults[platform] || 'service_provider';
      };

  // 调试日志：打印第一条数据的结构
  if (rawData.length > 0) {
    console.log(`[Sync Task] Platform: ${platform}, First item keys:`, Object.keys(rawData[0]));
    console.log(`[Sync Task] First item sample:`, JSON.stringify(rawData[0], null, 2).substring(0, 1000));
  }

  rawData.forEach((item: any) => {
    let customer: any = {
      source_platform: platform,
      status: 'pending',
      department_id: departmentId || null,
      industry: taskIndustry.split(' ')[0] || taskIndustry,
      channel_type: '待分类',
      email_verified: false,
      raw_data: JSON.stringify(item),
    };

    switch (platform) {
      // ===== Google Maps =====
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

      // ===== 社交媒体 =====
      case 'linkedin':
        // apimaestro/linkedin-profile-search-scraper 输出格式
        // 字段名可能是多种形式，需要兼容
        const linkedinCompany = item.company_name || item.companyName || item.company 
          || item.current_company || item.currentCompany || item.organization 
          || item.organization_name || '未知公司';
        const linkedinName = item.full_name || item.name || item.fullName 
          || `${item.firstname || item.firstName || ''} ${item.lastname || item.lastName || ''}`.trim();
        const linkedinEmail = item.email || item.email_address || item.contact_email 
          || item.work_email || extractEmail(item);
        
        // 调试日志
        console.log(`[LinkedIn Parse] Item:`, {
          original: { company_name: item.company_name, companyName: item.companyName, company: item.company },
          linkedinCompany,
          linkedinName,
          linkedinEmail,
          hasContactInfo: !!(linkedinEmail || item.phone || linkedinName)
        });
        
        customer = {
          ...customer,
          company_name: linkedinCompany,
          country: countryToArray(item.location || item.country || item.city) || extractCountryFromAddress(item.location),
          industry: item.industry || item.industry_name || taskIndustry.split(' ')[0],
          main_products: item.headline || item.title || item.job_title || '',
          contact_email: linkedinEmail,
          contact_phone: item.phone || item.contact_phone || extractPhone(item),
          contact_name: linkedinName,
          annual_revenue: '',
          annual_purchase: '',
          source_url: item.linkedin_url || item.profile_url || item.profileUrl || item.url || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      // ===== Leads Finder（高价值渠道，直接返回邮箱）=====
      case 'leads_finder':
        customer = {
          ...customer,
          company_name: item.company_name || '未知公司',
          country: countryToArray(item.country) || [],
          industry: item.industry || taskIndustry.split(' ')[0],
          main_products: item.company_description || '',
          contact_email: item.email || '',
          contact_phone: item.company_phone || '',
          contact_name: `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.full_name || '',
          annual_revenue: item.company_annual_revenue || '',
          annual_purchase: item.company_size || '',
          source_url: item.company_website || item.linkedin || '',
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
          industry: item.category || item.about?.split('\n')[0] || taskIndustry.split(' ')[0],
          main_products: item.about || item.description || '',
          source_url: item.url || item.link || '',
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

      // ===== Leads Finder（高价值渠道，直接带邮箱）=====
      case 'leads_finder':
        customer = {
          ...customer,
          company_name: item.company_name || item.companyName || '未知公司',
          contact_email: item.email || item.contact_email || '',
          contact_phone: item.phone || item.company_phone || '',
          contact_name: item.full_name || item.first_name + ' ' + item.last_name || '',
          country: countryToArray(item.country),
          industry: item.industry || item.company_industry || taskIndustry.split(' ')[0],
          main_products: item.company_description || '',
          annual_revenue: item.company_annual_revenue || '',
          annual_purchase: item.company_size || '',
          source_url: item.company_website || item.linkedin || '',
          channel_type: 'distributor', // B2B客户
        };
        break;

      // ===== ThomasNet（美国工业供应商）=====
      case 'thomasnet':
        customer = {
          ...customer,
          company_name: item.name || item.companyName || '未知公司',
          contact_email: item.contactEmail || item.email || '',
          contact_phone: item.primaryPhone || item.phone || '',
          contact_name: item.personnel?.[0]?.name || '',
          country: ['United States'],
          industry: item.heading?.name || item.category || taskIndustry.split(' ')[0],
          main_products: item.headings?.map((h: any) => h.name).join(', ') || item.description || '',
          annual_revenue: item.annualSales || '',
          annual_purchase: item.numberEmployees || '',
          source_url: item.website || '',
          channel_type: detectChannelType(item, platform),
        };
        break;

      // ===== Crunchbase（创业公司/科技公司）=====
      case 'crunchbase':
        customer = {
          ...customer,
          company_name: item.name || item.identifier?.value || '未知公司',
          contact_email: item.contactEmail || '',
          contact_phone: item.phoneNumber || '',
          contact_name: item.founders?.[0]?.name || '',
          country: countryToArray(item.locationIdentifiers?.[0]?.value),
          industry: item.categories?.[0]?.value || item.industry || taskIndustry.split(' ')[0],
          main_products: item.shortDescription || item.description || '',
          annual_revenue: item.revenueRange || '',
          annual_purchase: item.numEmployeesEnum || '',
          source_url: item.website || item.website?.value || '',
          channel_type: 'trading_company', // 科技公司
        };
        break;

      // ===== Amazon卖家 =====
      case 'amazon_seller':
        customer = {
          ...customer,
          company_name: item.sellerName || item.businessName || '未知公司',
          contact_email: '',
          contact_phone: item.phone || '',
          contact_name: '',
          country: countryToArray(item.businessAddress?.country) || ['United States'],
          industry: 'E-commerce',
          main_products: item.products?.map((p: any) => p.title).join(', ') || '',
          source_url: item.sellerUrl || `https://www.amazon.com/sp?seller=${item.sellerId}`,
          channel_type: 'retailer', // 零售商/电商
        };
        break;

      default:
        // 通用解析
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

    // LinkedIn 和 Leads Finder 是个人档案，有联系人信息就保存
    const isProfilePlatform = platform === 'linkedin' || platform === 'leads_finder';
    const hasContactInfo = customer.contact_email || customer.contact_phone || customer.contact_name;
    
    // 调试日志：打印过滤信息
    if (isProfilePlatform) {
      console.log(`[Filter] ${platform} item:`, {
        hasContactInfo,
        contact_email: customer.contact_email,
        contact_phone: customer.contact_phone,
        contact_name: customer.contact_name,
        company_name: customer.company_name,
        willSave: hasContactInfo || customer.company_name !== '未知公司'
      });
    }
    
    if (isProfilePlatform) {
      // 个人档案平台：有联系人信息就保存
      if (hasContactInfo || customer.company_name !== '未知公司') {
        customers.push(customer);
      } else {
        console.log(`[Filter] Skipping ${platform} item - no contact info and unknown company`);
      }
    } else {
      // 其他平台：需要有公司名
      if (customer.company_name && customer.company_name !== '未知公司') {
        customers.push(customer);
      }
    }
  });

  return customers;
}
