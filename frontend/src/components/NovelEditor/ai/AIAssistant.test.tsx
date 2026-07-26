import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistant from './AIAssistant';
import { ApiError, aiApi } from '../../../api/api';

function renderAssistant(overrides: Partial<Parameters<typeof AIAssistant>[0]> = {}) {
  const props = {
    isDarkMode: true,
    content: '<p>從前有座山</p>',
    onApplySuggestion: vi.fn(),
    onSuggestTitle: vi.fn(),
    ...overrides,
  };
  render(<AIAssistant {...props} />);
  return props;
}

describe('AIAssistant', () => {
  it('renders the suggestion returned by the backend', async () => {
    vi.spyOn(aiApi, 'suggest').mockResolvedValue({ suggestion: '山上有座廟。' });

    renderAssistant();
    await userEvent.click(screen.getByRole('button', { name: /續寫/ }));

    expect(await screen.findByText('山上有座廟。')).toBeInTheDocument();
  });

  // 以前不管什麼錯誤都顯示同一句「無法連線至 AI 服務」，
  // 後端那句有用的 400 永遠傳不到使用者眼前。
  it('shows the specific backend error instead of the generic one', async () => {
    vi.spyOn(aiApi, 'suggest').mockRejectedValue(
      new ApiError(400, '章節內容為空，請先輸入一些文字再使用 AI 助手。'),
    );

    renderAssistant();
    await userEvent.click(screen.getByRole('button', { name: /情節建議/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('章節內容為空');
    expect(alert).not.toHaveTextContent('無法連線至 AI 服務');
  });

  it('falls back to the generic message for unknown failures', async () => {
    vi.spyOn(aiApi, 'suggest').mockRejectedValue('boom');

    renderAssistant();
    await userEvent.click(screen.getByRole('button', { name: /續寫/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('無法連線至 AI 服務');
  });

  it('blocks the request when the editor is empty', async () => {
    const spy = vi.spyOn(aiApi, 'suggest');

    renderAssistant({ content: '<p></p>   ' });
    await userEvent.click(screen.getByRole('button', { name: /續寫/ }));

    expect(spy).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('請先輸入一些章節內容');
  });

  it('splits title suggestions into selectable options', async () => {
    vi.spyOn(aiApi, 'suggest').mockResolvedValue({ suggestion: '山雨欲來\n\n風滿樓\n斷劍' });

    const props = renderAssistant();
    await userEvent.click(screen.getByRole('button', { name: /建議標題/ }));

    expect(await screen.findByRole('button', { name: '山雨欲來' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '風滿樓' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '斷劍' }));
    expect(props.onSuggestTitle).toHaveBeenCalledWith('斷劍');
  });

  it('applies the suggestion to the editor', async () => {
    vi.spyOn(aiApi, 'suggest').mockResolvedValue({ suggestion: '山上有座廟。' });

    const props = renderAssistant();
    await userEvent.click(screen.getByRole('button', { name: /續寫/ }));
    await userEvent.click(await screen.findByRole('button', { name: /採用建議/ }));

    expect(props.onApplySuggestion).toHaveBeenCalledWith('山上有座廟。');
  });

  it('forwards the character and world context to the API', async () => {
    const spy = vi.spyOn(aiApi, 'suggest').mockResolvedValue({ suggestion: '對話' });
    const context = {
      characters: ['林清越（主角）：冷靜'],
      world: ['青雲城（location）：山中古城'],
      novel_title: '青雲志',
    };

    renderAssistant({ context });
    await userEvent.click(screen.getByRole('button', { name: /設計對話/ }));

    expect(spy).toHaveBeenCalledWith('<p>從前有座山</p>', 'dialogue', context);
  });
});
