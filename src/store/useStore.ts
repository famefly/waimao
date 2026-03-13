import { create } from 'zustand';
import { Customer, Department, EmailCampaign } from '../lib/supabase';

// 通知类型
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  taskId?: string;
}

// 用户类型
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  department_id: string | null;
  department?: Department | null;
  status: 'active' | 'inactive';
}

interface AppState {
  // 当前用户
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;

  // 通知
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  // 事业部
  departments: Department[];
  setDepartments: (departments: Department[]) => void;
  currentDepartment: Department | null;
  setCurrentDepartment: (department: Department | null) => void;

  // 客户
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  addCustomers: (customers: Customer[]) => void;

  // 邮件
  campaigns: EmailCampaign[];
  setCampaigns: (campaigns: EmailCampaign[]) => void;

  // 配置状态
  isConfigured: boolean;
  setIsConfigured: (configured: boolean) => void;

  // 加载状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  logout: () => {
    sessionStorage.removeItem('yuantuo_user');
    set({ currentUser: null, notifications: [] });
  },

  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          createdAt: new Date(),
        },
        ...state.notifications,
      ].slice(0, 50), // 最多保留50条通知
    })),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearNotifications: () => set({ notifications: [] }),

  departments: [],
  setDepartments: (departments) => set({ departments }),
  currentDepartment: null,
  setCurrentDepartment: (department) => set({ currentDepartment: department }),

  customers: [],
  setCustomers: (customers) => set({ customers }),
  addCustomers: (newCustomers) =>
    set((state) => ({ customers: [...state.customers, ...newCustomers] })),

  campaigns: [],
  setCampaigns: (campaigns) => set({ campaigns }),

  isConfigured: false,
  setIsConfigured: (configured) => set({ isConfigured: configured }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
