// Resend 邮件发送服务（通过 API Routes）
// 文档: https://resend.com/docs/api-reference

import { getSupabase } from '../lib/supabase';

// 获取 Resend API Key
export const getResendApiKey = async (): Promise<string | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from('api_configs')
    .select('key_value')
    .eq('key_name', 'resend_api_key')
    .single();

  return (data as { key_value: string } | null)?.key_value || null;
};

// 获取发件人邮箱
export const getSenderEmail = async (): Promise<string> => {
  const supabase = getSupabase();
  if (!supabase) return 'noreply@example.com';

  const { data } = await supabase
    .from('api_configs')
    .select('key_value')
    .eq('key_name', 'sender_email')
    .single();

  return (data as { key_value: string } | null)?.key_value || 'noreply@example.com';
};

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id: string;
  success: boolean;
  error?: string;
}

// 发送单封邮件（通过 API Routes）
export const sendEmail = async (params: SendEmailParams): Promise<SendEmailResult> => {
  const apiKey = await getResendApiKey();
  if (!apiKey) {
    throw new Error('Resend API Key 未配置');
  }

  const senderEmail = params.from || await getSenderEmail();

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        from: senderEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        replyTo: params.replyTo,
        tags: params.tags,
      }),
    });

    const result = await response.json();

    if (result.success) {
      return {
        id: result.id,
        success: true,
      };
    } else {
      return {
        id: '',
        success: false,
        error: result.error || '发送失败',
      };
    }
  } catch (error) {
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : '发送失败',
    };
  }
};

// 批量发送邮件
export const sendEmailsBatch = async (
  emails: Array<{
    customerId: string;
    to: string;
    subject: string;
    content: string;
    language: string;
  }>,
  departmentId: string,
  onProgress?: (processed: number, total: number, result: SendEmailResult) => void
): Promise<Array<{ customerId: string; result: SendEmailResult }>> => {
  const supabase = getSupabase();
  const results: Array<{ customerId: string; result: SendEmailResult }> = [];
  const total = emails.length;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    // 添加打开追踪像素（简单实现）
    const trackingPixel = `<img src="https://your-tracking-domain.com/track/${email.customerId}" width="1" height="1" style="display:none" />`;
    const htmlContent = formatEmailHtml(email.content) + trackingPixel;

    const result = await sendEmail({
      to: email.to,
      subject: email.subject,
      html: htmlContent,
      tags: [
        { name: 'customer_id', value: email.customerId },
        { name: 'language', value: email.language },
      ],
    });

    results.push({ customerId: email.customerId, result });

    // 保存发送记录到数据库
    if (supabase) {
      await supabase.from('email_campaigns').insert({
        customer_id: email.customerId,
        subject: email.subject,
        content: email.content,
        language: email.language,
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        department_id: departmentId,
        resend_message_id: result.id || null,
      });
    }

    onProgress?.(i + 1, total, result);

    // Resend 免费版限流：每秒2封
    if (i < emails.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
};

// 将纯文本转换为HTML格式
const formatEmailHtml = (content: string): string => {
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  const htmlParagraphs = paragraphs.map(p => {
    const lines = p.split('\n').map(line => line.trim()).join('<br/>');
    return `<p style="margin: 0 0 16px 0; line-height: 1.6;">${lines}</p>`;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${htmlParagraphs.join('')}
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #888;">
        元拓建材集团 | Yuanto Building Materials Group<br/>
        专业建筑材料一站式供应商
      </p>
    </body>
    </html>
  `;
};

// 获取邮件发送统计
export const getEmailStats = async (departmentId?: string): Promise<{
  total: number;
  sent: number;
  read: number;
  failed: number;
  pending: number;
}> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { total: 0, sent: 0, read: 0, failed: 0, pending: 0 };
  }

  let query = supabase.from('email_campaigns').select('status');
  
  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }

  const { data } = await query;
  const campaigns = (data || []) as Array<{ status: string }>;

  return {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    read: campaigns.filter(c => c.status === 'read').length,
    failed: campaigns.filter(c => c.status === 'failed').length,
    pending: campaigns.filter(c => c.status === 'pending').length,
  };
};

// 重发失败的邮件
export const resendFailedEmails = async (
  campaignIds: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<number> => {
  const supabase = getSupabase();
  if (!supabase) return 0;

  let successCount = 0;
  const total = campaignIds.length;

  for (let i = 0; i < campaignIds.length; i++) {
    const campaignId = campaignIds[i];
    
    // 获取邮件详情
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('*, customers(*)')
      .eq('id', campaignId)
      .single();

    if (campaign) {
      const typedCampaign = campaign as {
        subject: string;
        content: string;
        customers: { contact_email: string };
      };
      
      const result = await sendEmail({
        to: typedCampaign.customers.contact_email,
        subject: typedCampaign.subject,
        html: formatEmailHtml(typedCampaign.content),
      });

      if (result.success) {
        await supabase
          .from('email_campaigns')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            resend_message_id: result.id,
          })
          .eq('id', campaignId);
        successCount++;
      }
    }

    onProgress?.(i + 1, total);
    
    if (i < campaignIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return successCount;
};
