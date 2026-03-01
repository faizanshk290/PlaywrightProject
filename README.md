# Cypress POM Framework with TypeScript

A simple and scalable Cypress framework using the Page Object Model (POM) design pattern with TypeScript.

## Project Structure

```
cypress/
├── e2e/                      # E2E test files
│   └── login.cy.ts          # Login test examples
├── pages/                    # Page Object classes
│   ├── base-page/           # Base page folder
│   │   └── BasePage.ts      # Base page with common methods
│   └── login-page/          # Login page folder
│       └── LoginPage.ts     # Login page object
├── support/                  # Support files
│   ├── commands.ts          # Custom commands
│   └── e2e.ts              # E2E support file
└── fixtures/                # Test data files

cypress.config.ts            # Cypress configuration
tsconfig.json               # TypeScript configuration
package.json                # Dependencies and scripts
```

## Features

- **TypeScript Support**: Full TypeScript configuration for type safety
- **Page Object Model**: Organized page objects with reusable methods
- **Base Page Pattern**: Common methods inherited by all page objects
- **Path Aliases**: Clean imports using @ aliases
- **Custom Commands**: Reusable Cypress commands
- **Example Tests**: Complete login functionality test suite

## Installation

1. Install dependencies:
```bash
npm install
```

## Running Tests

- Open Cypress Test Runner:
```bash
npm run cy:open
```

- Run all tests headless:
```bash
npm test
```

- Run tests headed:
```bash
npm run test:headed
```

- Run specific test file:
```bash
npm run test:login
```

- Run in specific browser:
```bash
npm run cy:run:chrome
npm run cy:run:firefox
npm run cy:run:edge
```

## Creating New Page Objects

1. Create a new folder under `cypress/pages/` (e.g., `dashboard-page/`)
2. Create a TypeScript file extending `BasePage`:

```typescript
import { BasePage } from '../base-page/BasePage';

export class DashboardPage extends BasePage {
  private readonly selectors = {
    welcomeMessage: '#welcome',
    logoutButton: '#logout'
  };

  verifyDashboardLoaded(): void {
    this.isVisible(this.selectors.welcomeMessage);
  }

  logout(): void {
    this.click(this.selectors.logoutButton);
  }
}
```

3. Use in your tests:

```typescript
import { DashboardPage } from '../pages/dashboard-page/DashboardPage';

describe('Dashboard Tests', () => {
  let dashboardPage: DashboardPage;

  beforeEach(() => {
    dashboardPage = new DashboardPage();
    dashboardPage.visit('/dashboard');
  });

  it('should display dashboard', () => {
    dashboardPage.verifyDashboardLoaded();
  });
});
```

## BasePage Methods

The `BasePage` class provides common methods:

- `visit(url)` - Navigate to URL
- `click(selector)` - Click element
- `type(selector, text)` - Type into input
- `getElement(selector)` - Get element
- `isVisible(selector)` - Verify element visibility
- `containsText(selector, text)` - Verify text content
- `waitForElement(selector, timeout)` - Wait for element
- `getByTestId(testId)` - Get by data-testid
- `verifyUrlContains(urlFragment)` - Verify URL
- And more...

## Configuration

Update `cypress.config.ts` to customize:
- Base URL
- Viewport size
- Timeouts
- Video/screenshot settings

## Best Practices

1. Keep selectors private in page objects
2. Create descriptive method names
3. Use TypeScript types for better IntelliSense
4. Organize tests by functionality
5. Use custom commands for common workflows
6. Keep page objects focused and single-purpose

## Contributing

Feel free to extend this framework with additional page objects and tests!
