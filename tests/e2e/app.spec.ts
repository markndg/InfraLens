import { test, expect } from '@playwright/test';

test('architecture governance walkthrough', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'InfraLens' })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.app-shell > header').getByText(/Architecture Governance ·/)).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Architecture Governance' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText('Governance status')).toBeVisible();
  await expect(page.getByText('Review as persona')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start review as/i })).toBeVisible();

  await page.getByRole('button', { name: 'Open decision graph' }).click();
  await expect(page.getByRole('tab', { name: 'decision' })).toBeVisible();
  await expect(page.getByText('Legend')).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'Governance', exact: true }).click();
  await page.getByRole('option', { name: /Enterprise Architect/i }).click();
  await page.getByRole('button', { name: /Start review as Enterprise Architect/i }).click();
  await expect(page.getByText(/Stage 1 of/i)).toBeVisible();
  await expect(page.getByText(/enterprise persona/i)).toBeVisible();
  await expect(page.getByText('What is being reviewed?')).toBeVisible();
});

