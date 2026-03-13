import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置 - 优先从环境变量获取，否则从 sessionStorage
let supabaseInstance: SupabaseClient | null = null;

// 环境变量配置
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const initSupabase = (url: string, anonKey: string): SupabaseClient => {
  supabaseInstance = createClient(url, anonKey);
  // 保存到 sessionStorage 作为备份
  sessionStorage.setItem('supabase_url', url);
  sessionStorage.setItem('supabase_anon_key', anonKey);
  return supabaseInstance;
};

export const getSupabase = (): SupabaseClient | null => {
  if (!supabaseInstance) {
    // 优先使用环境变量配置
    if (ENV_SUPABASE_URL && ENV_SUPABASE_KEY) {
      supabaseInstance = createClient(ENV_SUPABASE_URL, ENV_SUPABASE_KEY);
      return supabaseInstance;
    }
    // 否则尝试从 sessionStorage 恢复
    const url = sessionStorage.getItem('supabase_url');
    const key = sessionStorage.getItem('supabase_anon_key');
    if (url && key) {
      supabaseInstance = createClient(url, key);
    }
  }
  return supabaseInstance;
};

// 检查是否已通过环境变量配置
export const isEnvConfigured = (): boolean => {
  return !!(ENV_SUPABASE_URL && ENV_SUPABASE_KEY);
};

// 导出 supabase 实例的 getter
export const supabase = {
  get client(): SupabaseClient | null {
    return getSupabase();
  },
  from: (table: string) => {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase 未初始化，请先配置数据库连接');
    }
    return client.from(table);
  }
};

// 数据库表结构类型
export interface Customer {
  id?: string;
  country?: string[];
  company_name: string;
  industry?: string;
  main_products?: string;
  channel_type?: string;
  annual_revenue?: string;
  annual_purchase?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  email_verified?: boolean;
  source_platform?: string;
  created_at?: string;
  department_id?: string;
  status?: 'pending' | 'verified' | 'invalid';
}

export interface EmailCampaign {
  id?: string;
  customer_id: string;
  subject: string;
  content: string;
  language: string;
  status: 'pending' | 'sent' | 'read' | 'failed';
  sent_at?: string | null;
  read_at?: string | null;
  department_id: string;
  resend_message_id?: string | null;
  created_at?: string;
}

export interface Department {
  id?: string;
  name: string;
  region?: string;
  products?: string[];
  created_at?: string;
}

export interface User {
  id?: string;
  email: string;
  name: string;
  password_hash?: string;
  role: 'admin' | 'user';
  department_id?: string | null;
  status: 'active' | 'inactive';
  last_login?: string;
  created_at?: string;
}

export interface ApiConfig {
  id?: string;
  key_name: string;
  key_value: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScrapeTask {
  id?: string;
  platform: string;
  keywords?: string[];
  country?: string[];
  industry?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results_count?: number;
  department_id?: string;
  apify_run_id?: string;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

export interface EmailTemplate {
  id?: string;
  name: string;
  channel_type: string;
  subject_template: string;
  content_template: string;
  language: string;
  department_id?: string;
  created_at?: string;
}

// SQL 建表语句（供用户在 Supabase 中执行）
export const createTablesSql = `
-- 事业部表
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  region VARCHAR(255),
  products TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  department_id UUID REFERENCES departments(id),
  status VARCHAR(50) DEFAULT 'active',
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 客户表
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country text[],
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  main_products TEXT,
  channel_type VARCHAR(100),
  annual_revenue VARCHAR(100),
  annual_purchase VARCHAR(100),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(100),
  contact_email VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  source_platform VARCHAR(100),
  source_url TEXT,
  department_id UUID REFERENCES departments(id),
  status VARCHAR(50) DEFAULT 'pending',
  raw_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 邮件营销表
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  subject TEXT,
  content TEXT,
  language VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  department_id UUID REFERENCES departments(id),
  resend_message_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API配置表（存储各种API密钥）
CREATE TABLE IF NOT EXISTS api_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name VARCHAR(255) UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 抓取任务表
CREATE TABLE IF NOT EXISTS scrape_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform VARCHAR(100) NOT NULL,
  keywords TEXT[],
  country text[],
  countries TEXT,
  actor_id VARCHAR(255),
  industry VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  results_count INTEGER DEFAULT 0,
  emails_count INTEGER DEFAULT 0,
  department_id UUID REFERENCES departments(id),
  apify_run_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 邮件模板表
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(100),
  subject_template TEXT,
  content_template TEXT,
  language VARCHAR(50) DEFAULT 'en',
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认管理员账号（密码: YuanTuo@2026）
INSERT INTO users (email, password_hash, name, role, status) 
VALUES ('admin@yuantuo.com', 'YuanTuo@2026', '系统管理员', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- 启用 RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- 创建公开访问策略（开发环境，生产环境需要更严格的策略）
CREATE POLICY "Allow all" ON departments FOR ALL USING (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true);
CREATE POLICY "Allow all" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all" ON email_campaigns FOR ALL USING (true);
CREATE POLICY "Allow all" ON api_configs FOR ALL USING (true);
CREATE POLICY "Allow all" ON scrape_tasks FOR ALL USING (true);
CREATE POLICY "Allow all" ON email_templates FOR ALL USING (true);
`;
