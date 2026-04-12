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
    
    // Wait for SharePoint page to fully load
    await page.waitForLoadState('networkidle');
    
    // Execute the test steps from JSON definition
    await executeTest(page, testDef);
  });
}
