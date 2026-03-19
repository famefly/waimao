# 元拓建材集团 - 外贸AI工作流系统 部署文档

## 系统概述

本系统是一个一站式外贸AI工作流平台，包含以下功能：
- 客户数据抓取（支持 Google Maps、LinkedIn、Facebook 等多平台）
- 邮箱自动验证
- AI 智能开发信生成（基于智谱 GLM）
- 邮件群发与追踪（基于 Resend）
- 多事业部管理与权限控制

---

## 一、技术架构

### 前端
- React 19 + TypeScript
- Vite 构建工具
- TailwindCSS 4 样式框架
- React Router 路由

### 后端
- Vercel Serverless Functions（API Routes）
- Supabase PostgreSQL 数据库

### 外部服务
- **Apify**: 数据抓取平台
- **智谱 GLM**: AI 文案生成
- **Resend**: 邮件发送服务
- **Abstract API**: 邮箱验证（可选）

---

## 二、部署前准备

### 1. 所需账号和 API

| 服务 | 用途 | 获取地址 | 免费额度 |
|------|------|----------|----------|
| Supabase | 数据库 | https://supabase.com | 500MB 数据库 |
| Apify | 数据抓取 | https://apify.com | $5/月 |
| 智谱 AI | AI 生成邮件 | https://open.bigmodel.cn | GLM-4-Flash 免费 |
| Resend | 邮件发送 | https://resend.com | 100封/月 |
| Vercel | 部署托管 | https://vercel.com | 免费 |

### 2. 默认管理员账号

**请在首次登录后立即修改密码！**

- **邮箱**: `admin@yuantuo.com`
- **密码**: `YuanTuo@2026`

---

## 三、Supabase 数据库配置

### 步骤 1: 创建 Supabase 项目

1. 登录 https://supabase.com
2. 点击 "New Project"
3. 选择组织，填写项目名称（如 `yuantuo-crm`）
4. 设置数据库密码（请妥善保存）
5. 选择离目标客户最近的区域（推荐：新加坡或香港）
6. 点击 "Create new project"

### 步骤 2: 获取配置信息

1. 进入项目后，点击左侧 "Settings" → "API"
2. 复制以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 步骤 3: 执行建表 SQL

1. 点击左侧 "SQL Editor"
2. 点击 "New Query"
3. 复制并执行以下 SQL：

```sql
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
  country TEXT[],
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
  raw_data TEXT,
  department_id UUID REFERENCES departments(id),
  status VARCHAR(50) DEFAULT 'pending',
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

-- API配置表
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
  countries TEXT[],
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

-- 插入默认管理员账号
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

-- 创建公开访问策略
CREATE POLICY "Allow all" ON departments FOR ALL USING (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true);
CREATE POLICY "Allow all" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all" ON email_campaigns FOR ALL USING (true);
CREATE POLICY "Allow all" ON api_configs FOR ALL USING (true);
CREATE POLICY "Allow all" ON scrape_tasks FOR ALL USING (true);
CREATE POLICY "Allow all" ON email_templates FOR ALL USING (true);
```

4. 点击 "Run" 执行

### 步骤 4: 更新现有数据库（如果已有数据）

如果您的数据库已经存在，需要执行以下增量更新：

```sql
-- 更新 customers 表的 country 字段为数组类型
ALTER TABLE customers 
ALTER COLUMN country TYPE TEXT[] USING 
  CASE 
    WHEN country IS NULL THEN NULL
    WHEN country = '' THEN NULL
    ELSE ARRAY[country]
  END;

-- 更新 scrape_tasks 表
-- 1. 确保 keywords 是数组类型
ALTER TABLE scrape_tasks 
ALTER COLUMN keywords TYPE TEXT[] USING 
  CASE 
    WHEN keywords IS NULL THEN NULL
    ELSE string_to_array(keywords::text, ', ')
  END;

-- 2. 确保 countries 字段存在且为数组类型
ALTER TABLE scrape_tasks 
DROP COLUMN IF EXISTS country;

ALTER TABLE scrape_tasks 
ALTER COLUMN countries TYPE TEXT[] USING 
  CASE 
    WHEN countries IS NULL THEN NULL
    ELSE string_to_array(countries::text, ', ')
  END;
```

---

## 四、Vercel 部署

### 步骤 1: 准备代码仓库

1. 将项目代码推送到 GitHub
2. 确保项目根目录有以下文件：
   - `package.json`
   - `vite.config.ts`
   - `vercel.json`
   - `index.html`
   - `api/` 目录（包含 Serverless Functions）

### 步骤 2: 导入到 Vercel

1. 登录 https://vercel.com
2. 点击 "Add New" → "Project"
3. 导入您的 GitHub 仓库
4. 配置如下：
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 步骤 3: 配置环境变量（可选但推荐）

在 Vercel 项目设置中添加环境变量，可以跳过手动输入 Supabase 配置的步骤：

1. 进入 Vercel 项目 → Settings → Environment Variables
2. 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase Anon Key |

3. 重新部署项目

**配置环境变量后，用户打开系统将自动连接数据库，无需手动输入配置。**

### 步骤 4: 部署

#### 方式 1：通过 Vercel 网站部署
1. 点击 "Deploy"
2. 等待部署完成
3. 获取部署 URL（如 `https://your-app.vercel.app`）

