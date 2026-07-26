import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharactersList from './CharactersList';
import { ApiError, charactersApi, type ApiCharacter } from '../../../api/api';

// 標題列的「新增角色」與表單裡的送出按鈕同名，取後者。
function submitButton() {
  const buttons = screen.getAllByRole('button', { name: '新增角色' });
  return buttons[buttons.length - 1];
}

async function openFormAndType(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: '新增角色' }));
  await userEvent.type(screen.getByPlaceholderText('角色姓名 *'), name);
  await userEvent.click(submitButton());
}

const linQingyue: ApiCharacter = {
  id: 3,
  novel_id: 1,
  name: '林清越',
  role: '主角',
  description: '黑髮少年',
  personality: '冷靜',
  background: '劍宗棄徒',
  avatar_url: '',
};

describe('CharactersList', () => {
  it('lists characters returned by the API', async () => {
    vi.spyOn(charactersApi, 'list').mockResolvedValue([linQingyue]);

    render(<CharactersList novelId={1} isDarkMode />);

    expect(await screen.findByText('林清越')).toBeInTheDocument();
    expect(screen.getByText('主角')).toBeInTheDocument();
  });

  it('surfaces a load failure instead of silently showing an empty list', async () => {
    vi.spyOn(charactersApi, 'list').mockRejectedValue(
      new ApiError(500, '伺服器發生錯誤，請稍後再試。'),
    );

    render(<CharactersList novelId={1} isDarkMode />);

    expect(await screen.findByRole('alert')).toHaveTextContent('伺服器發生錯誤');
  });

  it('surfaces a save failure', async () => {
    vi.spyOn(charactersApi, 'list').mockResolvedValue([]);
    vi.spyOn(charactersApi, 'create').mockRejectedValue(new ApiError(400, '角色名稱不可為空。'));

    render(<CharactersList novelId={1} isDarkMode />);
    await openFormAndType('林');

    expect(await screen.findByRole('alert')).toHaveTextContent('角色名稱不可為空。');
  });

  it('appends the created character to the list', async () => {
    vi.spyOn(charactersApi, 'list').mockResolvedValue([]);
    vi.spyOn(charactersApi, 'create').mockResolvedValue(linQingyue);

    render(<CharactersList novelId={1} isDarkMode />);
    await openFormAndType('林清越');

    expect(await screen.findByText('林清越')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the character when deletion fails', async () => {
    vi.spyOn(charactersApi, 'list').mockResolvedValue([linQingyue]);
    vi.spyOn(charactersApi, 'delete').mockRejectedValue(new ApiError(404, '找不到這個角色。'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CharactersList novelId={1} isDarkMode />);

    await userEvent.click(await screen.findByText('林清越'));
    await userEvent.click(screen.getByRole('button', { name: /刪除/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('找不到這個角色。');
    expect(screen.getByText('林清越')).toBeInTheDocument();
  });

  it('shows the empty state when there are no characters', async () => {
    vi.spyOn(charactersApi, 'list').mockResolvedValue([]);

    render(<CharactersList novelId={1} isDarkMode />);

    expect(await screen.findByText(/尚無角色/)).toBeInTheDocument();
  });
});
