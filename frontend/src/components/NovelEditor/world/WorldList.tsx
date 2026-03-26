import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { worldApi, type ApiWorldItem } from '../../../api/api';

interface Props {
  novelId: number;
  isDarkMode: boolean;
}

const CATEGORIES = [
  { value: 'location',  label: '地點',   icon: 'bi-geo-alt-fill',     color: '#4a90e2' },
  { value: 'faction',   label: '勢力',   icon: 'bi-shield-fill',       color: '#e74c3c' },
  { value: 'history',   label: '歷史',   icon: 'bi-clock-history',     color: '#f39c12' },
  { value: 'culture',   label: '文化',   icon: 'bi-music-note-beamed', color: '#00b894' },
  { value: 'magic',     label: '規則/魔法', icon: 'bi-stars',          color: '#8e44ad' },
  { value: 'item',      label: '道具',   icon: 'bi-bag-fill',          color: '#e67e22' },
] as const;

type CategoryValue = typeof CATEGORIES[number]['value'];

function getCat(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[0];
}

const pillBtn = (bg: string, color: string): React.CSSProperties => ({
  padding: '4px 12px', border: 'none', borderRadius: '999px', cursor: 'pointer',
  background: bg, color, fontSize: '0.75rem', display: 'inline-flex',
  alignItems: 'center', gap: '4px', transition: 'all 0.15s',
});

