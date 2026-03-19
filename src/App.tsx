import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ScrapePage } from './components/ScrapePage';
import { CustomersPage } from './components/CustomersPage';
import { EmailsPage } from './components/EmailsPage';
import { DepartmentsPage } from './components/DepartmentsPage';
import { SettingsPage } from './components/SettingsPage';
import { UsersPage } from './components/UsersPage';
import { EmailTemplatesPage } from './components/EmailTemplatesPage';
import LoginPage from './components/LoginPage';
import SetupPage from './components/SetupPage';
import { useStore, User } from './store/useStore';
import { getSupabase, initSupabase, isEnvConfigured } from './lib/supabase';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { currentUser, setCurrentUser, setCurrentDepartment, setIsConfigured } = useStore();

  useEffect(() => {
    initializeApp();
  }, []);

  // 恢复用户的事业部信息（包含 allowed_channels）
  const restoreUserDepartment = async (user: User) => {
    const supabase = getSupabase();
    if (!supabase || !user.department_id) return;

    try {
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name, region, products, allowed_channels')
        .eq('id', user.department_id)
        .single();

      if (deptData) {
        setCurrentDepartment(deptData as any);
      }
    } catch (err) {
      console.error('Failed to restore department:', err);
    }
  };

  const initializeApp = async () => {
    setIsLoading(true);

    // 优先检查环境变量配置
    if (isEnvConfigured()) {
      // 环境变量已配置，直接初始化
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { error } = await supabase.from('api_configs').select('count').limit(1);
          if (!error) {
            setIsConfigured(true);
            // 检查用户会话
            const savedUser = sessionStorage.getItem('yuantuo_user');
            if (savedUser) {
              try {
                const user = JSON.parse(savedUser) as User;
                setCurrentUser(user);
                // 恢复事业部信息（包含 allowed_channels）
                await restoreUserDepartment(user);
              } catch {
                sessionStorage.removeItem('yuantuo_user');
              }
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('Env config init error:', err);
      }
    }

    // 检查 sessionStorage 配置
    const url = sessionStorage.getItem('supabase_url');
    const key = sessionStorage.getItem('supabase_anon_key');

    if (!url || !key) {
      setNeedsSetup(true);
      setIsLoading(false);
      return;
    }

    try {
      initSupabase(url, key);
      const supabase = getSupabase();

      if (supabase) {
        const { error } = await supabase.from('api_configs').select('count').limit(1);
        if (error) {
          console.error('Supabase connection error:', error);
          setNeedsSetup(true);
          setIsLoading(false);
          return;
        }

        setIsConfigured(true);

        // 检查用户会话
        const savedUser = sessionStorage.getItem('yuantuo_user');
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser) as User;
            setCurrentUser(user);
            // 恢复事业部信息（包含 allowed_channels）
            await restoreUserDepartment(user);
          } catch {
            sessionStorage.removeItem('yuantuo_user');
          }
        }
      }
    } catch (err) {
      console.error('Init error:', err);
      setNeedsSetup(true);
    }

    setIsLoading(false);
  };

  const handleSetupComplete = () => {
    setNeedsSetup(false);
    initializeApp();
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">正在加载系统...</p>
        </div>
      </div>
    );
  }

  // 需要配置 Supabase
  if (needsSetup) {
    return <SetupPage onComplete={handleSetupComplete} />;
  }

  // 未登录状态
  if (!currentUser) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'scrape':
        return <ScrapePage />;
      case 'customers':
        return <CustomersPage />;
      case 'emails':
        return <EmailsPage />;
      case 'templates':
        return <EmailTemplatesPage />;
      case 'departments':
        // 只有管理员可以访问
        return currentUser.role === 'admin' ? <DepartmentsPage /> : <Dashboard />;
      case 'users':
        // 只有管理员可以访问
        return currentUser.role === 'admin' ? <UsersPage /> : <Dashboard />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </Layout>
    </>
  );
};

export default App;