# Testing Guide

This project uses [Vitest](https://vitest.dev/) for testing, which provides fast unit testing with excellent TypeScript and Vue 3 support.

## Running Tests

```bash
# Run tests in watch mode (default)
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui

# Run tests with coverage report
yarn test:coverage
```

## Test Structure

Tests are organized in the `tests/` directory mirroring the source structure:

```
tests/
├── setup.ts              # Test setup and global mocks
├── utils/                # Test utilities and helpers
│   ├── test-helpers.ts   # Mock data factories
│   └── email.test.ts     # Utility function tests
├── components/           # Vue component tests
│   └── EmailCard.test.ts
└── email/                # Email module tests
    └── thread-utils.test.ts
```

## Writing Tests

### Unit Tests for Utilities

```typescript
import { describe, it, expect } from 'vitest'
import { yourFunction } from '@/utils/your-module'

describe('yourFunction', () => {
  it('should do something', () => {
    expect(yourFunction(input)).toBe(expected)
  })
})
```

### Vue Component Tests

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import YourComponent from '@/components/YourComponent.vue'

describe('YourComponent', () => {
  it('should render correctly', () => {
    const wrapper = mount(YourComponent, {
      props: { /* props */ }
    })
    expect(wrapper.text()).toContain('expected text')
  })
})
```

### Mocking Electron APIs

Electron APIs are automatically mocked in `tests/setup.ts`. To mock IPC calls:

```typescript
import { vi } from 'vitest'

// Mock window.electron.invoke
const mockInvoke = vi.fn()
window.electron.invoke = mockInvoke

// In your test
mockInvoke.mockResolvedValue({ success: true })
```

### Mocking Database

For tests that need database access:

```typescript
import { vi } from 'vitest'

vi.mock('../../database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn((query: string) => ({
      all: vi.fn(() => []),
      get: vi.fn(() => null),
      run: vi.fn(() => ({ changes: 0 }))
    }))
  }))
}))
```

## Test Helpers

Use the test helpers in `tests/utils/test-helpers.ts`:

```typescript
import { createMockEmail, createMockAccount } from '../utils/test-helpers'

const email = createMockEmail({ subject: 'Custom Subject' })
const account = createMockAccount({ email: 'custom@example.com' })
```

## Coverage

Coverage reports are generated in the `coverage/` directory. The coverage configuration excludes:
- Node modules
- Build outputs
- Type definitions
- Config files
- Electron main process files

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how it does it
2. **Use descriptive test names** - Test names should clearly describe what is being tested
3. **Keep tests isolated** - Each test should be independent and not rely on other tests
4. **Mock external dependencies** - Mock database, network calls, and Electron APIs
5. **Use test helpers** - Reuse mock data factories and utilities
6. **Test edge cases** - Include tests for error conditions and boundary cases

## Example Test Files

- `tests/utils/email.test.ts` - Utility function tests
- `tests/components/EmailCard.test.ts` - Vue component tests
- `tests/email/thread-utils.test.ts` - Module tests with mocks

