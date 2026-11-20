import { test, expect, type Page } from '@playwright/test';

const liveFirebaseTestsEnabled = Boolean(
  process.env.E2E_BASE_URL && process.env.E2E_FIREBASE_TEST_ADMIN && process.env.E2E_FIREBASE_TEST_PASSWORD,
);

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Name created by the admin').fill(process.env.E2E_FIREBASE_TEST_ADMIN!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_FIREBASE_TEST_PASSWORD!);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL(/\/dashboard/);
}

test('admin can create staff and staff logs in to assigned branch', async ({ page }) => {
  test.skip(!liveFirebaseTestsEnabled, 'Requires a dedicated Firebase/Netlify staging site and E2E credentials.');
  const staffNumber = `E2E-${Date.now()}`;
  const staffName = `E2E Staff ${Date.now()}`;

  await loginAsAdmin(page);

  await page.click('a[href="/staff"]');
  await page.waitForSelector('text=Staff Management');
  await page.click('button:has-text("+ Add Staff")');

  await page.fill('input[placeholder="Name"]', staffName);
  await page.fill('input[placeholder="Staff number (for receipts) e.g. STF001"]', staffNumber);
  await page.fill('input[placeholder="Password"]', 'staffpass123');
  await page.click('button:has-text("Create account")');

  await expect(page.locator(`text=${staffName}`)).toBeVisible();

  await page.click('button:has-text("Logout")');
  await page.waitForURL(/\/login/);

  await page.getByLabel('Name created by the admin').fill(staffName);
  await page.fill('input[placeholder="Password"]', 'staffpass123');
  await page.click('button:has-text("Sign in")');

  await expect(page).toHaveURL(/\/pos/);
  await expect(page.locator('.workspace-branch')).toContainText('Main Branch');
  await expect(page.locator('.sidebar-user')).toContainText(staffName);
});

test('admin provisions three branches, imports branch stock, and staff routing stays scoped', async ({ page }) => {
  test.skip(!liveFirebaseTestsEnabled, 'Requires a dedicated Firebase/Netlify staging site and E2E credentials.');
  const suffix = Date.now();
  const branches = [`North ${suffix}`, `East ${suffix}`, `West ${suffix}`];
  const staff = branches.map((branchName, index) => ({
    branchName,
    name: `Branch Staff ${index + 1} ${suffix}`,
    number: `BR-${suffix}-${index + 1}`,
    quantity: [10, 26, 15][index],
  }));

  await loginAsAdmin(page);

  await page.goto('/branches');
  for (const branchName of branches) {
    await page.click('button:has-text("+ Add Branch")');
    await page.fill('input[placeholder="e.g. Downtown Branch"]', branchName);
    await page.fill('input[placeholder="Street address or area"]', `${branchName} address`);
    await page.fill('input[placeholder="e.g. Central, East, North"]', 'Demo Region');
    await page.getByRole('button', { name: 'Add Branch', exact: true }).click();
    await expect(page.locator('.branch-title', { hasText: branchName })).toBeVisible();
  }

  await page.goto('/staff');
  for (const person of staff) {
    await page.click('button:has-text("+ Add Staff")');
    await page.fill('input[placeholder="Name"]', person.name);
    await page.fill('input[placeholder="Staff number (for receipts) e.g. STF001"]', person.number);
    await page.fill('input[placeholder="Password"]', 'staffpass123');
    await page.locator('select.input').nth(1).selectOption({ label: person.branchName });
    await page.click('button:has-text("Create account")');
    await expect(page.getByText(person.name, { exact: true })).toBeVisible();
  }

  await page.goto('/bulk-import');
  for (const person of staff) {
    await page.getByRole('button', { name: person.branchName, exact: true }).click();
    const csv = `Product Name,Category,Price (Le),Cost (Le),Stock Quantity,Barcode,Active (true/false)\nDemo ${person.branchName},General,100,60,${person.quantity},${suffix}${person.quantity},true`;
    await page.locator('input[type="file"]').setInputFiles({
      name: `demo-${person.quantity}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.click('button:has-text("Fill & Upload")');
    await expect(page.getByText('Import Successful')).toBeVisible();
    await expect(page.locator('text=Import Successful').locator('..').getByText('1 products', { exact: false })).toBeVisible();
    await expect.poll(async () => page.evaluate(({ productName, quantity }) => {
      const stored = JSON.parse(localStorage.getItem('jann-pos-store') || '{}');
      return Boolean(stored.state?.products?.some((product: { name: string; stock: Record<string, number> }) =>
        product.name === productName && Object.values(product.stock).includes(quantity)));
    }, { productName: `Demo ${person.branchName}`, quantity: person.quantity })).toBe(true);
  }

  const adminRoutes = [
    '/dashboard', '/pos', '/operations', '/products', '/inventory-mgmt', '/categories',
    '/branches', '/staff', '/admin-control', '/leaderboard', '/transactions', '/eod',
    '/customers', '/expenses', '/reports', '/returns', '/asset-checkout',
    '/branch-sales-report', '/branch-transactions', '/analytics', '/ai-analytics',
    '/bulk-import', '/staff-bulk-import', '/fraud-detection',
    '/settings', '/receipt-settings', '/my-permissions', '/clear-records',
  ];
  for (const route of adminRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replace('/', '\\/')}$`));
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  }

  for (const person of staff) {
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL(/\/login/);
    await page.getByLabel('Name created by the admin').fill(person.name);
    await page.fill('input[placeholder="Password"]', 'staffpass123');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/\/pos/);
    await expect(page.locator('.workspace-branch')).toContainText(person.branchName);
    await expect(page.locator('.sidebar-user')).toContainText(person.name);

    await page.goto('/branches');
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL(/\/login/);
  }
});

