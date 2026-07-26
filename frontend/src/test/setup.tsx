import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

// Quill 依賴 jsdom 沒有完整實作的 Range / getSelection API，
// 元件測試只關心周邊邏輯，這裡直接以 textarea 取代編輯器本體。
// RichTextEditor 自身的行為由 E2E 覆蓋（真實瀏覽器才測得準）。
vi.mock('../components/NovelEditor/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
