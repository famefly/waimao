import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { apiKey, to, from, subject, html, replyTo, tags } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is required' });
    }

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: from || 'noreply@example.com',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        reply_to: replyTo,
        tags,
      }),
    });

    const data: any = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, id: data.id });
    } else {
      return res.status(response.status).json({
        success: false,
        error: data.message || '邮件发送失败'
      });
    }
  } catch (error) {
    console.error('Send email error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
