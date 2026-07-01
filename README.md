# SPFx Integration Tests

Automated integration testing for SharePoint Framework using GitHub Actions and Playwright.

## Using the GitHub Actions Workflow

1. Go to **Actions** → **SPFx Integration Test**
2. Click **Run workflow**
3. Enter the following parameters:
   - **SPFx version**: e.g., `1.23.2`
   - **SharePoint site URL**: e.g., `https://contoso.sharepoint.com/sites/test`
   - **Cleanup** (optional): Check to remove deployed artifacts after tests

The workflow will:
1. Resolve the SPFx version configuration
2. Set up Node.js
3. Deploy your SPFx solution
4. Run Playwright tests
5. Collect test results
6. Clean up deployed artifacts (optional)

## SPFx Version Configuration

The `config/spfx-versions.json` file defines configuration for each SPFx version:

```json
{
  "1.23.2": {
    "node": "22",
    "buildTool": "heft",
    "generator": "1.23.2",
    "yo": "6"
  }
}
```

## Test Definitions

Tests are defined in `tests/test-definitions.json` using a declarative format. No code changes needed to add tests!

### Test File Structure

```json
{
  "tests": [
    {
      "name": "Your test name",
      "steps": [
        { "action": "waitForSelector", "selector": "...", "timeout": 30000 },
        { "action": "click", "selector": "..." },
        { "action": "fill", "selector": "...", "value": "..." },
        { "action": "assertVisible", "selector": "..." },
        { "action": "assertTextContains", "selector": "...", "text": "..." },
        { "action": "assertTextEquals", "selector": "...", "text": "..." },
        { "action": "screenshot", "name": "screenshot-name" },
        { "action": "hover", "selector": "..." },
        { "action": "pressKey", "key": "Enter" },
        { "action": "waitForTimeout", "timeout": 1000 }
      ]
    }
  ]
}
```

## 🏗️ Architecture

### Directory Structure

```
spfx-integration-tests/
├── .github/
│   └── workflows/
│       └── spfx-integration-test.yml    # Main workflow
├── config/
│   └── spfx-versions.json               # SPFx version configurations
├── scripts/
│   ├── resolve-spfx-config.ps1         # Get version config
│   ├── integration-tests.ps1            # Deploy and setup
│   └── cleanup.ps1                      # Clean up artifacts
├── tests/
│   ├── spfx-webpart.spec.ts            # Playwright test spec
│   ├── test-definitions.json            # Test scenarios
│   ├── global-setup.ts                  # Auth setup
│   ├── playwright.config.ts             # Playwright config
│   └── helpers/
│       ├── auth.ts                      # Authentication logic
│       └── test-runner.ts               # Test execution engine
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript config
└── README.md                            # This file
```

## 📋 Test Results

After test execution, results are available in:

- **HTML Report**: `playwright-report/index.html` - Interactive test report
- **Test Results**: `test-results/` - Screenshots and videos
- **Auth Failure**: `auth-failure.png` - Screenshot if authentication fails
- **GitHub Artifacts**: Workflow results uploaded as artifacts with 30-day retention

## 🆘 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for similar problems
- Review test output and screenshots for debugging

## 📚 References

- [SharePoint Framework Documentation](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview)
- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
