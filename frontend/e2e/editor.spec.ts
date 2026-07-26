import { test, expect, type Page } from '@playwright/test';

const EDITOR = '.ql-editor';

/**
 * 每個測試都註冊一個全新帳號。
 *
 * 這比共用固定帳號好：測試之間不會互相污染資料，
 * 而且順帶把註冊流程本身也納入每一次驗證。
 */
async function registerAndOpenEditor(page: Page, tag: string) {
  const email = `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  await page.goto('/');
  await page.getByRole('button', { name: /還沒有帳號/ }).click();
  await page.getByLabel('使用者名稱').fill('E2E 作者');
  await page.getByLabel('電子郵件').fill(email);
  await page.getByLabel('密碼').fill('e2e-password-123');
  await page.getByRole('button', { name: '建立帳號' }).click();

  // 註冊成功後直接進入編輯器
  await expect(page.getByRole('button', { name: '新增章節' })).toBeVisible({ timeout: 20_000 });
  return email;
}

async function createNovel(page: Page, title: string) {
  await page.locator('.dropdown-toggle').first().click();
  await page.locator('.dropdown-item', { hasText: '新增小說' }).click();

  await page.getByPlaceholder('小說標題 *').fill(title);
  await page.getByRole('button', { name: '建立小說' }).click();

  await expect(page.getByText('1. 第一章')).toBeVisible();
}

async function typeChapter(page: Page, text: string) {
  const editor = page.locator(EDITOR);
  await editor.click();
  await editor.fill(text);
}

test.describe('認證', () => {
  test('未登入時看到登入畫面，註冊後進入編輯器', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(EDITOR)).toHaveCount(0);

    await registerAndOpenEditor(page, 'auth');
    await expect(page.locator(EDITOR)).toBeVisible();
  });

  test('重新整理後仍保持登入', async ({ page }) => {
    await registerAndOpenEditor(page, 'session');
    await page.reload();
    await expect(page.getByRole('button', { name: '新增章節' })).toBeVisible({ timeout: 20_000 });
  });

  test('登出後回到登入畫面且無法直接取回編輯器', async ({ page }) => {
    await registerAndOpenEditor(page, 'logout');

    await page.locator('.dropdown-toggle').last().click();
    await page.getByText('登出').click();

    await expect(page.getByRole('button', { name: '登入' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible({ timeout: 20_000 });
  });

  test('錯誤的密碼顯示後端訊息', async ({ page }) => {
    const email = await registerAndOpenEditor(page, 'wrongpw');

    await page.locator('.dropdown-toggle').last().click();
    await page.getByText('登出').click();
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible();

    await page.getByLabel('電子郵件').fill(email);
    await page.getByLabel('密碼').fill('definitely-not-the-password');
    await page.getByRole('button', { name: '登入' }).click();

    await expect(page.getByRole('alert')).toContainText('電子郵件或密碼不正確');
  });
});

test.describe('GWriter 編輯器', () => {
  test('建立小說、寫作、自動存檔後重新載入內容仍在', async ({ page }) => {
    await registerAndOpenEditor(page, 'write');
    await createNovel(page, 'E2E 小說');

    await page.getByPlaceholder('為你的故事起一個精彩的標題...').fill('序章');
    await typeChapter(page, '青雲山下，少年提劍而立。');

    // 自動存檔是 3 秒 debounce
    await expect(page.getByText('已儲存')).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByRole('button', { name: '新增章節' })).toBeVisible({ timeout: 20_000 });

    await expect(page.locator(EDITOR)).toContainText('青雲山下，少年提劍而立。');
    await expect(page.getByPlaceholder('為你的故事起一個精彩的標題...')).toHaveValue('序章');
  });

  test('新增章節後可在章節清單間切換', async ({ page }) => {
    await registerAndOpenEditor(page, 'chapters');
    await createNovel(page, 'E2E 章節');

    await page.getByRole('button', { name: '新增章節' }).click();
    await expect(page.getByText('2. 第2章')).toBeVisible();

    await typeChapter(page, '第二章的內容。');
    await expect(page.getByText('已儲存')).toBeVisible({ timeout: 20_000 });

    await page.getByText('1. 第一章').click();
    await expect(page.locator(EDITOR)).not.toContainText('第二章的內容。');

    await page.getByText('2. 第2章').click();
    await expect(page.locator(EDITOR)).toContainText('第二章的內容。');
  });

  // CM-06a：鍵盤等效操作，比模擬拖曳在跨瀏覽器上穩定得多。
  test('可用 Alt+方向鍵調整章節順序', async ({ page }) => {
    await registerAndOpenEditor(page, 'reorder');
    await createNovel(page, 'E2E 排序');

    await page.getByRole('button', { name: '新增章節' }).click();
    await expect(page.getByText('2. 第2章')).toBeVisible();

    const second = page.getByLabel('第 2 章 第2章');
    await second.focus();
    await second.press('Alt+ArrowUp');

    await expect(page.getByText('1. 第2章')).toBeVisible();
    await expect(page.getByText('2. 第一章')).toBeVisible();
  });

  // OL-01
  test('大綱分頁列出章節並可跳轉', async ({ page }) => {
    await registerAndOpenEditor(page, 'outline');
    await createNovel(page, 'E2E 大綱');

    await typeChapter(page, '第一章的內容。');
    await expect(page.getByText('已儲存')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '大綱' }).click();
    await expect(page.getByText('第一章的內容。')).toBeVisible();
    await expect(page.getByText(/平均 \d+ 字／章/)).toBeVisible();
  });

  test('新增角色後出現在角色卡列表', async ({ page }) => {
    await registerAndOpenEditor(page, 'characters');
    await createNovel(page, 'E2E 角色');

    await page.getByRole('button', { name: '角色' }).click();
    await page.getByRole('button', { name: '新增角色' }).first().click();

    await page.getByPlaceholder('角色姓名 *').fill('林清越');
    await page.getByPlaceholder('角色定位（主角/反派...）').fill('主角');
    await page.getByPlaceholder('個性特點').fill('冷靜');
    await page.getByRole('button', { name: '新增角色' }).last().click();

    await expect(page.getByText('林清越')).toBeVisible();
    await expect(page.getByText('主角')).toBeVisible();

    // 展開後應看得到個性欄位 —— 這是 000002 migration 的端對端驗證
    await page.getByText('林清越').click();
    await expect(page.getByText('冷靜')).toBeVisible();
  });

  test('AI 助手在內容為空時顯示後端回的具體訊息', async ({ page }) => {
    await registerAndOpenEditor(page, 'ai-empty');
    await createNovel(page, 'E2E AI 空白');

    await page.getByRole('button', { name: '續寫' }).click();
    await expect(page.getByRole('alert')).toContainText('請先輸入一些章節內容');
  });

  test('AI 助手取得建議並可採用', async ({ page }) => {
    await registerAndOpenEditor(page, 'ai');
    await createNovel(page, 'E2E AI');
    await typeChapter(page, '從前有座山。');

    await page.getByRole('button', { name: '續寫' }).click();
    await expect(page.getByText('E2E 固定回應：山上有座廟。')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '採用建議' }).click();
    await expect(page.locator(EDITOR)).toContainText('山上有座廟');
  });

  test('手動儲存建立草稿快照，並可還原', async ({ page }) => {
    await registerAndOpenEditor(page, 'drafts');
    await createNovel(page, 'E2E 草稿');

    await typeChapter(page, '第一版內容。');
    await page.getByRole('button', { name: '儲存' }).click();
    await expect(page.getByText('已儲存')).toBeVisible({ timeout: 20_000 });

    await typeChapter(page, '第二版內容，覆蓋掉第一版。');
    await expect(page.getByText('已儲存')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '草稿' }).click();
    await expect(page.getByText('第一版內容。')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '回復' }).first().click();
    await expect(page.locator(EDITOR)).toContainText('第一版內容。');
  });

  // NM-07
  test('刪除小說後它從清單消失', async ({ page }) => {
    await registerAndOpenEditor(page, 'delete');
    await createNovel(page, 'E2E 待刪除');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.dropdown-toggle').first().click();
    await page.getByText('刪除目前小說').click();

    await page.locator('.dropdown-toggle').first().click();
    await expect(page.locator('.dropdown-item', { hasText: 'E2E 待刪除' })).toHaveCount(0);
  });

  // UB-05
  test('深色模式偏好在重新整理後保留', async ({ page }) => {
    await registerAndOpenEditor(page, 'theme');

    await page.getByRole('button', { name: '切換為淺色模式' }).click();
    await expect(page.getByRole('button', { name: '切換為深色模式' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: '切換為深色模式' })).toBeVisible({
      timeout: 20_000,
    });
  });

  // SEC-09：存進資料庫的內容已被後端消毒，預覽時前端再消毒一次。
  test('預覽不會執行章節內容中的指令碼', async ({ page }) => {
    await registerAndOpenEditor(page, 'xss');
    await createNovel(page, 'E2E XSS');

    let dialogFired = false;
    page.on('dialog', (dialog) => {
      dialogFired = true;
      void dialog.dismiss();
    });

    await typeChapter(page, '安全內容 <script>alert(1)</script>');
    await expect(page.getByText('已儲存')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: '預覽' }).click();
    const body = page.getByTestId('preview-body');
    await expect(body).toBeVisible();
    await expect(body).toContainText('安全內容');
    await expect(body.locator('script')).toHaveCount(0);
    expect(dialogFired).toBe(false);
  });
});
