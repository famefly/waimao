import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  FileText,
  UserCog,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { useStore, Notification } from '../store/useStore';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

// 所有菜单项
const allMenuItems = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard, adminOnly: false },
  { id: 'scrape', label: '客户抓取', icon: Search, adminOnly: false },
  { id: 'customers', label: '客户管理', icon: Users, adminOnly: false },
  { id: 'emails', label: '邮件营销', icon: Mail, adminOnly: false },
  { id: 'templates', label: '邮件模板', icon: FileText, adminOnly: false },
  { id: 'departments', label: '事业部管理', icon: Building2, adminOnly: true },
  { id: 'users', label: '用户管理', icon: UserCog, adminOnly: true },
  { id: 'settings', label: '系统设置', icon: Settings, adminOnly: false },
];

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  const { 
    currentUser, 
    currentDepartment, 
    notifications, 
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    logout 
  } = useStore();

  // 根据用户角色过滤菜单
  const menuItems = allMenuItems.filter(item => {
    if (item.adminOnly && currentUser?.role !== 'admin') {
      return false;
    }
    return true;
  });

  // 未读通知数量
  const unreadCount = notifications.filter(n => !n.read).length;

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } bg-gradient-to-b from-blue-900 to-blue-800 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-blue-700">
          {collapsed ? (
            <span className="text-2xl font-bold">元</span>
          ) : (
            <div className="text-center">
              <h1 className="text-lg font-bold">元拓建材集团</h1>
              <p className="text-xs text-blue-300">外贸AI工作流系统</p>
            </div>
          )}
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-blue-700 border-r-4 border-yellow-400'
                    : 'hover:bg-blue-700/50'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* 当前用户所属事业部 */}
        {!collapsed && currentUser?.department_id && currentDepartment && (
          <div className="px-4 py-3 border-t border-blue-700 text-sm">
            <p className="text-blue-300">当前事业部</p>
            <p className="font-medium truncate">{currentDepartment.name}</p>
          </div>
        )}

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-12 flex items-center justify-center border-t border-blue-700 hover:bg-blue-700/50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {menuItems.find((item) => item.id === currentPage)?.label || '工作台'}
            </h2>
            {currentDepartment && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {currentDepartment.name}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* 通知 */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* 通知下拉面板 */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
                  <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">通知中心</h3>
                    <div className="flex items-center space-x-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          全部已读
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearNotifications}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          清空
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-auto">
                    {notifications.length === 0 ? (
                      <div className="py-12 text-center text-gray-500">
                        <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p>暂无通知</p>
                        <p className="text-sm mt-1">任务完成或失败时会收到提醒</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${
                            !notification.read ? 'bg-blue-50/50' : ''
                          }`}
                          onClick={() => markNotificationRead(notification.id)}
                        >
                          <div className="flex items-start space-x-3">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">
                                {notification.title}
                              </p>
                              <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-gray-400 text-xs mt-1">
                                {formatTime(notification.createdAt)}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 用户信息 */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 pl-4 border-l border-gray-200 hover:bg-gray-50 rounded-lg pr-2 py-1 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                  {currentUser?.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="text-sm text-left">
                  <p className="font-medium text-gray-800">{currentUser?.name || '用户'}</p>
                  <p className="text-gray-500 text-xs">
                    {currentUser?.role === 'admin' ? '系统管理员' : '普通用户'}
                  </p>
                </div>
              </button>

              {/* 用户下拉菜单 */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 py-2">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-medium text-gray-900">{currentUser?.name}</p>
                    <p className="text-sm text-gray-500">{currentUser?.email}</p>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => { onNavigate('settings'); setShowUserMenu(false); }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <Settings className="w-4 h-4 mr-3" />
                      系统设置
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
};