#### 方式 2：通过 CLI 部署
```bash
# 安装 Vercel CLI（如果未安装）
npm install -g vercel

# 登录 Vercel
vercel login

# 部署到生产环境
vercel --prod --yes
```

---

## 五、首次使用配置

### 步骤 1: 访问系统

打开部署的 URL，会看到 Supabase 配置页面。

### 步骤 2: 填写 Supabase 配置

1. 输入 **Project URL**
2. 输入 **Anon Key**
3. 点击 "连接数据库"

### 步骤 3: 登录系统

使用默认管理员账号登录：
- 邮箱: `admin@yuantuo.com`
- 密码: `YuanTuo@2026`

### 步骤 4: 配置 API Keys

登录后进入 "系统设置"，配置以下 API：

| API 名称 | 说明 | 测试方式 |
|----------|------|----------|
| Apify API Token | 用于数据抓取 | 点击测试按钮 |
| 智谱 API Key | 用于 AI 生成邮件 | 点击测试按钮 |
| Resend API Key | 用于邮件发送 | 点击测试按钮 |
| 发件人邮箱 | 需要在 Resend 中验证的域名邮箱 | - |
| 邮箱验证 API Key（可选） | Abstract API 邮箱验证 | 点击测试按钮 |

**重要说明：**
- 所有 API 测试都通过服务器端 API Routes 进行，避免了 CORS 问题
- API Keys 安全存储在 Supabase 数据库中

### 步骤 5: 创建事业部

进入 "事业部管理"，创建您的事业部。

### 步骤 6: 创建用户账号

进入 "用户管理"，为团队成员创建账号。

---

## 六、API Routes 说明

系统使用 Vercel Serverless Functions 处理所有外部 API 调用，解决了浏览器 CORS 限制问题。

### API 端点列表

| 端点 | 功能 |
|------|------|
| `/api/test-apify` | 测试 Apify API 连接 |
| `/api/test-resend` | 测试 Resend API 连接 |
| `/api/test-zhipu` | 测试智谱 API 连接 |
| `/api/test-email-verify` | 测试邮箱验证 API 连接 |
| `/api/run-apify` | 启动 Apify Actor 抓取任务 |
| `/api/apify-status` | 获取抓取任务状态 |
| `/api/apify-results` | 获取抓取结果 |
| `/api/scrape` | 启动抓取任务（前端调用入口） |
| `/api/send-email` | 发送邮件 |
| `/api/generate-email` | AI 生成开发信 |
| `/api/verify-email` | 验证邮箱有效性 |

---

## 七、本地开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

**方式 1：仅前端开发**
```bash
npm run dev
```
访问 http://localhost:5173

**方式 2：完整开发（包含 API Routes）**
```bash
npm run dev:vercel
```
访问 http://localhost:3000

---

## 八、安全建议

1. **立即修改默认密码**
2. **定期备份 Supabase 数据**
3. **生产环境考虑启用更严格的 RLS 策略**
4. **API Keys 已安全存储在数据库中，无需担心前端泄露**
5. **启用 Vercel 的 HTTPS（默认已启用）**

---

## 九、常见问题

### Q: API 测试失败显示 "net::ERR_FAILED"
A: 这通常是旧版本的问题。请确保：
1. 已更新到最新代码（包含 `/api` 目录）
2. 重新部署到 Vercel
3. 清除浏览器缓存后重试

### Q: 登录后显示 "数据库未配置"
A: 清除浏览器的 sessionStorage，重新输入 Supabase 配置。

### Q: 邮件发送失败
A: 检查：
1. Resend API Key 是否正确
2. 发件人邮箱是否已在 Resend 中验证域名
3. 点击测试按钮确认 API 连接正常

### Q: AI 生成邮件失败
A: 检查智谱 API Key 是否有效，可在设置页面点击测试按钮确认。

### Q: 数据抓取无结果
A: 检查：
1. Apify API Token 是否正确
2. 所选 Actor 是否有访问权限
3. 搜索关键词是否合理

### Q: 本地开发 API 调用 404
A: 本地开发需要使用 `npm run dev:vercel` 启动，它会同时启动 Vite 和 Vercel dev server。

### Q: 抓取任务报错，提示字段类型错误
A: 请确保数据库字段已更新为数组类型（TEXT[]）：
- `customers.country` 应为 TEXT[]
- `scrape_tasks.keywords` 应为 TEXT[]
- `scrape_tasks.countries` 应为 TEXT[]
执行本文档中"步骤 4"的增量更新 SQL。

---

## 十、更新日志

### v1.1.0 (2026-03-16)
- **重要修复**: 修复多选国家/关键词时数组字段处理错误
- 修复 `api/route.ts` 导入路径错误
- 修复 `ScrapeTask` 接口字段名不一致问题
- 新增 `/api/scrape.ts` 路由文件
- 更新数据库字段类型：
  - `customers.country` 改为 TEXT[]（支持多国家）
  - `scrape_tasks.keywords` 改为 TEXT[]（支持多关键词）
  - `scrape_tasks.countries` 改为 TEXT[]（支持多国家）
- 修复 TypeScript 类型错误
- 优化前端数组字段显示逻辑

### v1.0.0 (2026-03-12)
- 初始版本
- 添加 Vercel API Routes 支持
- 解决 CORS 跨域问题
- 所有外部 API 调用通过服务器端代理

---

## 十一、技术支持

如有问题，请联系技术支持团队。

---

**版权所有 2026 元拓建材集团**
