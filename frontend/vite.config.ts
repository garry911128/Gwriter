/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        // Quill 需要真實瀏覽器的 Range / Selection，由 E2E 覆蓋
        'src/components/NovelEditor/editor/RichTextEditor.tsx',
      ],
      // TS-08：門檻設在目前實測值稍下方，作為防退步的棘輪。
      // 掉下來時要補測試，不是調低門檻。
      thresholds: { statements: 68, branches: 80, lines: 68 },
    },
  },
});
