import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { outlineSummary } from '../../../utils/outline';
import OutlinePanel from './OutlinePanel';

function chapter(id: number, title: string, order: number, content: string, wordCount: number) {
  return { id, title, order, content, wordCount };
}

const chapters = [
  chapter(3, '第三章', 3, '<p>山雨欲來風滿樓。</p>', 9),
  chapter(1, '第一章', 1, '<p>青雲山下，少年提劍而立。</p>', 12),
  chapter(2, '第二章', 2, '', 0),
];

describe('outlineSummary', () => {
  it('strips markup and collapses whitespace', () => {
    expect(outlineSummary('<p>青雲山下，</p>\n  <p>少年提劍。</p>')).toBe('青雲山下， 少年提劍。');
  });

  it('marks empty chapters explicitly', () => {
    expect(outlineSummary('')).toBe('（尚未撰寫）');
    expect(outlineSummary('<p><br></p>')).toBe('（尚未撰寫）');
  });

  it('truncates long content with an ellipsis', () => {
    const summary = outlineSummary('<p>' + '字'.repeat(200) + '</p>');
    expect(summary.endsWith('…')).toBe(true);
    expect(Array.from(summary)).toHaveLength(81); // 80 個字 + 刪節號
  });
});

describe('OutlinePanel', () => {
  it('lists chapters in order with their word counts', () => {
    render(<OutlinePanel chapters={chapters} currentChapterId={1} isDarkMode onSelect={vi.fn()} />);

    const titles = screen.getAllByText(/^\d\. 第.章$/).map((el) => el.textContent);
    expect(titles).toEqual(['1. 第一章', '2. 第二章', '3. 第三章']);
    expect(screen.getByText('12 字')).toBeInTheDocument();
  });

  it('shows a summary of each chapter', () => {
    render(<OutlinePanel chapters={chapters} currentChapterId={1} isDarkMode onSelect={vi.fn()} />);

    expect(screen.getByText('青雲山下，少年提劍而立。')).toBeInTheDocument();
    expect(screen.getByText('（尚未撰寫）')).toBeInTheDocument();
  });

  it('reports the average chapter length', () => {
    render(<OutlinePanel chapters={chapters} currentChapterId={1} isDarkMode onSelect={vi.fn()} />);
    expect(screen.getByText('平均 7 字／章')).toBeInTheDocument();
  });

  it('jumps to the chapter that was clicked', async () => {
    const onSelect = vi.fn();
    render(
      <OutlinePanel chapters={chapters} currentChapterId={1} isDarkMode onSelect={onSelect} />,
    );

    await userEvent.click(screen.getByText('3. 第三章'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('marks the current chapter for assistive technology', () => {
    render(<OutlinePanel chapters={chapters} currentChapterId={2} isDarkMode onSelect={vi.fn()} />);

    const current = screen.getByText('2. 第二章').closest('button');
    expect(current).toHaveAttribute('aria-current', 'true');
  });

  it('renders an empty state without dividing by zero', () => {
    render(<OutlinePanel chapters={[]} currentChapterId={null} isDarkMode onSelect={vi.fn()} />);

    expect(screen.getByText('尚無章節')).toBeInTheDocument();
    expect(screen.getByText('平均 0 字／章')).toBeInTheDocument();
  });
});
