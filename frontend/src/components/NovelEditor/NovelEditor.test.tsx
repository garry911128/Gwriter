import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NovelEditor from './NovelEditor';
import { AuthProvider } from '../../auth/AuthContext';
import { setToken } from '../../auth/token';
import {
  ApiError,
  aiApi,
  authApi,
  chaptersApi,
  charactersApi,
  draftsApi,
  novelsApi,
  worldApi,
  type ApiChapter,
  type ApiNovel,
} from '../../api/api';

const novel: ApiNovel = {
  id: 1,
  author_id: 1,
  title: '青雲志',
  description: '',
  cover_url: '',
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeChapter(id: number, title: string, order: number, content = ''): ApiChapter {
  return {
    id,
    novel_id: 1,
    title,
    content,
    order,
    word_count: Array.from(content.replace(/<[^>]*>/g, '')).length,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

/** 讓所有 API 都有一個安全的預設行為，個別測試只覆寫它關心的那一個。 */
function stubApis(chapters: ApiChapter[] = [makeChapter(10, '第一章', 1)]) {
  vi.spyOn(authApi, 'me').mockResolvedValue({
    id: 1,
    username: '林作者',
    email: 'author@example.com',
    created_at: '',
  });
  vi.spyOn(novelsApi, 'list').mockResolvedValue([novel]);
  vi.spyOn(chaptersApi, 'list').mockResolvedValue(chapters);
  vi.spyOn(charactersApi, 'list').mockResolvedValue([]);
  vi.spyOn(worldApi, 'list').mockResolvedValue([]);
}

async function renderEditor() {
  render(
    <AuthProvider>
      <NovelEditor />
    </AuthProvider>,
  );
  // 等載入結束
  await screen.findByRole('button', { name: /新增章節/ });
}

describe('NovelEditor', () => {
  beforeEach(() => {
    setToken('test-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the novel and its chapters', async () => {
    stubApis([makeChapter(10, '第一章', 1, '<p>開頭</p>'), makeChapter(11, '第二章', 2)]);
    await renderEditor();

    expect(screen.getByText('1. 第一章')).toBeInTheDocument();
    expect(screen.getByText('2. 第二章')).toBeInTheDocument();
    // 第一章的內容會載進編輯器
    expect(screen.getByTestId('rich-text-editor')).toHaveValue('<p>開頭</p>');
  });

  it('surfaces a chapter load failure instead of spinning forever', async () => {
    stubApis();
    vi.spyOn(chaptersApi, 'list').mockRejectedValue(
      new ApiError(500, '伺服器發生錯誤，請稍後再試。'),
    );

    render(
      <AuthProvider>
        <NovelEditor />
      </AuthProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('伺服器發生錯誤');
    expect(screen.queryByText('載入中...')).not.toBeInTheDocument();
  });

  // CM-07：停止輸入 3 秒後自動寫入。
  it('auto-saves the chapter three seconds after typing stops', async () => {
    stubApis();
    const update = vi
      .spyOn(chaptersApi, 'update')
      .mockResolvedValue(makeChapter(10, '第一章', 1, '<p>新內容</p>'));

    await renderEditor();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await user.type(screen.getByTestId('rich-text-editor'), 'x');
    expect(update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(10, { content: expect.stringContaining('x') });
  });

  // CM-09：儲存失敗要看得見，而且必須說明原因。
  it('shows why a save failed', async () => {
    stubApis();
    vi.spyOn(chaptersApi, 'update').mockRejectedValue(new ApiError(404, '找不到這個章節。'));
    vi.spyOn(draftsApi, 'create').mockResolvedValue({
      id: 1,
      chapter_id: 10,
      content: '',
      preview: '',
      saved_at: '',
    });

    await renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /儲存/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('找不到這個章節。');
    expect(screen.getByText('儲存失敗')).toBeInTheDocument();
  });

  // DM-01：手動儲存除了寫入章節，還要另外建立草稿快照。
  it('creates a draft snapshot on manual save', async () => {
    stubApis();
    vi.spyOn(chaptersApi, 'update').mockResolvedValue(makeChapter(10, '第一章', 1));
    const createDraft = vi.spyOn(draftsApi, 'create').mockResolvedValue({
      id: 1,
      chapter_id: 10,
      content: '',
      preview: '',
      saved_at: '',
    });

    await renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /儲存/ }));

    await waitFor(() => expect(createDraft).toHaveBeenCalledWith(10, ''));
  });

  // REL-04：伺服器拒絕新順序時，畫面要退回真實狀態。
  it('rolls back the chapter order when the server rejects it', async () => {
    stubApis([makeChapter(10, '第一章', 1), makeChapter(11, '第二章', 2)]);
    vi.spyOn(chaptersApi, 'update').mockResolvedValue(makeChapter(10, '第一章', 1));
    vi.spyOn(chaptersApi, 'reorder').mockRejectedValue(
      new ApiError(404, 'ids 中有不屬於這部小說的章節。'),
    );

    await renderEditor();
    const second = screen.getByText('2. 第二章');
    await userEvent.hover(second);
    const row = second.closest('div.rounded-3') as HTMLElement;
    await userEvent.click(within(row).getByTitle('上移'));

    expect(await screen.findByRole('alert')).toHaveTextContent('不屬於這部小說');
    // 順序必須回到原狀
    await waitFor(() => expect(screen.getByText('1. 第一章')).toBeInTheDocument());
    expect(screen.getByText('2. 第二章')).toBeInTheDocument();
  });

  // NM-07
  it('deletes the novel only after confirmation', async () => {
    stubApis();
    const del = vi.spyOn(novelsApi, 'delete').mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await renderEditor();
    await userEvent.click(screen.getAllByRole('button', { name: /青雲志/ })[0]);
    await userEvent.click(screen.getByText('刪除目前小說'));
    expect(del).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await userEvent.click(screen.getByText('刪除目前小說'));
    await waitFor(() => expect(del).toHaveBeenCalledWith(1));
  });

  // UB-05
  it('persists the theme preference across mounts', async () => {
    stubApis();
    await renderEditor();

    await userEvent.click(screen.getByRole('button', { name: '切換為淺色模式' }));

    expect(localStorage.getItem('gwriter_dark_mode')).toBe('false');
    expect(screen.getByRole('button', { name: '切換為深色模式' })).toBeInTheDocument();
  });

  // SEC-09：AI 回傳的純文字必須轉義後才插進 HTML。
  it('escapes AI output before inserting it into the chapter', async () => {
    stubApis();
    vi.spyOn(chaptersApi, 'update').mockResolvedValue(makeChapter(10, '第一章', 1));
    vi.spyOn(aiApi, 'suggest').mockResolvedValue({
      suggestion: '<script>alert(1)</script>山上有座廟。',
    });

    await renderEditor();
    const editor = screen.getByTestId('rich-text-editor');
    await userEvent.type(editor, '從前有座山。');

    await userEvent.click(screen.getByRole('button', { name: /續寫/ }));
    await userEvent.click(await screen.findByRole('button', { name: /採用建議/ }));

    // toHaveValue 不支援非對稱比對器，直接看 DOM 值。
    const value = () => (editor as HTMLTextAreaElement).value;
    await waitFor(() => expect(value()).toContain('&lt;script&gt;'));
    expect(value()).not.toContain('<script>');
    expect(value()).toContain('山上有座廟。');
  });

  it('shows the logged-in user and can log out', async () => {
    stubApis();
    await renderEditor();

    await userEvent.click(screen.getByRole('button', { name: /林作者/ }));
    expect(screen.getByText('author@example.com')).toBeInTheDocument();

    await userEvent.click(screen.getByText('登出'));
    expect(localStorage.getItem('gwriter_token')).toBeNull();
  });

  // OL-01
  it('renders the outline tab instead of a blank sidebar', async () => {
    stubApis([makeChapter(10, '第一章', 1, '<p>青雲山下</p>')]);
    await renderEditor();

    await userEvent.click(screen.getByRole('button', { name: /大綱/ }));

    expect(screen.getByText('青雲山下')).toBeInTheDocument();
    expect(screen.getByText(/平均 \d+ 字／章/)).toBeInTheDocument();
  });
});
