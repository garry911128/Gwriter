import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { charactersApi, type ApiCharacter } from '../../../api/api';

interface Props {
  novelId: number;
  isDarkMode: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  '主角': '#4a90e2',
  '女主角': '#e84393',
  '反派': '#e74c3c',
  '配角': '#00b894',
  '導師': '#f39c12',
};

function getInitials(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function getRoleColor(role: string) {
  return ROLE_COLORS[role] ?? '#8e44ad';
}

const pillBtn = (bg: string, color: string): React.CSSProperties => ({
  padding: '5px 14px', border: 'none', borderRadius: '999px', cursor: 'pointer',
  background: bg, color, fontSize: '0.78rem', display: 'inline-flex',
  alignItems: 'center', gap: '5px', transition: 'all 0.15s',
});

const CharactersList: React.FC<Props> = ({ novelId, isDarkMode }) => {
  const [characters, setCharacters] = useState<ApiCharacter[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { name: '', role: '', description: '', personality: '', background: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    charactersApi.list(novelId).then(setCharacters).catch(console.error);
  }, [novelId]);

  const resetForm = () => { setForm(emptyForm); setShowForm(false); setEditingId(null); };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (editingId !== null) {
      const updated = await charactersApi.update(editingId, form);
      setCharacters(prev => prev.map(c => c.id === editingId ? updated : c));
    } else {
      const created = await charactersApi.create(novelId, form);
      setCharacters(prev => [...prev, created]);
    }
    resetForm();
  };

  const handleEdit = (c: ApiCharacter) => {
    setForm({ name: c.name, role: c.role, description: c.description, personality: c.personality, background: c.background });
    setEditingId(c.id);
    setShowForm(true);
    setExpandedId(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('確定要刪除此角色？')) return;
    await charactersApi.delete(id);
    setCharacters(prev => prev.filter(c => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

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
          <i className="bi bi-people me-2" style={{ color: '#e74c3c' }}></i>角色卡
          <span className="ms-2 badge rounded-pill" style={{ background: 'rgba(231,76,60,0.25)', color: '#ff8a80', fontSize: '0.7rem' }}>
            {characters.length}
          </span>
        </h6>
        <button style={pillBtn('rgba(39,174,96,0.2)', '#6fcf97')}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(39,174,96,0.4)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(39,174,96,0.2)'; e.currentTarget.style.color = '#6fcf97'; }}
          onClick={() => { resetForm(); setShowForm(v => !v); }}>
          <i className="bi bi-plus-lg" style={{ fontSize: '0.8rem' }}></i>新增角色
        </button>
      </div>

      {/* 新增/編輯 表單 */}
      {showForm && (
        <div className="p-3 mb-3 rounded-3" style={{ background: isDarkMode ? 'rgba(231,76,60,0.12)' : 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.25)' }}>
          <div className="d-flex gap-2 mb-2">
            <Form.Control size="sm" placeholder="角色姓名 *" value={form.name} style={{ ...inputStyle, flex: 2 }}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Form.Control size="sm" placeholder="角色定位（主角/反派...）" value={form.role} style={{ ...inputStyle, flex: 3 }}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          </div>
          <Form.Control as="textarea" rows={2} size="sm" placeholder="外貌描述" value={form.description} className="mb-2"
            style={inputStyle} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Form.Control as="textarea" rows={2} size="sm" placeholder="個性特點" value={form.personality} className="mb-2"
            style={inputStyle} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} />
          <Form.Control as="textarea" rows={2} size="sm" placeholder="人物背景" value={form.background} className="mb-2"
            style={inputStyle} onChange={e => setForm(f => ({ ...f, background: e.target.value }))} />
          <div className="d-flex gap-2 mt-1">
            <button style={pillBtn('rgba(74,144,226,0.3)', '#a0c4f1')}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.6)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.3)'; e.currentTarget.style.color = '#a0c4f1'; }}
              onClick={handleSubmit}>
              <i className="bi bi-check2"></i>{editingId ? '儲存變更' : '新增角色'}
            </button>
            <button style={pillBtn('rgba(255,255,255,0.1)', isDarkMode ? '#aaa' : '#666')}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onClick={resetForm}>取消</button>
          </div>
        </div>
      )}

      {/* 角色卡列表 */}
      <div className="d-flex flex-column gap-2">
        {characters.map(c => {
          const roleColor = getRoleColor(c.role);
          const isExpanded = expandedId === c.id;

          return (
            <div key={c.id} className="rounded-3 overflow-hidden"
              style={{ background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, transition: 'all 0.2s' }}>

              {/* 卡片主體 */}
              <div className="d-flex align-items-center gap-3 p-3" style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : c.id)}>

                {/* 頭像縮寫 */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                  background: `${roleColor}33`, border: `2px solid ${roleColor}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: 'bold', color: roleColor,
                }}>
                  {getInitials(c.name)}
                </div>

                <div className="flex-grow-1 min-width-0">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`} style={{ fontSize: '0.9rem' }}>{c.name}</span>
                    {c.role && (
                      <span style={{ padding: '1px 8px', borderRadius: '999px', fontSize: '0.7rem', background: `${roleColor}22`, color: roleColor, border: `1px solid ${roleColor}44` }}>
                        {c.role}
                      </span>
                    )}
                  </div>
                  {c.description && !isExpanded && (
                    <div className={`small mt-1 text-truncate ${isDarkMode ? 'text-light opacity-60' : 'text-muted'}`} style={{ fontSize: '0.78rem' }}>
                      {c.description}
                    </div>
                  )}
                </div>

                <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} ${isDarkMode ? 'text-light opacity-50' : 'text-muted'}`} style={{ fontSize: '0.75rem', flexShrink: 0 }}></i>
              </div>

              {/* 展開內容 */}
              {isExpanded && (
                <div className="px-3 pb-3" style={{ borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                  <div className="pt-3 d-flex flex-column gap-2">
                    {c.description && (
                      <div>
                        <div className={`small fw-bold mb-1 ${isDarkMode ? 'text-light opacity-60' : 'text-muted'}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>外貌描述</div>
                        <div className={`small ${isDarkMode ? 'text-light' : 'text-dark'}`} style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>{c.description}</div>
                      </div>
                    )}
                    {c.personality && (
                      <div>
                        <div className={`small fw-bold mb-1 ${isDarkMode ? 'text-light opacity-60' : 'text-muted'}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>個性特點</div>
                        <div className={`small ${isDarkMode ? 'text-light' : 'text-dark'}`} style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>{c.personality}</div>
                      </div>
                    )}
                    {c.background && (
                      <div>
                        <div className={`small fw-bold mb-1 ${isDarkMode ? 'text-light opacity-60' : 'text-muted'}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>人物背景</div>
                        <div className={`small ${isDarkMode ? 'text-light' : 'text-dark'}`} style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>{c.background}</div>
                      </div>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button style={pillBtn('rgba(74,144,226,0.2)', '#a0c4f1')}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.45)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.2)'; e.currentTarget.style.color = '#a0c4f1'; }}
                      onClick={() => handleEdit(c)}>
                      <i className="bi bi-pencil" style={{ fontSize: '0.75rem' }}></i>編輯
                    </button>
                    <button style={pillBtn('rgba(231,76,60,0.18)', '#ff8a80')}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(231,76,60,0.4)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(231,76,60,0.18)'; e.currentTarget.style.color = '#ff8a80'; }}
                      onClick={() => handleDelete(c.id)}>
                      <i className="bi bi-trash3" style={{ fontSize: '0.75rem' }}></i>刪除
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {characters.length === 0 && !showForm && (
        <div className={`text-center py-4 ${isDarkMode ? 'text-light opacity-40' : 'text-muted'}`} style={{ fontSize: '0.82rem' }}>
          <i className="bi bi-person-plus d-block mb-2" style={{ fontSize: '1.8rem', opacity: 0.4 }}></i>
          尚無角色，點「新增角色」開始建立
        </div>
      )}
    </div>
  );
};

export default CharactersList;
