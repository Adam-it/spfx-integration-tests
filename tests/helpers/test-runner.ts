import { expect, Page } from '@playwright/test';
import * as fs from 'fs';

export interface TestStep {
  action: 'waitForSelector' | 'click' | 'fill' | 'assertVisible' | 'assertTextContains' | 'assertTextEquals' | 'screenshot' | 'waitForTimeout' | 'hover' | 'pressKey' | 'enterEditMode' | 'openPropertyPane';
  selector?: string;
  value?: string;
  text?: string;
  name?: string;
  key?: string;
  timeout?: number;
}

export interface TestDefinition {
  name: string;
  steps: TestStep[];
}

export interface TestSuite {
  tests: TestDefinition[];
}

export function loadTestDefinitions(filePath: string): TestSuite {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as TestSuite;
}

export async function executeStep(page: Page, step: TestStep): Promise<void> {
  switch (step.action) {
    case 'waitForSelector':
      await page.locator(step.selector!).waitFor({ state: 'visible', timeout: step.timeout });
      break;
    case 'click':
      await page.locator(step.selector!).click();
      break;
    case 'fill':
      await page.locator(step.selector!).fill(step.value!);
      break;
    case 'assertVisible':
      await expect(page.locator(step.selector!)).toBeVisible();
      break;
    case 'assertTextContains':
      await expect(page.locator(step.selector!)).toContainText(step.text!);
      break;
    case 'assertTextEquals':
      await expect(page.locator(step.selector!)).toHaveText(step.text!);
      break;
    case 'screenshot':
      await page.screenshot({ path: `test-results/${step.name}.png`, fullPage: true });
      break;
    case 'waitForTimeout':
      await page.waitForTimeout(step.timeout!);
      break;
    case 'hover':
      await page.locator(step.selector!).hover();
      break;
    case 'pressKey':
      await page.keyboard.press(step.key!);
      break;
    case 'enterEditMode': {
      const url = new URL(page.url());
      url.searchParams.set('Mode', 'Edit');
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });

      const editCommand = page.getByRole('menuitem', { name: 'Edit Page' }).first();
      try {
        await editCommand.waitFor({ state: 'visible', timeout: 10000 });
        await editCommand.click();
        // Confirm the transition: the "Edit Page" command disappears in edit mode.
        await editCommand.waitFor({ state: 'hidden', timeout: step.timeout ?? 30000 });
      } catch {
        // The command never appeared — assume Mode=Edit already put us in edit mode.
      }

      // Wait for the authoring canvas to be ready.
      await page
        .locator('.CanvasZone, [data-automation-id="CanvasZone"], .SPCanvas-canvas')
        .first()
        .waitFor({ state: 'visible', timeout: step.timeout ?? 30000 });
      break;
    }
    case 'openPropertyPane': {
      const webPart = page.locator(step.selector!).first();
      const paneSelector =
        "div.spPropertyPaneContainer, [data-automation-id='propertyPane'], div[class*='propertyPane']";
      const pane = page
        .locator(paneSelector)
        .or(page.getByRole('textbox', { name: 'Description' }))
        .first();
      const editButton = page
        .locator("button[aria-label='Edit web part'], button[aria-label='Edit properties']")
        .first();

      const paneVisible = async (): Promise<boolean> => {
        try {
          return await pane.isVisible();
        } catch {
          return false;
        }
      };

      // Select the web part. In page edit mode this reveals the web part toolbar.
      await webPart.click();
      await page.waitForTimeout(1000);

      // Some configurations auto-open the property pane on selection. Only click the
      // toolbar pencil when the pane is NOT already visible, otherwise a second click
      // toggles the pane closed again (which left #spPropertyPaneContainer hidden+empty).
      if (!(await paneVisible())) {
        try {
          await editButton.waitFor({ state: 'visible', timeout: 10000 });
          await editButton.click();
        } catch {
          // Toolbar pencil not found — fall through to the diagnostics below.
        }
      }

      try {
        await pane.waitFor({ state: 'visible', timeout: step.timeout ?? 15000 });
      } catch (error) {
        // Capture what is actually on the page so CI reveals the real DOM instead of
        // us guessing selectors.
        const labels = await page
          .locator('button[aria-label]')
          .evaluateAll((els) => els.map((el) => (el as HTMLElement).getAttribute('aria-label')));
        try {
          fs.writeFileSync('test-results/property-pane-diagnostics.html', await page.content(), 'utf-8');
        } catch {
          // best-effort diagnostics
        }
        throw new Error(
          `Property pane did not open. Visible button aria-labels: ${JSON.stringify(labels)}`
        );
      }
      break;
    }
    default:
      throw new Error(`Unknown action: ${(step as TestStep).action}`);
  }
}

export async function executeTest(page: Page, testDef: TestDefinition): Promise<void> {
  for (let i = 0; i < testDef.steps.length; i++) {
    const step = testDef.steps[i];
    try {
      await executeStep(page, step);
    } catch (error) {
      await page.screenshot({
        path: `test-results/${testDef.name}-failure-step-${i}.png`,
        fullPage: true,
      });
      try {
        fs.writeFileSync(`test-results/${testDef.name}-failure-step-${i}.html`, await page.content(), 'utf-8');
      } catch {
        // best-effort DOM capture
      }
      throw error;
    }
  }
}
