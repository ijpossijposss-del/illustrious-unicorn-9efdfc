import { test, expect } from '@playwright/test';

const emulatorReady = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST
  && process.env.FIREBASE_DATABASE_EMULATOR_HOST
  && process.env.BOOTSTRAP_ADMIN_USERNAME
  && process.env.BOOTSTRAP_ADMIN_PASSWORD,
);

test('@firebase-emulator admin creates branch, product, sale and staff; staff permissions work on another device', async ({ browser }) => {
  test.setTimeout(120_000);
  test.skip(!emulatorReady, 'Run scripts/test-firebase-emulator.ps1 to start isolated Firebase emulators.');

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  adminPage.on('pageerror', (error) => console.error('Firebase emulator test page error:', error));
  adminPage.on('console', (message) => {
    if (message.type() === 'error') console.error('Firebase emulator test browser console:', message.text());
  });
  const branchName = `Demo Branch ${Date.now()}`;
  const productName = `Demo Product ${Date.now()}`;
  const staffName = `Demo Staff ${Date.now()}`;
  const staffPassword = 'DemoStaff123!';

  await adminPage.goto('/login');
  await expect(adminPage.getByRole('heading', { name: 'Super POS Investment Login' })).toBeVisible();
  await adminPage.getByLabel('Name created by the admin').fill(process.env.BOOTSTRAP_ADMIN_USERNAME!);
  await adminPage.getByPlaceholder('Password').fill(process.env.BOOTSTRAP_ADMIN_PASSWORD!);
  await adminPage.getByRole('button', { name: 'Set up initial admin' }).click();
  await expect(adminPage).toHaveURL(/\/dashboard$/);

  await adminPage.goto('/branches');
  await adminPage.getByRole('button', { name: '+ Add Branch' }).click();
  await adminPage.getByPlaceholder('e.g. Downtown Branch').fill(branchName);
  await adminPage.getByPlaceholder('Street address or area').fill('Demo Test Road');
  await adminPage.getByPlaceholder('e.g. Central, East, North').fill('Demo Region');
  await adminPage.getByRole('button', { name: 'Add Branch', exact: true }).click();
  await expect(adminPage.locator('.branch-title', { hasText: branchName })).toBeVisible();
  await adminPage.getByLabel('Select branch').selectOption({ label: branchName });

  await adminPage.goto('/products');
  await expect(adminPage.getByText('Sample Item', { exact: true })).toHaveCount(0);
  await adminPage.getByRole('button', { name: '+ Add Product' }).click();
  await adminPage.getByPlaceholder('Enter product name').fill(productName);
  await adminPage.getByLabel('Selling price').fill('12');
  await adminPage.getByLabel('Cost price').fill('7');
  await adminPage.getByLabel('Stock quantity').fill('8');
  await adminPage.getByRole('button', { name: 'Save Product' }).click();
  await expect(adminPage.getByText(productName, { exact: true })).toBeVisible();

  await adminPage.goto('/pos');
  await adminPage.locator('.pos-product-grid .product-card', { hasText: productName }).click();
  await adminPage.getByRole('button', { name: 'Charge', exact: true }).click();
  await adminPage.getByRole('button', { name: /Cash/ }).dblclick();
  await expect(adminPage.getByText('Payment recorded')).toBeVisible();
  await expect.poll(() => adminPage.evaluate((name) => {
    const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
    return stored.state?.sales?.find((sale: { items: Array<{ name: string }> }) => sale.items.some((item) => item.name === name)) || null;
  }, productName)).toMatchObject({ total: 12, profit: 5 });

  await adminPage.goto('/staff');
  await adminPage.getByRole('button', { name: '+ Add Staff' }).click();
  await adminPage.getByPlaceholder('Name').fill(staffName);
  await adminPage.getByPlaceholder('Staff number (for receipts) e.g. STF001').fill(`DEMO-${Date.now()}`);
  await adminPage.locator('.staff-form-modal select.input').nth(1).selectOption({ label: branchName });
  await adminPage.getByPlaceholder('Password (minimum 6 characters)').fill(staffPassword);
  await adminPage.getByRole('button', { name: 'Create account' }).click();
  await expect(adminPage.getByText(staffName, { exact: true })).toBeVisible();

  await adminPage.goto('/my-permissions');
  await adminPage.locator('.section-actions select').nth(0).selectOption({ label: staffName });
  await expect(adminPage.getByLabel('view-dashboard')).toBeChecked();
  await adminPage.getByLabel('view-products').first().uncheck();

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  staffPage.on('pageerror', (error) => console.error('Firebase emulator staff page error:', error));
  staffPage.on('console', (message) => {
    if (message.type() === 'error') console.error('Firebase emulator staff browser console:', message.text());
  });
  await staffPage.goto('/login');
  await staffPage.getByLabel('Name created by the admin').fill(staffName);
  await staffPage.getByPlaceholder('Password').fill(staffPassword);
  await staffPage.getByRole('button', { name: 'Sign in' }).click();
  await expect(staffPage).toHaveURL(/\/pos$/);
  await expect(staffPage.locator('.workspace-header')).toContainText(branchName);
  await expect(staffPage.locator('.sidebar-user')).toContainText(staffName);

  await staffPage.goto('/products');
  await expect(staffPage.getByText('Access denied')).toBeVisible();

  await adminPage.getByLabel('view-products').first().check();
  await adminPage.getByLabel('add-products').check();
  await adminPage.getByLabel('edit-products').check();
  await staffPage.goto('/products');
  await expect(staffPage).toHaveURL(/\/products$/);
  await expect(staffPage.getByText(productName, { exact: true })).toBeVisible();
  await expect(staffPage.getByText('Sample Item', { exact: true })).toHaveCount(0);

  const staffProductName = `Staff Product ${Date.now()}`;
  await staffPage.getByRole('button', { name: '+ Add Product' }).click();
  await staffPage.getByPlaceholder('Enter product name').fill(staffProductName);
  await staffPage.getByLabel('Selling price').fill('15');
  await staffPage.getByLabel('Cost price').fill('8');
  await staffPage.getByLabel('Stock quantity').fill('5');
  await staffPage.getByRole('button', { name: 'Save Product' }).click();
  await expect(staffPage.getByText(staffProductName, { exact: true })).toBeVisible();

  await staffPage.goto('/pos');
  await staffPage.locator('.pos-product-grid .product-card', { hasText: staffProductName }).click();
  await staffPage.getByRole('button', { name: 'Charge', exact: true }).click();
  await staffPage.getByRole('button', { name: /Cash/ }).click();
  await expect(staffPage.getByText('Payment recorded')).toBeVisible();
  await expect.poll(() => staffPage.evaluate((name) => {
    const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
    return stored.state?.sales?.some((sale: { items: Array<{ name: string }> }) => sale.items.some((item) => item.name === name));
  }, staffProductName)).toBe(true);

  await staffPage.goto('/products');
  await adminPage.getByLabel('view-products').first().uncheck();
  const staffProfile = await adminPage.evaluate((name) => {
    const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
    return stored.state?.users?.find((user: { name: string }) => user.name === name);
  }, staffName);
  await expect.poll(() => staffPage.evaluate(({ id, branchId }) => {
    const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
    return stored.state?.staffPermissions?.[id]?.[branchId] || [];
  }, staffProfile)).not.toContain('view-products');
  console.log('Staff page after permission revocation:', staffPage.url(), (await staffPage.locator('body').innerText()).slice(0, 800));
  await expect(staffPage.getByText('Access denied')).toBeVisible();
  await adminPage.getByLabel('view-products').first().check();
  await expect(staffPage.getByRole('heading', { name: 'Products' })).toBeVisible();

  await adminPage.goto('/staff');
  const staffCard = adminPage.locator('.card').filter({ hasText: staffName });
  await staffCard.getByRole('button', { name: /Edit/ }).click();
  await adminPage.locator('.staff-form-modal select.input').nth(1).selectOption({ label: 'Main Branch' });
  await adminPage.getByRole('button', { name: 'Save Changes' }).click();
  await expect(staffPage.locator('.workspace-header')).toContainText('Main Branch');
  await expect.poll(() => staffPage.evaluate((name) => {
    const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
    const user = stored.state?.users?.find((item: { name: string }) => item.name === name);
    return user ? stored.state?.staffPermissions?.[user.id]?.[user.branchId] || [] : [];
  }, staffName)).toContain('use-pos');
  await staffPage.goto('/products');
  await expect(staffPage.getByText(productName, { exact: true })).toHaveCount(0);

  await staffPage.goto('/branches');
  await expect(staffPage.getByText('Access denied')).toBeVisible();

  await staffPage.getByRole('button', { name: 'Logout' }).click();
  await expect(staffPage).toHaveURL(/\/login$/);

  await adminPage.goto('/clear-records');
  await adminPage.locator('select.input').selectOption({ label: branchName });
  await adminPage.getByRole('button', { name: /Clear Sales Records Only/ }).click();
  await adminPage.getByRole('button', { name: 'Delete Records' }).click();
  await adminPage.getByRole('button', { name: 'Confirm Delete' }).click();
  await expect(adminPage.getByText('Sales records deleted and synced')).toBeVisible();
  await adminPage.reload();
  await expect.poll(() => adminPage.evaluate(({ productName, staffProductName }) => {
    const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
    return stored.state?.sales?.some((sale: { items: Array<{ name: string }> }) =>
      sale.items.some((item) => item.name === productName || item.name === staffProductName));
  }, { productName, staffProductName })).toBe(false);

  await staffContext.close();
  await adminContext.close();
});
