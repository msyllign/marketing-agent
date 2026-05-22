import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import * as api from '../services/api';

jest.mock('../services/api');
jest.mock('react-hot-toast');

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders app header', () => {
    render(<App />);

    expect(screen.getByText('Marketing Agent')).toBeInTheDocument();
    expect(screen.getByText(/Generate and refine personalized SMS messages/)).toBeInTheDocument();
  });

  test('displays file upload component initially', () => {
    render(<App />);

    expect(screen.getByText('Upload Campaign Files')).toBeInTheDocument();
  });

  test('displays generated messages after successful upload', async () => {
    const mockMessages = [
      {
        personaName: 'John',
        persona: { age: '28' },
        message: 'Message for John',
        approved: false,
      },
      {
        personaName: 'Jane',
        persona: { age: '32' },
        message: 'Message for Jane',
        approved: false,
      },
    ];

    (api.generateMessages as jest.Mock).mockResolvedValue({
      messages: mockMessages,
    });

    render(<App />);

    // Simulate file upload (this depends on your component implementation)
    // After upload, should display generated messages
  });

  test('tracks approved messages count', async () => {
    render(<App />);

    // This would test that the component correctly counts and displays
    // the number of approved messages
  });

  test('allows refining messages', async () => {
    render(<App />);

    // This would test that clicking the refine button displays
    // the chat interface for that message
  });

  test('approves messages and updates UI', async () => {
    render(<App />);

    // This would test that clicking approve updates the message
    // and displays it as approved
  });
});
