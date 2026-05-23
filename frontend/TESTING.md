# Testing Guide for Marketing Agent Frontend

## Setup Instructions

### 1. Install Testing Dependencies
```bash
cd frontend
npm install
```

The testing dependencies have been added to `package.json`:
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - Jest matchers for DOM
- `@testing-library/user-event` - User interaction simulation
- `@types/jest` - TypeScript types for Jest

### 2. Run Tests

**Run all tests in watch mode:**
```bash
npm test
```

**Run tests once with coverage:**
```bash
npm run test:coverage
```

**Run specific test file:**
```bash
npm test MessageCard.test.tsx
```

## Test Files to Create

Create the following test files in the `frontend/src` directory:

### 1. `components/__tests__/FileUpload.test.tsx`
Tests the file upload component:
- Renders upload form correctly
- Validates file selection
- Handles upload success/failure
- Displays file names after selection

### 2. `components/__tests__/MessageCard.test.tsx`
Tests the message card component:
- Displays persona information
- Renders message content
- Handles refine button click
- Handles approve button click
- Disables approve when already approved

### 3. `components/__tests__/ChatInterface.test.tsx`
Tests the chat interface component:
- Renders chat UI
- Sends messages
- Displays chat history
- Calls refine API
- Shows loading state

### 4. `__tests__/App.test.tsx`
Integration tests for the main App:
- Renders initial state
- Handles file upload flow
- Displays generated messages
- Handles message approval
- Tracks approval count

### 5. `services/__tests__/api.test.ts`
Tests API service calls:
- Tests uploadFiles function
- Tests generateMessages function
- Tests refineMessage function
- Handles API errors

## Example Test Structure

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { YourComponent } from '../YourComponent';

describe('YourComponent', () => {
  test('renders correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  test('handles user interaction', async () => {
    render(<YourComponent />);
    const button = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument();
    });
  });
});
```

## Manual Testing Checklist

### 1. File Upload Flow
- [ ] Open application
- [ ] Check "Upload Campaign Files" header is visible
- [ ] Select SMS template file (.txt)
- [ ] Verify filename appears below input
- [ ] Select personas file (.csv or .xlsx)
- [ ] Verify filename appears below input
- [ ] Click "Upload Files" button
- [ ] Verify loading state appears
- [ ] Verify success message appears
- [ ] Verify messages are generated and displayed

### 2. Message Display
- [ ] Check all messages are displayed with persona names
- [ ] Verify persona details are shown
- [ ] Check message text is visible
- [ ] Verify approval count shows 0/N initially

### 3. Message Refinement
- [ ] Click "Refine" button on any message
- [ ] Verify chat interface appears in right panel
- [ ] Type refinement instructions
- [ ] Click "Send" button
- [ ] Verify loading state shows
- [ ] Verify refined message appears
- [ ] Click "Approve Refined" button
- [ ] Verify message is approved

### 4. Message Approval
- [ ] Click "Approve" on a message
- [ ] Verify button changes to "Approved" and disables
- [ ] Check approval count increments

### 5. Responsive Design
- [ ] Test on desktop (1920px width)
- [ ] Test on tablet (768px width)
- [ ] Test on mobile (375px width)
- [ ] Verify layout adjusts properly

## Debugging Tips

### Enable Debug Mode
```bash
npm test -- --verbose
```

### View Component in Test
```typescript
import { render, screen } from '@testing-library/react';
import { debug } from '@testing-library/react';

test('debug example', () => {
  const { debug } = render(<YourComponent />);
  debug(); // Prints the DOM tree
});
```

### Check API Calls
Mock the API and inspect calls:
```typescript
jest.mock('../services/api');
// Then check mock calls:
expect(api.uploadFiles).toHaveBeenCalledWith(file1, file2);
```

## Common Issues & Solutions

### Issue: "Cannot find module" errors
**Solution:** Ensure all imports use correct paths and file extensions

### Issue: "window is not defined"
**Solution:** Tests run in jsdom by default, should work. If persists, check test environment config

### Issue: Tests timeout
**Solution:** Increase timeout in jest.config.js or use `jest.setTimeout(10000)` in test

### Issue: Async tests not completing
**Solution:** Use `async/await` and `waitFor()` properly:
```typescript
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 3000 });
```

## Next Steps

1. Create the test files based on the examples above
2. Run `npm test` to execute tests
3. Check coverage with `npm run test:coverage`
4. Fix any failing tests
5. Perform manual testing using the checklist
6. Deploy to staging for integration testing
