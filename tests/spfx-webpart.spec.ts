import { test } from '@playwright/test';
import path from 'path';
import { loadTestDefinitions, executeTest } from './helpers/test-runner';

const testDefinitionsPath = path.join(__dirname, 'test-definitions.json');
const testSuite = loadTestDefinitions(testDefinitionsPath);

for (const testDef of testSuite.tests) {
  test(testDef.name, async ({ page }) => {
    const pageUrl = process.env.PAGE_URL;
    if (!pageUrl) {
      throw new Error('PAGE_URL environment variable must be set');
    }
    
    // Navigate to the test page
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
    
    // Wait for SharePoint page to fully load.
    // Note: do NOT use 'networkidle' — SharePoint/SPFx pages continuously make
    // background requests, so the network never goes idle and this would time
    // out. Wait for the canvas/web part zone to be present instead.
    await page.waitForLoadState('domcontentloaded');
    await page
      .locator('.CanvasZone, [data-automation-id="CanvasZone"], .SPCanvas-canvas')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
    
    // Execute the test steps from JSON definition
    await executeTest(page, testDef);
  });
}
