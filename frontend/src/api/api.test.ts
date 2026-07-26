import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, chaptersApi, novelsApi, aiApi } from './api';

function mockFetch(response: Response | Promise<Response> | Error) {
  const fn = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api request layer', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed body on success', async () => {
    mockFetch(jsonResponse(200, [{ id: 1, title: '青雲志' }]));

    const novels = await novelsApi.list();
    expect(novels).toHaveLength(1);
    expect(novels[0].title).toBe('青雲志');
  });

  // 後端統一回 {"error": "..."}，這個訊息必須原封不動傳到 UI。
  it('surfaces the backend error message', async () => {
    mockFetch(jsonResponse(400, { error: '章節內容為空，請先輸入一些文字再使用 AI 助手。' }));

    await expect(aiApi.suggest('', 'continue')).rejects.toThrowError(
      '章節內容為空，請先輸入一些文字再使用 AI 助手。',
    );
  });

  it('attaches the HTTP status to ApiError', async () => {
    mockFetch(jsonResponse(404, { error: '找不到這個章節。' }));

    const err = await chaptersApi.update(999, { title: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });

  it('falls back to raw text when the body is not JSON', async () => {
    mockFetch(new Response('502 Bad Gateway', { status: 502 }));

    const err = await novelsApi.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toContain('502 Bad Gateway');
  });

  it('truncates very long non-JSON error bodies', async () => {
    mockFetch(new Response('x'.repeat(1000), { status: 500 }));

    const err = (await novelsApi.list().catch((e) => e)) as ApiError;
    expect(err.message.length).toBeLessThanOrEqual(201);
    expect(err.message.endsWith('…')).toBe(true);
  });

  it('reports a connection failure as status 0', async () => {
    mockFetch(new TypeError('Failed to fetch'));

    const err = (await novelsApi.list().catch((e) => e)) as ApiError;
    expect(err.status).toBe(0);
    expect(err.message).toContain('無法連線到伺服器');
  });

  it('returns undefined for 204 responses instead of throwing on empty JSON', async () => {
    mockFetch(new Response(null, { status: 204 }));

    await expect(chaptersApi.delete(1)).resolves.toBeUndefined();
  });

  it('sends the AI context alongside content and type', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { suggestion: '續寫' }));

    await aiApi.suggest('<p>內容</p>', 'dialogue', {
      characters: ['林清越（主角）：冷靜'],
      world: ['青雲城（location）：山中古城'],
      novel_title: '青雲志',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      content: '<p>內容</p>',
      type: 'dialogue',
      characters: ['林清越（主角）：冷靜'],
      world: ['青雲城（location）：山中古城'],
      novel_title: '青雲志',
    });
  });
});
