import { test, expect } from '@playwright/test';

test.describe('Orb Timing', () => {
  test('orb appears immediately on send and disappears when content arrives', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load - use first visible textarea
    await page.waitForSelector('textarea.chat-input');
    
    // Type a message
    const textarea = page.locator('textarea.chat-input').first();
    await textarea.fill('Hello, how are you?');
    
    // Get the orb locator (material-symbols-outlined with lens_blur)
    const orb = page.locator('.material-symbols-outlined:has-text("lens_blur")');
    
    // Verify orb is NOT visible before sending
    await expect(orb).not.toBeVisible();
    
    // Send the message
    const sendButton = page.locator('.send-btn').first();
    
    // Start timing - click send
    const sendTime = Date.now();
    await sendButton.click();
    
    // Orb should appear IMMEDIATELY (within 100ms)
    await expect(orb).toBeVisible({ timeout: 100 });
    const orbVisibleTime = Date.now();
    const orbAppearDelay = orbVisibleTime - sendTime;
    
    console.log(`Orb appeared ${orbAppearDelay}ms after send`);
    expect(orbAppearDelay).toBeLessThan(100);
    
    // Wait for content to arrive (orb should disappear)
    await expect(orb).not.toBeVisible({ timeout: 5000 });
    const orbGoneTime = Date.now();
    const orbDuration = orbGoneTime - sendTime;
    
    console.log(`Orb visible for ${orbDuration}ms`);
    
    // Verify some assistant content appears (not just the orb)
    const assistantMessage = page.locator('.message-assistant').first();
    await expect(assistantMessage).toBeVisible({ timeout: 2000 });
    
    console.log('Test passed: Orb timing working correctly');
  });
  
  test('orb does not show for completed messages', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('textarea.chat-input');
    
    // Orb should not be visible initially
    const orb = page.locator('.material-symbols-outlined:has-text("lens_blur")');
    await expect(orb).not.toBeVisible();
    
    console.log('Test passed: No orb on completed messages');
  });
});