const WorldList: React.FC<Props> = ({ novelId, isDarkMode }) => {
  const [items, setItems] = useState<ApiWorldItem[]>([]);
  const [filter, setFilter] = useState<CategoryValue | 'all'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { name: '', category: 'location', description: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    worldApi.list(novelId).then(setItems).catch(console.error);
  }, [novelId]);

  const resetForm = () => { setForm(emptyForm); setShowForm(false); setEditingId(null); };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (editingId !== null) {
      const updated = await worldApi.update(editingId, form);
      setItems(prev => prev.map(i => i.id === editingId ? updated : i));
    } else {
      const created = await worldApi.create(novelId, form);
      setItems(prev => [...prev, created]);
    }
    resetForm();
  };

  const handleEdit = (item: ApiWorldItem) => {
    setForm({ name: item.name, category: item.category, description: item.description });
    setEditingId(item.id);
    setShowForm(true);
    setExpandedId(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('確定要刪除此設定？')) return;
    await worldApi.delete(id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const displayed = filter === 'all' ? items : items.filter(i => i.category === filter);

  const inputStyle: React.CSSProperties = {
    background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#fff',
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.15)' : '#ddd'}`,
    color: isDarkMode ? '#fff' : '#333',
    borderRadius: '8px', fontSize: '0.85rem',
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
          <i className="bi bi-globe me-2" style={{ color: '#00b894' }}></i>世界觀
          <span className="ms-2 badge rounded-pill" style={{ background: 'rgba(0,184,148,0.25)', color: '#55efc4', fontSize: '0.7rem' }}>
            {items.length}
          </span>
        </h6>
        <button style={pillBtn('rgba(39,174,96,0.2)', '#6fcf97')}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(39,174,96,0.4)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(39,174,96,0.2)'; e.currentTarget.style.color = '#6fcf97'; }}
          onClick={() => { resetForm(); setShowForm(v => !v); }}>
          <i className="bi bi-plus-lg" style={{ fontSize: '0.8rem' }}></i>新增設定
        </button>
      </div>

      {/* 分類篩選 tabs */}
      <div className="d-flex flex-wrap gap-1 mb-3">
        <button style={{ ...pillBtn(filter === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)', isDarkMode ? '#fff' : '#333'), border: filter === 'all' ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent' }}
          onClick={() => setFilter('all')}>
          全部 <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>{items.length}</span>
        </button>
        {CATEGORIES.map(cat => {
          const count = items.filter(i => i.category === cat.value).length;
          if (count === 0 && filter !== cat.value) return null;
          const active = filter === cat.value;
          return (
            <button key={cat.value}
              style={{ ...pillBtn(active ? `${cat.color}33` : 'rgba(255,255,255,0.07)', active ? cat.color : isDarkMode ? 'rgba(255,255,255,0.5)' : '#666'), border: active ? `1px solid ${cat.color}55` : '1px solid transparent' }}
              onClick={() => setFilter(active ? 'all' : cat.value)}>
              <i className={`bi ${cat.icon}`}></i>{cat.label}
              {count > 0 && <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* 新增/編輯 表單 */}
      {showForm && (
        <div className="p-3 mb-3 rounded-3" style={{ background: isDarkMode ? 'rgba(0,184,148,0.1)' : 'rgba(0,184,148,0.06)', border: '1px solid rgba(0,184,148,0.25)' }}>
          <div className="d-flex gap-2 mb-2">
            <Form.Control size="sm" placeholder="名稱 *" value={form.name} style={{ ...inputStyle, flex: 2 }}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Form.Select size="sm" value={form.category} style={{ ...inputStyle, flex: 2 }}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Form.Select>
          </div>
          <Form.Control as="textarea" rows={3} size="sm" placeholder="詳細描述" value={form.description} className="mb-2"
            style={inputStyle} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="d-flex gap-2">
            <button style={pillBtn('rgba(74,144,226,0.3)', '#a0c4f1')}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.6)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.3)'; e.currentTarget.style.color = '#a0c4f1'; }}
              onClick={handleSubmit}>
              <i className="bi bi-check2"></i>{editingId ? '儲存變更' : '新增設定'}
            </button>
            <button style={pillBtn('rgba(255,255,255,0.1)', isDarkMode ? '#aaa' : '#666')}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onClick={resetForm}>取消</button>
          </div>
        </div>
      )}

      {/* 設定卡列表 */}
      <div className="d-flex flex-column gap-2">
        {displayed.map(item => {
          const cat = getCat(item.category);
          const isExpanded = expandedId === item.id;

          return (
            <div key={item.id} className="rounded-3 overflow-hidden"
              style={{ background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, transition: 'all 0.2s' }}>

              <div className="d-flex align-items-center gap-3 p-3" style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}>

                {/* 分類圖示 */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: `${cat.color}22`, border: `1px solid ${cat.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cat.color, fontSize: '0.95rem',
                }}>
                  <i className={`bi ${cat.icon}`}></i>
                </div>

                <div className="flex-grow-1 min-width-0">
                  <div className="d-flex align-items-center gap-2">
                    <span className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`} style={{ fontSize: '0.88rem' }}>{item.name}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '999px', fontSize: '0.68rem', background: `${cat.color}1a`, color: cat.color, border: `1px solid ${cat.color}33` }}>
                      {cat.label}
                    </span>
                  </div>
                  {item.description && !isExpanded && (
                    <div className={`small mt-1 text-truncate ${isDarkMode ? 'text-light opacity-60' : 'text-muted'}`} style={{ fontSize: '0.78rem' }}>
                      {item.description}
                    </div>
                  )}
                </div>

                <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} ${isDarkMode ? 'text-light opacity-50' : 'text-muted'}`} style={{ fontSize: '0.75rem', flexShrink: 0 }}></i>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3" style={{ borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                  {item.description && (
                    <div className={`small pt-3 ${isDarkMode ? 'text-light' : 'text-dark'}`} style={{ fontSize: '0.83rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {item.description}
                    </div>
                  )}
                  <div className="d-flex gap-2 mt-3">
                    <button style={pillBtn('rgba(74,144,226,0.2)', '#a0c4f1')}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.45)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.2)'; e.currentTarget.style.color = '#a0c4f1'; }}
                      onClick={() => handleEdit(item)}>
                      <i className="bi bi-pencil" style={{ fontSize: '0.75rem' }}></i>編輯
                    </button>
                    <button style={pillBtn('rgba(231,76,60,0.18)', '#ff8a80')}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(231,76,60,0.4)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(231,76,60,0.18)'; e.currentTarget.style.color = '#ff8a80'; }}
                      onClick={() => handleDelete(item.id)}>
                      <i className="bi bi-trash3" style={{ fontSize: '0.75rem' }}></i>刪除
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {displayed.length === 0 && !showForm && (
        <div className={`text-center py-4 ${isDarkMode ? 'text-light opacity-40' : 'text-muted'}`} style={{ fontSize: '0.82rem' }}>
          <i className="bi bi-globe d-block mb-2" style={{ fontSize: '1.8rem', opacity: 0.4 }}></i>
          {filter === 'all' ? '尚無世界觀設定，點「新增設定」開始建立' : `此分類尚無項目`}
        </div>
      )}
    </div>
  );
};

export default WorldList;
