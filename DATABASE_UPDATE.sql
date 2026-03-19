-- ============================================
-- 数据库更新脚本 - 修复 allowed_channels
-- ============================================

-- 1. 确保 allowed_channels 字段存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'departments' AND column_name = 'allowed_channels') THEN
        ALTER TABLE departments ADD COLUMN allowed_channels JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. 修复已有的 allowed_channels 数据
-- 将 'customs_data' 替换为正确的 actor id 'custom/customs-data-scraper'
UPDATE departments
SET allowed_channels = (
    SELECT jsonb_agg(
        CASE 
            WHEN elem = 'customs_data' THEN 'custom/customs-data-scraper'
            ELSE elem
        END
    )
    FROM jsonb_array_elements_text(allowed_channels) elem
)
WHERE allowed_channels::text LIKE '%"customs_data"%';

-- 3. 查看修复结果
SELECT id, name, allowed_channels FROM departments;