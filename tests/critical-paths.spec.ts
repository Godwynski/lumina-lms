import { test, expect } from '@playwright/test';

test.describe('Admin Critical Paths', () => {
  
  test('should load the Intelligence Dashboard', async ({ page }) => {
    // Navigate to dashboard directly using shared auth state
    await page.goto('/dashboard');
    
    // Verify the dashboard title exists
    await expect(page.getByRole('heading', { name: 'Operations Dashboard' })).toBeVisible();
    
    // Check for the "Action Required" widget
    await expect(page.getByText('Action Required')).toBeVisible();
    
    // Check for catalog activity
    await expect(page.getByText('Recent Catalog Activity')).toBeVisible();
  });

  test('should search and filter books in inventory', async ({ page }) => {
    // Navigate to inventory
    await page.goto('/catalog');
    
    // Verify search input is accessible
    const searchInput = page.getByLabel('Search the catalog');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    
    // Type a known book title (existing in DB: 'The King')
    await searchInput.fill('The King');
    
    // Ensure "The King" book item appears in results
    await expect(page.getByText('The King', { exact: false }).first()).toBeVisible();
    
    // Let's check for "The Pragmatic Programmer" or just that "No books found" is NOT visible
    await expect(page.getByText('No books found')).not.toBeVisible();
  });

  test('should navigate between sections via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Click on 'Inventory' in the sidebar    // Expand groups if needed 
    // Navigate to Inventory (Library group)
    await page.getByRole('button', { name: 'Library' }).click({ force: true });
    await page.getByRole('link', { name: /Inventory/i, exact: false }).first().click({ force: true });
    
    // Check URL change
    await expect(page).toHaveURL(/.*catalog/);
    
    // Go back to dashboard via logo/brand
    await page.getByLabel('Lumina LMS Platform').first().click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

});

test.describe('Security & RBAC', () => {
  
  test('should redirect unauthenticated users to login', async ({ browser }) => {
    // Create a new context WITHOUT storageState to simulate guest
    const guestContext = await browser.newContext({ storageState: undefined });
    const guestPage = await guestContext.newPage();
    
    await guestPage.goto('/dashboard');
    
    // Should be redirected to login
    await expect(guestPage).toHaveURL(/.*login/);
    await expect(guestPage.getByText(/Sign in to your library/i)).toBeVisible({ timeout: 15000 });
    
    await guestContext.close();
  });

});
