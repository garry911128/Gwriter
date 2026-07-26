import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChaptersList from './ChaptersList';

function makeChapter(id: number, title: string, order: number, wordCount = 0) {
  return { id, title, content: '', wordCount, lastModified: new Date(), order };
}

function renderList(overrides: Partial<Parameters<typeof ChaptersList>[0]> = {}) {
  const props = {
    chapters: [
      makeChapter(3, '第三章', 3, 300),
      makeChapter(1, '第一章', 1, 100),
      makeChapter(2, '第二章', 2, 200),
    ],
    currentChapterId: 1,
    isDarkMode: true,
    handleChapterSelect: vi.fn(),
    handleDeleteChapter: vi.fn(),
    handleAddChapter: vi.fn(),
    handleReorderChapter: vi.fn(),
    handleMoveChapter: vi.fn(),
    ...overrides,
  };
  render(<ChaptersList {...props} />);
  return props;
}

/** 建立一個最小可用的 DataTransfer 替身；jsdom 沒有實作它。 */
function dataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (format: string, data: string) => store.set(format, data),
    getData: (format: string) => store.get(format) ?? '',
  } as unknown as DataTransfer;
}

describe('ChaptersList', () => {
  it('renders chapters sorted by order regardless of array order', () => {
    renderList();

    const titles = screen.getAllByText(/第.章$/).map((el) => el.textContent);
    expect(titles).toEqual(['1. 第一章', '2. 第二章', '3. 第三章']);
  });

  it('shows each chapter word count', () => {
    renderList();
    expect(screen.getByText('100 字')).toBeInTheDocument();
    expect(screen.getByText('300 字')).toBeInTheDocument();
  });

  it('selects a chapter on click', async () => {
    const props = renderList();
    await userEvent.click(screen.getByText('2. 第二章'));
    expect(props.handleChapterSelect).toHaveBeenCalledWith(2);
  });

  // 第一章不能再往上，最後一章不能再往下 —— 邊界條件。
  it('disables 上移 on the first chapter and 下移 on the last', async () => {
    renderList({ currentChapterId: 0 });

    await userEvent.hover(screen.getByText('1. 第一章'));
    expect(screen.getByTitle('上移')).toBeDisabled();
    expect(screen.getByTitle('下移')).toBeEnabled();

    await userEvent.hover(screen.getByText('3. 第三章'));
    expect(screen.getByTitle('下移')).toBeDisabled();
  });

  it('reorders in the requested direction', async () => {
    const props = renderList({ currentChapterId: 2 });

    const row = screen.getByText('2. 第二章').closest('div.rounded-3') as HTMLElement;
    await userEvent.click(within(row).getByTitle('上移'));

    expect(props.handleReorderChapter).toHaveBeenCalledWith(2, 'up');
  });

  it('deletes only after the confirmation is accepted', async () => {
    const props = renderList();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const row = screen.getByText('1. 第一章').closest('div.rounded-3') as HTMLElement;
    await userEvent.click(within(row).getByTitle('刪除'));
    expect(props.handleDeleteChapter).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await userEvent.click(within(row).getByTitle('刪除'));
    expect(props.handleDeleteChapter).toHaveBeenCalledWith(1);
  });

  it('adds a chapter', async () => {
    const props = renderList();
    await userEvent.click(screen.getByRole('button', { name: /新增章節/ }));
    expect(props.handleAddChapter).toHaveBeenCalledOnce();
  });

  // CM-06a：拖曳排序。
  it('moves a chapter when dropped onto another position', () => {
    const props = renderList();

    const first = screen.getByLabelText('第 1 章 第一章');
    const third = screen.getByLabelText('第 3 章 第三章');
    const dt = dataTransfer();

    fireEvent.dragStart(first, { dataTransfer: dt });
    fireEvent.dragOver(third, { dataTransfer: dt });
    fireEvent.drop(third, { dataTransfer: dt });

    expect(props.handleMoveChapter).toHaveBeenCalledWith(0, 2);
  });

  it('ignores a drop onto the same position', () => {
    const props = renderList();

    const first = screen.getByLabelText('第 1 章 第一章');
    const dt = dataTransfer();

    fireEvent.dragStart(first, { dataTransfer: dt });
    fireEvent.drop(first, { dataTransfer: dt });

    expect(props.handleMoveChapter).not.toHaveBeenCalled();
  });

  // 拖曳不能是唯一的排序方式，鍵盤使用者也要有等效操作。
  it('reorders with Alt+Arrow keys', () => {
    const props = renderList();
    const second = screen.getByLabelText('第 2 章 第二章');

    fireEvent.keyDown(second, { key: 'ArrowUp', altKey: true });
    expect(props.handleReorderChapter).toHaveBeenCalledWith(2, 'up');

    fireEvent.keyDown(second, { key: 'ArrowDown', altKey: true });
    expect(props.handleReorderChapter).toHaveBeenCalledWith(2, 'down');
  });

  it('does not reorder on arrow keys without Alt', () => {
    const props = renderList();
    fireEvent.keyDown(screen.getByLabelText('第 2 章 第二章'), { key: 'ArrowUp' });
    expect(props.handleReorderChapter).not.toHaveBeenCalled();
  });
});
