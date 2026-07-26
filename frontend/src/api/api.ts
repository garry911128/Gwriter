import { clearToken, getToken } from '../auth/token';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api/v1';

// ── Types ──────────────────────────────────────────────────────
export interface ApiUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface ApiAuthResponse {
  token: string;
  user: ApiUser;
}

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

export type AISuggestType =
  'continue' | 'improve' | 'dialogue' | 'plot' | 'title' | 'emotion' | 'scene';

// ── Core request ───────────────────────────────────────────────

/** 後端統一以 {"error": "..."} 回傳錯誤，這裡把訊息取出來給 UI 顯示。 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return `伺服器回應 ${res.status}`;
  try {
    const body = JSON.parse(text) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // 不是 JSON，直接用原文（截斷避免整頁 HTML 灌進 UI）
  }
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

interface RequestOptions extends RequestInit {
  /** 登入與註冊本身不需要（也不該）帶舊的憑證。 */
  anonymous?: boolean;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { anonymous, ...init } = options ?? {};

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = anonymous ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });
  } catch {
    throw new ApiError(0, '無法連線到伺服器，請確認後端是否啟動。');
  }

  if (res.status === 401 && !anonymous) {
    // 憑證失效就地清除，AuthContext 會收到通知並把畫面切回登入頁。
    clearToken();
  }
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────────
export const authApi = {
  register(username: string, email: string, password: string): Promise<ApiAuthResponse> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
      anonymous: true,
    });
  },
  login(email: string, password: string): Promise<ApiAuthResponse> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      anonymous: true,
    });
  },
  me(): Promise<ApiUser> {
    return request('/auth/me');
  },
};

// ── Novels ─────────────────────────────────────────────────────
export const novelsApi = {
  list(): Promise<ApiNovel[]> {
    return request('/novels');
  },
  create(title: string, description = '', coverUrl = ''): Promise<ApiNovel> {
    return request('/novels', {
      method: 'POST',
      body: JSON.stringify({ title, description, cover_url: coverUrl }),
    });
  },
  update(
    novelId: number,
    data: { title?: string; description?: string; cover_url?: string },
  ): Promise<ApiNovel> {
    return request(`/novels/${novelId}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  publish(novelId: number): Promise<{ status: string }> {
    return request(`/novels/${novelId}/publish`, { method: 'PUT', body: '{}' });
  },
  delete(novelId: number): Promise<void> {
    return request(`/novels/${novelId}`, { method: 'DELETE' });
  },
};

// ── Chapters ───────────────────────────────────────────────────
export const chaptersApi = {
  list(novelId: number): Promise<ApiChapter[]> {
    return request(`/novels/${novelId}/chapters`);
  },
  create(title: string, novelId: number): Promise<ApiChapter> {
    return request(`/novels/${novelId}/chapters`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },
  update(chapterId: number, data: { title?: string; content?: string }): Promise<ApiChapter> {
    return request(`/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete(chapterId: number): Promise<void> {
    return request(`/chapters/${chapterId}`, { method: 'DELETE' });
  },
  reorder(novelId: number, ids: number[]): Promise<void> {
    return request(`/novels/${novelId}/chapters/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  },
};

// ── Characters ─────────────────────────────────────────────────
export const charactersApi = {
  list(novelId: number): Promise<ApiCharacter[]> {
    return request(`/novels/${novelId}/characters`);
  },
  create(
    novelId: number,
    data: {
      name: string;
      role: string;
      description: string;
      personality: string;
      background: string;
      avatar_url: string;
    },
  ): Promise<ApiCharacter> {
    return request(`/novels/${novelId}/characters`, { method: 'POST', body: JSON.stringify(data) });
  },
  update(
    id: number,
    data: {
      name: string;
      role: string;
      description: string;
      personality: string;
      background: string;
      avatar_url: string;
    },
  ): Promise<ApiCharacter> {
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
  create(
    novelId: number,
    data: { name: string; category: string; description: string },
  ): Promise<ApiWorldItem> {
    return request(`/novels/${novelId}/world`, { method: 'POST', body: JSON.stringify(data) });
  },
  update(
    id: number,
    data: { name: string; category: string; description: string },
  ): Promise<ApiWorldItem> {
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
    return request(`/chapters/${chapterId}/drafts`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
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
    return request('/ai/suggest', {
      method: 'POST',
      body: JSON.stringify({ content, type, ...ctx }),
    });
  },
};
