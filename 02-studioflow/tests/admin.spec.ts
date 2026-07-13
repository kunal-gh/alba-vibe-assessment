import { test, expect } from "@playwright/test";

test.describe("Admin Privileges and Dashboard", () => {
  test("unauthenticated users are redirected from dashboard to login", async ({ page }) => {
    // Attempt to navigate to dashboard
    await page.goto("/admin/dashboard");
    
    // Should be redirected to the login page (or NextAuth default signin if not custom configured, our app uses /admin/login)
    await expect(page).toHaveURL(/.*\/admin\/login.*/);
    
    // Assert login prompt is visible
    await expect(page.locator("text=Sign in to your account")).toBeVisible();
  });

  test("valid credentials grant access to dashboard capabilities", async ({ page }) => {
    await page.goto("/admin/login");
    
    // Fill credentials
    // Note: In an actual CI environment, these should be drawn from process.env instead of hardcoding
    await page.fill("input[name='username']", "admin");
    await page.fill("input[type='password']", "hardikstudio2024");
    
    // Submit
    await page.click("button[type='submit']");
    
    // Should navigate successfully
    await expect(page).toHaveURL("/admin/dashboard");
    
    // Dashboard elements should be visible
    await expect(page.locator("text=Upload New Photograph")).toBeVisible();
    await expect(page.locator("text=Image Configuration")).toBeVisible();
  });
});