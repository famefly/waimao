import { useState } from 'react';
import { Database, Check, Copy, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import { initSupabase, createTablesSql } from '../lib/supabase';

interface SetupPageProps {
  onComplete: () => void;
}

export default function SetupPage({ onComplete }: SetupPageProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);

  const handleCopySql = () => {
    navigator.clipboard.writeText(createTablesSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setError('请填写 Supabase URL 和 Anon Key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = initSupabase(supabaseUrl, supabaseKey);
      
      // 测试连接
      const { error: testError } = await supabase.from('users').select('count').limit(1);
      
      if (testError) {
        if (testError.message.includes('does not exist')) {
          setError('数据库表不存在，请先在 Supabase 中执行建表 SQL');
          setStep(2);
        } else {
          setError(`连接失败: ${testError.message}`);
        }
        setLoading(false);
        return;
      }

      // 连接成功，保存配置到 sessionStorage
      sessionStorage.setItem('supabase_url', supabaseUrl);
      sessionStorage.setItem('supabase_anon_key', supabaseKey);
      
      onComplete();
    } catch (err) {
      setError('连接失败，请检查配置信息');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-2xl border border-white/20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">系统初始化配置</h1>
          <p className="text-blue-200 mt-2">请配置 Supabase 数据库连接</p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step >= 1 ? 'text-green-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-green-500' : 'bg-gray-600'}`}>
              {step > 1 ? <Check className="w-5 h-5 text-white" /> : '1'}
            </div>
            <span className="ml-2 text-sm">填写配置</span>
          </div>
          <div className={`w-16 h-0.5 mx-4 ${step >= 2 ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          <div className={`flex items-center ${step >= 2 ? 'text-green-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-green-500' : 'bg-gray-600'}`}>
              {step > 2 ? <Check className="w-5 h-5 text-white" /> : '2'}
            </div>
            <span className="ml-2 text-sm">执行建表</span>
          </div>
          <div className={`w-16 h-0.5 mx-4 ${step >= 3 ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          <div className={`flex items-center ${step >= 3 ? 'text-green-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-green-500' : 'bg-gray-600'}`}>
              3
            </div>
            <span className="ml-2 text-sm">完成</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Supabase URL */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Supabase Project URL
            </label>
            <input
              type="url"
              name="setup_supabase_url"
              autoComplete="off"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="https://xxxxx.supabase.co"
            />
            <p className="mt-1 text-xs text-blue-300">在 Supabase 项目设置中获取</p>
          </div>

          {/* Supabase Anon Key */}
          <div>
            <label className="block text-sm font-medium text-blue-200 mb-2">
              Supabase Anon Key
            </label>
            <input
              type="password"
              name="setup_supabase_key"
              autoComplete="new-password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
            <p className="mt-1 text-xs text-blue-300">在 Supabase 项目设置 → API 中获取 anon public key</p>
          </div>

          {/* SQL 建表语句 */}
          <div>
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className="flex items-center text-blue-200 hover:text-white transition-colors"
            >
              {showSql ? <ChevronDown className="w-5 h-5 mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}
              <span>查看建表 SQL（需要先在 Supabase SQL Editor 中执行）</span>
            </button>
            
            {showSql && (
              <div className="mt-3 relative">
                <pre className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 text-xs text-green-400 overflow-auto max-h-64">
                  {createTablesSql}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="absolute top-2 right-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
                </button>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-start bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">配置错误</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 text-blue-200">
            <p className="text-sm">
              <strong>配置步骤：</strong>
            </p>
            <ol className="text-sm mt-2 space-y-1 list-decimal list-inside">
              <li>登录 <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">Supabase</a> 创建新项目</li>
              <li>在项目设置中获取 Project URL 和 anon public key</li>
              <li>打开 SQL Editor，执行上面的建表 SQL</li>
              <li>填写配置信息并测试连接</li>
            </ol>
          </div>

          {/* 测试连接按钮 */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading || !supabaseUrl || !supabaseKey}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在测试连接...
              </span>
            ) : '测试连接并继续'}
          </button>
        </div>

        <p className="text-center text-blue-300 text-sm mt-6">
          © 2026 元拓建材集团 版权所有
        </p>
      </div>
    </div>
  );
}
