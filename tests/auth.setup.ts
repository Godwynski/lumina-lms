import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  // Step 1: Navigate to the login page
  await page.goto('/auth/login');
  
  // Step 2: Click the 'Admin Demo' button for instant authentication
  await page.getByRole('button', { name: 'Admin Demo' }).click();

  // Step 3: Wait for the URL to change to /protected
  await page.waitForURL('**/protected', { timeout: 30000 });

  // Step 4: Verify the Operations Dashboard is present as a baseline check
  await expect(page.getByText(/Operations Dashboard/i)).toBeVisible({ timeout: 15000 });

  // Step 4: Save logged-in state to storage
  await page.context().storageState({ path: authFile });
});
