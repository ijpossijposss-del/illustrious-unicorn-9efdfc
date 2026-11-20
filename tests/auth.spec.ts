import { test, expect } from '@playwright/test';

test('legacy local credentials cannot sign in', async ({ page }) => {
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword**', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
  }));

  await page.goto('/login');
  await page.getByLabel('Name created by the admin').fill('admin');
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

test('admin setup explains when the Netlify function has not been deployed', async ({ page }) => {
  await page.route('**/.netlify/functions/bootstrap-admin', (route) => route.fulfill({
    status: 404,
    contentType: 'text/html',
    body: '<!doctype html><title>Not found</title>',
  }));

  await page.goto('/login');
  await page.getByLabel('Name created by the admin').fill('Admin');
  await page.getByPlaceholder('Password').fill('ExamplePassword123!');
  await page.getByRole('button', { name: 'Set up initial admin' }).click();

  await expect(page.getByText(/Admin setup is not deployed/)).toBeVisible();
});
