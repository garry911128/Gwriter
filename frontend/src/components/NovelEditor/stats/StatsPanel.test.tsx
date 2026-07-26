import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StatsPanel from './StatsPanel';

describe('StatsPanel', () => {
  const chapters = [{ wordCount: 1200 }, { wordCount: 800 }, { wordCount: 0 }];

  it('sums word counts across chapters', () => {
    render(
      <StatsPanel
        chapters={chapters}
        dailyGoal={1000}
        wordCount={0}
        isDarkMode
        setDailyGoal={vi.fn()}
      />,
    );
    expect(screen.getByText('2000')).toBeInTheDocument();
  });

  it('counts chapters including empty ones', () => {
    render(
      <StatsPanel
        chapters={chapters}
        dailyGoal={1000}
        wordCount={0}
        isDarkMode
        setDailyGoal={vi.fn()}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('estimates reading time at 250 words per minute, rounded up', () => {
    render(
      <StatsPanel
        chapters={chapters}
        dailyGoal={1000}
        wordCount={0}
        isDarkMode
        setDailyGoal={vi.fn()}
      />,
    );
    expect(screen.getByText('8分鐘')).toBeInTheDocument();
  });

  it('renders an empty project without NaN', () => {
    render(
      <StatsPanel chapters={[]} dailyGoal={1000} wordCount={0} isDarkMode setDailyGoal={vi.fn()} />,
    );
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.getByText('0分鐘')).toBeInTheDocument();
  });

  // 標籤是「本章字數」而不是「今日進度」：這個數字算的是目前章節的字數，
  // 切換章節就歸零，跟「今天寫了多少」無關。
  it('reports progress against the goal', () => {
    render(
      <StatsPanel
        chapters={chapters}
        dailyGoal={1000}
        wordCount={250}
        isDarkMode
        setDailyGoal={vi.fn()}
      />,
    );
    expect(screen.getByText(/250\/1000 字 \(25%\)/)).toBeInTheDocument();
  });

  it('updates the goal', () => {
    const setDailyGoal = vi.fn();
    render(
      <StatsPanel
        chapters={chapters}
        dailyGoal={1000}
        wordCount={0}
        isDarkMode
        setDailyGoal={setDailyGoal}
      />,
    );

    // 受控元件，value 由 props 決定，所以直接觸發一次 change 而不是逐字輸入。
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2500' } });

    expect(setDailyGoal).toHaveBeenLastCalledWith(2500);
  });
});
