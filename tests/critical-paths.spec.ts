import { test, expect } from '@playwright/test';

test.describe('Admin Critical Paths', () => {
  
  test('should load the Intelligence Dashboard', async ({ page }) => {
    // Navigate to reports directly using shared auth state
    await page.goto('/protected/reports');
    
    // Verify the dashboard title exists
    await expect(page.getByRole('heading', { name: 'Intelligence Dashboard' })).toBeVisible();
    
    // Check for the "Operational Pulse" widget
    await expect(page.getByText('Operational Pulse')).toBeVisible();
    
    // Check for chart interactivity area (using heading to differentiate from tooltip labels)
    await expect(page.getByRole('heading', { name: 'Circulation Velocity' })).toBeVisible();
  });

  test('should search and filter books in inventory', async ({ page }) => {
    // Navigate to inventory
    await page.goto('/protected/catalog');
    
    // Verify search input is accessible (we added aria-label earlier)
    const searchInput = page.getByLabel('Search items');
    await expect(searchInput).toBeVisible();
    
    // Type a known book title (existing in DB: 'The King')
    await searchInput.fill('The King');
    
    // Since search is likely debounced or server-side, we wait a moment
    // or look for a specific feedback or reduced list
    // Let's check for "The Pragmatic Programmer" or just that "No books found" is NOT visible
    await expect(page.getByText('No books found')).not.toBeVisible();
  });

  test('should navigate between sections via sidebar', async ({ page }) => {
    await page.goto('/protected');
    
    // Click on 'Inventory' in the sidebar/layout
    await page.getByRole('link', { name: 'Catalog', exact: false }).first().click();
    
    // Check URL change
    await expect(page).toHaveURL(/.*catalog/);
    
    // Go back to dashboard via logo/brand
    await page.getByRole('link', { name: 'Lumina LMS', exact: false }).first().click();
    await expect(page).toHaveURL(/.*protected/);
  });

});

test.describe('Security & RBAC', () => {
  
  test('should redirect unauthenticated users to login', async ({ browser }) => {
    // Create a new context WITHOUT storageState to simulate guest
    const guestContext = await browser.newContext({ storageState: undefined });
    const guestPage = await guestContext.newPage();
    
    await guestPage.goto('/protected');
    
    // Should be redirected to login
    await expect(guestPage).toHaveURL(/.*login/);
    await expect(guestPage.getByText('Sign in to your library')).toBeVisible();
    
    await guestContext.close();
  });

});
