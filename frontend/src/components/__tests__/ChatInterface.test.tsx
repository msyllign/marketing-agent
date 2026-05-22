import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatInterface } from '../components/ChatInterface';
import * as api from '../services/api';

jest.mock('../services/api');
jest.mock('react-hot-toast');

describe('ChatInterface Component', () => {
  const mockMessage = 'Original message text';
  const mockOnRefinedMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders chat interface', () => {
    render(
      <ChatInterface
        message={mockMessage}
        onRefinedMessage={mockOnRefinedMessage}
      />
    );

    expect(screen.getByPlaceholderText('Describe changes...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  test('displays initial assistant message with original message', () => {
    render(
      <ChatInterface
        message={mockMessage}
        onRefinedMessage={mockOnRefinedMessage}
      />
    );

    expect(screen.getByText(/Here's the message to refine/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockMessage))).toBeInTheDocument();
  });

  test('sends message and displays user input', () => {
    render(
      <ChatInterface
        message={mockMessage}
        onRefinedMessage={mockOnRefinedMessage}
      />
    );

    const input = screen.getByPlaceholderText('Describe changes...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Make it shorter' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('Make it shorter')).toBeInTheDocument();
  });

  test('disables send button while loading', async () => {
    (api.refineMessage as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <ChatInterface
        message={mockMessage}
        onRefinedMessage={mockOnRefinedMessage}
      />
    );

    const input = screen.getByPlaceholderText('Describe changes...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Make it shorter' } });
    fireEvent.click(sendButton);

    expect(sendButton).toBeDisabled();
  });

  test('calls refineMessage API and displays response', async () => {
    const refinedResponse = 'Refined message text';
    (api.refineMessage as jest.Mock).mockResolvedValue({
      refinedMessage: refinedResponse,
    });

    render(
      <ChatInterface
        message={mockMessage}
        onRefinedMessage={mockOnRefinedMessage}
      />
    );

    const input = screen.getByPlaceholderText('Describe changes...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Make it shorter' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.refineMessage).toHaveBeenCalledWith(mockMessage, 'Make it shorter');
    });

    await waitFor(() => {
      expect(mockOnRefinedMessage).toHaveBeenCalledWith(refinedResponse);
    });
  });

  test('clears input after sending', async () => {
    (api.refineMessage as jest.Mock).mockResolvedValue({
      refinedMessage: 'Refined message',
    });

    render(
      <ChatInterface
        message={mockMessage}
        onRefinedMessage={mockOnRefinedMessage}
      />
    );

    const input = screen.getByPlaceholderText('Describe changes...') as HTMLInputElement;
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Make it shorter' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});
