import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  Globe,
  Package,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { getSupabase, Department } from '../lib/supabase';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

interface DepartmentForm {
  name: string;
  region: string;
  products: string[];
}

export const DepartmentsPage: React.FC = () => {
  const { departments, setDepartments, setCurrentDepartment } = useStore();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DepartmentForm>({ name: '', region: '', products: [] });
  const [productInput, setProductInput] = useState('');
  const [users, setUsers] = useState<Record<string, number>>({});

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setDepartments(data as Department[]);
      }

      // 统计每个部门的用户数
      const { data: userData } = await supabase
        .from('users')
        .select('department_id');
      
      if (userData) {
        const userCounts: Record<string, number> = {};
        (userData as Array<{ department_id: string | null }>).forEach(u => {
          if (u.department_id) {
            userCounts[u.department_id] = (userCounts[u.department_id] || 0) + 1;
          }
        });
        setUsers(userCounts);
      }
    } catch (error) {
      console.error('加载事业部失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = () => {
    if (productInput.trim() && !form.products.includes(productInput.trim())) {
      setForm(prev => ({
        ...prev,
        products: [...prev.products, productInput.trim()],
      }));
      setProductInput('');
    }
  };

  const removeProduct = (product: string) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.filter(p => p !== product),
    }));
  };

  const startEditing = (department: Department) => {
    setEditing(department.id || null);
    setForm({
      name: department.name,
      region: department.region || '',
      products: department.products || [],
    });
  };

  const cancelEditing = () => {
    setEditing(null);
    setCreating(false);
    setForm({ name: '', region: '', products: [] });
    setProductInput('');
  };

  const saveDepartment = async () => {
    if (!form.name.trim()) {
      toast.error('请输入事业部名称');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      if (creating) {
        const { error } = await supabase
          .from('departments')
          .insert({
            name: form.name,
            region: form.region,
            products: form.products,
          } as never)
          .select()
          .single();

        if (error) throw error;
        toast.success('事业部创建成功');
      } else if (editing) {
        const { error } = await supabase
          .from('departments')
          .update({
            name: form.name,
            region: form.region,
            products: form.products,
          } as never)
          .eq('id', editing);

        if (error) throw error;
        toast.success('事业部更新成功');
      }

      cancelEditing();
      loadDepartments();
    } catch (error) {
      toast.error('保存失败');
      console.error(error);
    }
  };

  const deleteDepartment = async (id: string | undefined) => {
    if (!id) return;
    if (!confirm('确定要删除该事业部吗？关联的数据不会被删除。')) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      await supabase.from('departments').delete().eq('id', id);
      toast.success('删除成功');
      loadDepartments();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const switchDepartment = (department: Department) => {
    setCurrentDepartment(department);
    toast.success(`已切换到 ${department.name}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 创建按钮 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">事业部管理</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建事业部
          </button>
        )}
      </div>

      {/* 创建/编辑表单 */}
      {(creating || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {creating ? '新建事业部' : '编辑事业部'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                事业部名称 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：脚手架事业部"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                负责区域
              </label>
              <input
                type="text"
                value={form.region}
                onChange={e => setForm(prev => ({ ...prev, region: e.target.value }))}
                placeholder="例如：东南亚、欧洲"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                主营产品
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={productInput}
                  onChange={e => setProductInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addProduct())}
                  placeholder="输入产品名称后按回车添加"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={addProduct}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.products.map(product => (
                  <span
                    key={product}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {product}
                    <button
                      onClick={() => removeProduct(product)}
                      className="ml-2 text-blue-500 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={cancelEditing}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" />
              取消
            </button>
            <button
              onClick={saveDepartment}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              保存
            </button>
          </div>
        </div>
      )}

      {/* 事业部列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-100">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无事业部，点击上方按钮创建</p>
          </div>
        ) : (
          departments.map(department => (
            <div
              key={department.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{department.name}</h3>
                  {department.region && (
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <Globe className="w-3 h-3 mr-1" />
                      {department.region}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(department)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDepartment(department.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {department.products && department.products.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 flex items-center mb-2">
                    <Package className="w-3 h-3 mr-1" />
                    主营产品
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {department.products.slice(0, 3).map(product => (
                      <span
                        key={product}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        {product}
                      </span>
                    ))}
                    {department.products.length > 3 && (
                      <span className="px-2 py-0.5 text-gray-400 text-xs">
                        +{department.products.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center text-sm text-gray-500">
                  <Users className="w-4 h-4 mr-1" />
                  {(department.id && users[department.id]) || 0} 成员
                </div>
                <button
                  onClick={() => switchDepartment(department)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  切换到此部门
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
