import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../src/lib/supabase';
import { 
  getApifyToken, 
  runApifyActorDirect, 
  waitForActorCompletion, 
  getActorResultsDirect,
  parseScrapedData
} from '../src/services/apifyservices';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, actorId, input } = body;

    // 获取 Apify Token
    const apifyToken = await getApifyToken();
    if (!apifyToken) {
      return NextResponse.json({ error: 'Apify Token 未配置' }, { status: 400 });
    }

    // 获取任务信息
    const supabase = getSupabase();
    const { data: taskData } = await supabase
      .from('scrape_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!taskData) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const task = taskData as {
      industry: string;
      department_id: string;
      platform: string;
      countries: string | string[];
    };

    // 运行 Apify Actor
    const { runId } = await runApifyActorDirect(actorId, input, apifyToken);

    // 更新任务状态为运行中
    await supabase
      .from('scrape_tasks')
      .update({ status: 'running' })
      .eq('id', taskId);

    // 等待 Actor 运行完成
    await waitForActorCompletion(runId, apifyToken);

    // 获取结果
    const results = await getActorResultsDirect(runId, apifyToken);

    // 解析并保存客户数据
    let totalCustomers = 0;
    let totalEmails = 0;

    if (results && results.length > 0) {
      // 处理国家信息
      let countryArray: string[] = [];
      if (Array.isArray(task.countries)) {
        countryArray = task.countries;
      } else {
        countryArray = [task.countries];
      }

      // 解析抓取数据为客户数据
      const customers = parseScrapedData(
        task.platform,
        results,
        task.industry,
        task.department_id
      );

      totalCustomers = customers.length;
      totalEmails = customers.filter(c => c.contact_email).length;

      // 批量插入客户数据
      const { error: insertError } = await supabase
        .from('customers')
        .insert(customers);

      if (insertError) {
        console.error('保存客户数据失败:', insertError);
      }
    }

    // 更新任务状态
    await supabase
      .from('scrape_tasks')
      .update({
        status: 'completed',
        results_count: totalCustomers,
        emails_count: totalEmails,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    return NextResponse.json({
      success: true,
      totalCustomers,
      totalEmails,
    });

  } catch (error) {
    console.error('抓取失败:', error);
    
    // 更新任务状态为失败
    const { taskId } = await request.json().catch(() => ({ taskId: null }));
    
    if (taskId) {
      await supabase
        .from('scrape_tasks')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : '未知错误',
        })
        .eq('id', taskId);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}