test('customer online order auto-prices branch products, supports multiple items, quantity math, and notes', async ({ page }) => {
  const suffix = Date.now();
  const branchId = `b-${suffix}`;
  const branchName = `Customer Branch ${suffix}`;

  await page.addInitScript(({ branchIdValue, branchNameValue }) => {
    localStorage.setItem('jann-pos-store', JSON.stringify({
      state: {
        branches: [{
        id: branchIdValue,
        name: branchNameValue,
        location: 'Customer Town',
        region: 'Demo',
        phone: '+2320000000',
        active: true,
        openingHours: '08:00',
        closingHours: '18:00',
        allowExtendedHours: false,
      }],
        products: [
        {
          id: 'prod-rice',
          name: 'Rice',
          category: 'Groceries',
          price: 30,
          cost: 18,
          stock: { [branchIdValue]: 50 },
          branchId: branchIdValue,
          active: true,
          barcode: 'RICE-001',
        },
        {
          id: 'prod-bread',
          name: 'Bread',
          category: 'Bakery',
          price: 12,
          cost: 7,
          stock: { [branchIdValue]: 20 },
          branchId: branchIdValue,
          active: true,
          barcode: 'BREAD-001',
        },
        ],
        currentUser: null,
        isAuthenticated: false,
        selectedBranch: branchIdValue,
        mobileOrders: [],
        cart: [],
        users: [],
      },
      version: 0,
    }));
  }, { branchIdValue: branchId, branchNameValue: branchName });

  await page.goto(`/order?branch=${encodeURIComponent(branchId)}`);
  await expect(page.getByText('Customer ordering')).toBeVisible();
  await page.fill('input[placeholder="Customer name"]', 'Alice Buyer');
  await page.fill('input[placeholder="Phone number"]', '0777000000');
  await page.getByRole('combobox', { name: 'Product name' }).first().selectOption('prod-rice');
  await page.getByPlaceholder('Quantity').first().fill('3');
  await expect(page.getByText('Le 90.00', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByRole('combobox', { name: 'Product name' }).nth(1).selectOption('prod-bread');
  await page.getByPlaceholder('Quantity').nth(1).fill('2');
  await expect(page.getByText('Le 24.00', { exact: true })).toBeVisible();

  await page.fill('textarea[placeholder="Optional short note"]', 'Please pack carefully');
  await expect(page.locator('text=Total: Le 114.00')).toBeVisible();

  await page.getByRole('button', { name: 'Send order' }).dblclick();
  await expect(page.getByText('Order sent to the store')).toBeVisible();

  await page.evaluate((branchIdValue) => {
    const raw = JSON.parse(localStorage.getItem('jann-pos-store') || '{"state":{}}');
    const order = raw.state.mobileOrders[raw.state.mobileOrders.length - 1];
    if (!order) throw new Error('No order stored');
    if (order.branchId !== branchIdValue) throw new Error('Wrong branch');
    if (order.note !== 'Please pack carefully') throw new Error('Note missing');
    if (Number(order.total.toFixed(2)) !== 114) throw new Error(`Wrong total: ${order.total}`);
    if (order.items.length !== 2) throw new Error(`Unexpected item count: ${order.items.length}`);
    if (raw.state.mobileOrders.filter((item: { total: number }) => item.total === 114).length !== 1) throw new Error('Duplicate order was recorded');
  }, branchId);
});

test('customer order form shows all branches with addresses and staff can see ordered product names', async ({ page }) => {
  test.skip(!liveFirebaseTestsEnabled, 'Staff order visibility requires a dedicated Firebase/Netlify staging site.');
  const suffix = Date.now();
  const branchA = { id: `branch-a-${suffix}`, name: 'Central Market', location: 'Freetown Main Road', region: 'Western', phone: '+2320000001', active: true, openingHours: '08:00', closingHours: '18:00', allowExtendedHours: false };
  const branchB = { id: `branch-b-${suffix}`, name: 'Hill View', location: 'Regent Road', region: 'Western', phone: '+2320000002', active: true, openingHours: '09:00', closingHours: '19:00', allowExtendedHours: false };

  await page.goto('/login');
  await page.evaluate(({ a, b }) => {
    const state = JSON.parse(localStorage.getItem('jann-pos-store') || '{"state":{}}').state || {};
    const next = {
      ...state,
      branches: [a, b],
      products: [{
        id: 'prod-order-name-check',
        name: 'Rice',
        category: 'Groceries',
        price: 25,
        cost: 14,
        stock: { [a.id]: 40, [b.id]: 35 },
        branchId: a.id,
        active: true,
        barcode: 'RICE-ADDRESS-TEST',
      }],
      currentUser: null,
      isAuthenticated: false,
      selectedBranch: a.id,
      mobileOrders: [],
      cart: [],
      users: state.users || [],
    };
    localStorage.setItem('jann-pos-store', JSON.stringify({ state: next, version: 0 }));
    localStorage.setItem('jann-pos-authenticated', 'false');
    localStorage.setItem('jann-pos-auth-user', JSON.stringify(null));
  }, { a: branchA, b: branchB });

  await page.goto('/order');
  await expect(page.getByRole('combobox', { name: 'Pickup branch' })).toBeVisible();
  await expect(page.getByText('Central Market', { exact: true })).toBeVisible();
  await expect(page.getByText('Freetown Main Road', { exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: /Hill View — Regent Road/ })).toBeAttached();

  await page.fill('input[placeholder="Customer name"]', 'Branch Customer');
  await page.fill('input[placeholder="Phone number"]', '0777777777');
  await page.getByRole('combobox', { name: 'Product name' }).first().selectOption({ label: 'Rice — Le 25.00 — 40 in stock' });
  await page.getByPlaceholder('Quantity').first().fill('2');
  await page.getByRole('button', { name: 'Send order' }).click();
  await expect(page.getByText('Order sent to the store')).toBeVisible();

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('jann-pos-store') || '{"state":{}}');
    const order = raw.state.mobileOrders[raw.state.mobileOrders.length - 1];
    if (!order) throw new Error('No order stored');
    if (!order.items.some((item) => item.name === 'Rice')) throw new Error('Ordered product name missing from stored order');
  });

  await loginAsAdmin(page);
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Mobile orders' }).click();
  await page.getByText('Rice', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
});
