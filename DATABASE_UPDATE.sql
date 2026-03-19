-- ============================================
-- 数据库更新脚本 - 渠道配置优化
-- 更新时间: 2026-03-19
-- ============================================

-- 1. 确保 allowed_channels 字段存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'departments' AND column_name = 'allowed_channels') THEN
        ALTER TABLE departments ADD COLUMN allowed_channels JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. 清理已删除渠道的引用
-- 删除: Instagram、论坛、Reddit、海关数据、Scrapling
UPDATE departments
SET allowed_channels = (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements_text(allowed_channels) elem
    WHERE elem NOT IN (
        'apify/instagram-search-scraper',
        'peghin/ai-forum-scraper-stack-overflow-quora-reddit-more',
        'trudax/reddit-scraper',
        'custom/customs-data-scraper',
        'customs_data',
        'maiboxuan/scrapling-actor'
    )
)
WHERE allowed_channels IS NOT NULL;

-- 3. 当前可用渠道列表（供参考）
-- 高价值渠道（直接返回邮箱）:
--   code_crafter/leads-finder
--   memo23/thomasnet-scraper
--   curious_coder/crunchbase-scraper
--   apimaestro/linkedin-profile-search-scraper
-- 基础渠道（自动搭配邮箱提取）:
--   compass/crawler-google-places
--   trudax/yellow-pages-us-scraper
--   canadesk/yellow-pages-scraper
--   tri_angle/yelp-scraper
--   apify/facebook-pages-scraper
-- B2B 平台（自动搭配邮箱提取）:
--   adrian_horning/alibaba-scraper
--   memo23/made-in-china-scraper
--   junglee/amazon-seller-scraper

-- 4. 查看更新结果
SELECT id, name, allowed_channels FROM departments;
