const API_BASE = 'http://localhost:8080/api/v1';

export const DEFAULT_NOVEL_ID = 1;

// ── Types ──────────────────────────────────────────────────────
export interface ApiNovel {
  id: number;
  author_id: number;
  title: string;
  description: string;
  cover_url: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ApiChapter {
  id: number;
  novel_id: number;
  title: string;
  content: string;
  order: number;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiCharacter {
  id: number;
  novel_id: number;
  name: string;
  role: string;
  description: string;
  personality: string;
  background: string;
  avatar_url: string;
}

export interface ApiWorldItem {
  id: number;
  novel_id: number;
  name: string;
  category: 'location' | 'history' | 'culture';
  description: string;
}

export interface ApiDraft {
  id: number;
  chapter_id: number;
  content: string;
  preview: string;
  saved_at: string;
}

export type AISuggestType = 'continue' | 'improve' | 'dialogue' | 'plot' | 'title' | 'emotion' | 'scene';

// ── Core request ───────────────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Novels ─────────────────────────────────────────────────────
export const novelsApi = {
  list(): Promise<ApiNovel[]> {
    return request('/novels');
  },
  create(title: string, description = ''): Promise<ApiNovel> {
    return request('/novels', { method: 'POST', body: JSON.stringify({ title, description }) });
  },
  update(novelId: number, data: { title?: string; description?: string }): Promise<ApiNovel> {
    return request(`/novels/${novelId}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  publish(novelId: number): Promise<{ status: string }> {
    return request(`/novels/${novelId}/publish`, { method: 'PUT', body: '{}' });
  },
};

// ── Chapters ───────────────────────────────────────────────────
export const chaptersApi = {
  list(novelId: number): Promise<ApiChapter[]> {
    return request(`/novels/${novelId}/chapters`);
  },
  create(title: string, novelId: number): Promise<ApiChapter> {
    return request(`/novels/${novelId}/chapters`, { method: 'POST', body: JSON.stringify({ title }) });
  },
  update(chapterId: number, data: { title?: string; content?: string }): Promise<ApiChapter> {
    return request(`/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete(chapterId: number): Promise<void> {
    return request(`/chapters/${chapterId}`, { method: 'DELETE' });
  },
  reorder(novelId: number, ids: number[]): Promise<void> {
    return request(`/novels/${novelId}/chapters/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) });
  },
};

// ── Characters ─────────────────────────────────────────────────
export const charactersApi = {
  list(novelId: number): Promise<ApiCharacter[]> {
    return request(`/novels/${novelId}/characters`);
  },
  create(novelId: number, data: { name: string; role: string; description: string; personality: string; background: string }): Promise<ApiCharacter> {
    return request(`/novels/${novelId}/characters`, { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: number, data: { name: string; role: string; description: string; personality: string; background: string }): Promise<ApiCharacter> {
    return request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete(id: number): Promise<void> {
    return request(`/characters/${id}`, { method: 'DELETE' });
  },
};

// ── World Items ────────────────────────────────────────────────
export const worldApi = {
  list(novelId: number): Promise<ApiWorldItem[]> {
    return request(`/novels/${novelId}/world`);
  },
  create(novelId: number, data: { name: string; category: string; description: string }): Promise<ApiWorldItem> {
    return request(`/novels/${novelId}/world`, { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: number, data: { name: string; category: string; description: string }): Promise<ApiWorldItem> {
    return request(`/world/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete(id: number): Promise<void> {
    return request(`/world/${id}`, { method: 'DELETE' });
  },
};

// ── Drafts ─────────────────────────────────────────────────────
export const draftsApi = {
  list(chapterId: number): Promise<ApiDraft[]> {
    return request(`/chapters/${chapterId}/drafts`);
  },
  create(chapterId: number, content: string): Promise<ApiDraft> {
    return request(`/chapters/${chapterId}/drafts`, { method: 'POST', body: JSON.stringify({ content }) });
  },
  restore(draftId: number): Promise<ApiDraft> {
    return request(`/drafts/${draftId}/restore`, { method: 'POST', body: '{}' });
  },
};

export interface AIContext {
  characters?: string[];
  world?: string[];
  novel_title?: string;
}

// ── AI ─────────────────────────────────────────────────────────
export const aiApi = {
  suggest(content: string, type: AISuggestType, ctx?: AIContext): Promise<{ suggestion: string }> {
    return request('/ai/suggest', { method: 'POST', body: JSON.stringify({ content, type, ...ctx }) });
  },
};
