import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Users, Globe, Loader2, Save, X, CheckCircle } from 'lucide-react';
import { getSupabase, Department } from '../lib/supabase';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

// 可用渠道列表 - id 必须与 APIFY_ACTORS 中的 id 一致
const CHANNELS = [
  // 高价值渠道（直接返回邮箱）
  { id: 'code_crafter/leads-finder', name: 'Leads Finder', cat: 'high_value' },
  { id: 'memo23/thomasnet-scraper', name: 'ThomasNet', cat: 'high_value' },
  { id: 'curious_coder/crunchbase-scraper', name: 'Crunchbase', cat: 'high_value' },
  { id: 'apimaestro/linkedin-profile-search-scraper', name: 'LinkedIn', cat: 'high_value' },
  // 基础渠道（自动搭配邮箱提取）
  { id: 'compass/crawler-google-places', name: 'Google Maps', cat: 'basic' },
  { id: 'trudax/yellow-pages-us-scraper', name: 'Yellow Pages', cat: 'basic' },
  { id: 'canadesk/yellow-pages-scraper', name: 'Yellow Pages (全球)', cat: 'basic' },
  { id: 'tri_angle/yelp-scraper', name: 'Yelp', cat: 'basic' },
  { id: 'apify/facebook-pages-scraper', name: 'Facebook', cat: 'basic' },
  // B2B 平台（自动搭配邮箱提取）
  { id: 'adrian_horning/alibaba-scraper', name: 'Alibaba', cat: 'b2b' },
  { id: 'memo23/made-in-china-scraper', name: 'Made-in-China', cat: 'b2b' },
  { id: 'junglee/amazon-seller-scraper', name: 'Amazon卖家', cat: 'b2b' },
];

const CATS = [
  { id: 'high_value', name: '高价值渠道', desc: '直接返回邮箱' },
  { id: 'basic', name: '基础渠道', desc: '自动提取邮箱' },
  { id: 'b2b', name: 'B2B平台', desc: '供应商信息' },
];

