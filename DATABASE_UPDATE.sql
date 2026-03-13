-- ================================================
-- 元拓建材集团外贸AI工作流系统 - 数据库增量更新
-- 只添加新字段，不会影响现有数据
-- ================================================

-- 1. 为 scrape_tasks 表添加新字段（如果不存在）
DO $$ 
BEGIN
    -- 添加 countries 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scrape_tasks' AND column_name = 'countries') THEN
        ALTER TABLE scrape_tasks ADD COLUMN countries TEXT[];
    END IF;
    
    -- 添加 actor_id 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scrape_tasks' AND column_name = 'actor_id') THEN
        ALTER TABLE scrape_tasks ADD COLUMN actor_id TEXT;
    END IF;
    
    -- 添加 emails_count 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scrape_tasks' AND column_name = 'emails_count') THEN
        ALTER TABLE scrape_tasks ADD COLUMN emails_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. 为 customers 表添加新字段（如果不存在）
DO $$ 
BEGIN
    -- 添加 raw_data 字段（保存原始抓取数据）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'raw_data') THEN
        ALTER TABLE customers ADD COLUMN raw_data JSONB;
    END IF;
    
    -- 添加 source_url 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'source_url') THEN
        ALTER TABLE customers ADD COLUMN source_url TEXT;
    END IF;
END $$;

-- 3. 确保 api_configs 表存在（用于保存 API Keys）
CREATE TABLE IF NOT EXISTS api_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为 api_configs 添加 RLS 策略（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_configs' AND policyname = 'Allow all') THEN
        ALTER TABLE api_configs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow all" ON api_configs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. 更新管理员密码为 YuanTuo@2026（如果管理员存在）
UPDATE users 
SET password_hash = 'YuanTuo@2026', updated_at = NOW()
WHERE email = 'admin@yuantuo.com';

-- 如果管理员不存在则创建
INSERT INTO users (email, password_hash, name, role, is_active)
VALUES ('admin@yuantuo.com', 'YuanTuo@2026', '系统管理员', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- 完成
SELECT '数据库增量更新完成！' as message;
