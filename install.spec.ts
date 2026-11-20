import { test, expect } from '@playwright/test';

test('first-time visitor can install the app from the install dialog', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('jann-pos-install-dismissed');
  });

  await page.goto('/login');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted'; platform: string }>;
    };
    event.prompt = async () => {
      (window as Window & { installPromptCalled?: boolean }).installPromptCalled = true;
    };
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(event);
  });
  const installDialog = page.getByRole('dialog', { name: 'Install Super POS' });
  await expect(installDialog).toBeVisible({ timeout: 15_000 });
  await installDialog.getByRole('button', { name: 'Install app' }).click();
  await expect(installDialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { installPromptCalled?: boolean }).installPromptCalled
  ))).toBe(true);
  await expect.poll(() => page.evaluate(() => (
    window.localStorage.getItem('jann-pos-install-dismissed')
  ))).toBe('true');
});