export const DepartmentsPage: React.FC = () => {
  const { departments, setDepartments, setCurrentDepartment } = useStore();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', region: '', products: [] as string[], allowed_channels: [] as string[] });
  const [users, setUsers] = useState<Record<string, number>>({});

  useEffect(() => { load(); }, []);
  
  const load = async () => {
    setLoading(true);
    const s = getSupabase();
    if (!s) { setLoading(false); return; }
    try {
      const { data } = await s.from('departments').select('*').order('created_at', { ascending: false });
      if (data) setDepartments(data as Department[]);
      const { data: u } = await s.from('users').select('department_id');
      if (u) { const c: Record<string, number> = {}; u.forEach((x: any) => { if (x.department_id) c[x.department_id] = (c[x.department_id] || 0) + 1; }); setUsers(c); }
    } finally { setLoading(false); }
  };

  const toggleCh = (id: string) => setForm(p => ({ ...p, allowed_channels: p.allowed_channels.includes(id) ? p.allowed_channels.filter(x => x !== id) : [...p.allowed_channels, id] }));
  const selCat = (cat: string) => {
    const chs = CHANNELS.filter(c => c.cat === cat);
    const all = chs.every(c => form.allowed_channels.includes(c.id));
    setForm(p => ({ ...p, allowed_channels: all ? p.allowed_channels.filter(x => !chs.find(c => c.id === x)) : [...new Set([...p.allowed_channels, ...chs.map(c => c.id)])] }));
  };
  const getChName = (id: string) => CHANNELS.find(c => c.id === id)?.name || id;

  const save = async () => {
    if (!form.name.trim()) { toast.error('请输入名称'); return; }
    const s = getSupabase(); if (!s) return;
    try {
      if (creating) { const { error } = await s.from('departments').insert({ name: form.name, region: form.region, products: form.products, allowed_channels: form.allowed_channels } as never); if (error) throw error; toast.success('创建成功'); }
      else if (editing) { const { error } = await s.from('departments').update({ name: form.name, region: form.region, products: form.products, allowed_channels: form.allowed_channels } as never).eq('id', editing); if (error) throw error; toast.success('更新成功'); }
      setEditing(null); setCreating(false); setForm({ name: '', region: '', products: [], allowed_channels: [] }); load();
    } catch { toast.error('保存失败'); }
  };

  if (loading) return <div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between"><h2 className="text-xl font-semibold">事业部管理</h2>{!creating && <button onClick={() => setCreating(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg"><Plus className="w-4 h-4 mr-2" />新建</button>}</div>
      {(creating || editing) && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">{creating ? '新建' : '编辑'}事业部</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">名称 *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-1">区域</label><input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">可用渠道 ({form.allowed_channels.length})</label>
              <div className="space-y-4 max-h-80 overflow-y-auto border rounded-lg p-4">
                {CATS.map(cat => {
                  const chs = CHANNELS.filter(c => c.cat === cat.id);
                  const sel = chs.filter(c => form.allowed_channels.includes(c.id)).length;
                  return (
                    <div key={cat.id} className="border-b pb-4 last:border-0">
                      <div className="flex justify-between mb-2"><span className="text-sm font-medium">{cat.name} <span className="text-xs text-gray-400">{cat.desc}</span></span><button onClick={() => selCat(cat.id)} className="text-xs text-blue-600">{sel}/{chs.length} 全选</button></div>
                      <div className="flex flex-wrap gap-2">{chs.map(ch => <button key={ch.id} onClick={() => toggleCh(ch.id)} className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${form.allowed_channels.includes(ch.id) ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-600 border'}`}>{form.allowed_channels.includes(ch.id) && <CheckCircle className="w-3 h-3 mr-1" />}{ch.name}</button>)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => { setEditing(null); setCreating(false); setForm({ name: '', region: '', products: [], allowed_channels: [] }); }} className="px-4 py-2 border rounded-lg">取消</button><button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg">保存</button></div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.length === 0 ? <div className="col-span-full text-center py-12 bg-white rounded-xl border"><Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">暂无事业部</p></div> : departments.map(d => (
          <div key={d.id} className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between mb-4"><div><h3 className="text-lg font-semibold">{d.name}</h3>{d.region && <p className="text-sm text-gray-500 flex items-center mt-1"><Globe className="w-3 h-3 mr-1" />{d.region}</p>}</div><div className="flex gap-2"><button onClick={() => { setEditing(d.id || null); setForm({ name: d.name, region: d.region || '', products: d.products || [], allowed_channels: (d as any).allowed_channels || [] }); }} className="p-2 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button><button onClick={async () => { const userCount = d.id && users[d.id] ? users[d.id] : 0; if (userCount > 0) { toast.error(`无法删除：该部门有 ${userCount} 个成员，请先转移或删除成员`); return; } if (!confirm('确定删除?')) return; const s = getSupabase(); if (s) { const { error } = await s.from('departments').delete().eq('id', d.id); if (error) { toast.error('删除失败: ' + error.message); } else { toast.success('删除成功'); load(); } } }} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div></div>
            {((d as any).allowed_channels?.length > 0) && <div className="mb-4"><p className="text-sm text-gray-500 mb-2">可用渠道</p><div className="flex flex-wrap gap-1">{((d as any).allowed_channels || []).slice(0, 4).map((id: string) => <span key={id} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{getChName(id)}</span>)}{((d as any).allowed_channels || []).length > 4 && <span className="px-2 py-0.5 text-gray-400 text-xs">+{((d as any).allowed_channels || []).length - 4}</span>}</div></div>}
            <div className="flex justify-between pt-4 border-t text-sm text-gray-500"><span className="flex items-center"><Users className="w-4 h-4 mr-1" />{(d.id && users[d.id]) || 0} 成员</span><button onClick={() => { setCurrentDepartment(d); toast.success(`切换到 ${d.name}`); }} className="text-blue-600 font-medium">切换</button></div>
          </div>
        ))}
      </div>
    </div>
  );
};
