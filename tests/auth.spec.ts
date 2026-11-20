import { test, expect } from '@playwright/test';
import { isOwnerAdminEmail } from '../src/auth/credentials';

test('only the configured Firebase owner email receives owner admin identity', () => {
  expect(isOwnerAdminEmail('ijpossijposss@gmail.com')).toBe(true);
  expect(isOwnerAdminEmail(' IJPOSSIJPOSSS@GMAIL.COM ')).toBe(true);
  expect(isOwnerAdminEmail('admin')).toBe(false);
  expect(isOwnerAdminEmail('another@example.com')).toBe(false);
  expect(isOwnerAdminEmail(null)).toBe(false);
});

test('legacy local credentials cannot sign in', async ({ page }) => {
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword**', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
  }));

  await page.goto('/login');
  await page.getByLabel('Email or name created by the admin').fill('admin');
  await page.getByPlaceholder('Password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Incorrect name or password')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  const isAuthenticated = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
    return stored.state?.isAuthenticated === true;
  });
  expect(isAuthenticated).toBe(false);
});

test('Firebase owner email is used directly for sign-in', async ({ page }) => {
  let submittedEmail = '';
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword**', async (route) => {
    submittedEmail = route.request().postDataJSON().email;
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('Email or name created by the admin').fill('ijpossijposss@gmail.com');
  await page.getByPlaceholder('Password').fill('NotARealPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Incorrect name or password')).toBeVisible();
  expect(submittedEmail).toBe('ijpossijposss@gmail.com');
});

test('login no longer exposes initial-admin setup', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Set up initial admin' })).toHaveCount(0);
});
