import { expect, Page } from '@playwright/test';
import * as fs from 'fs';

export interface TestStep {
  action: 'waitForSelector' | 'click' | 'fill' | 'assertVisible' | 'assertTextContains' | 'assertTextEquals' | 'screenshot' | 'waitForTimeout' | 'hover' | 'pressKey';
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
      throw error;
    }
  }
}
