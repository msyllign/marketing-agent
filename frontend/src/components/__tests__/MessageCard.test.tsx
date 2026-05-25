import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageCard } from '../MessageCard';
import { GeneratedMessage } from '../../types';

describe('MessageCard Component', () => {
  const mockMessage: GeneratedMessage = {
    personaName: 'John Doe',
    persona: {
      name: 'John Doe',
      age: '28',
      profession: 'Software Engineer',
      interests: 'Tech',
    },
    message: 'Hey John, check out our new tech platform!',
    approved: false,
  };

  const mockOnRefine = jest.fn();
  const mockOnApprove = jest.fn();
  const mockOnDiscard = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders message card with persona information', () => {
    render(
      <MessageCard
        message={mockMessage}
        onRefine={mockOnRefine}
        onApprove={mockOnApprove}
        onDiscard={mockOnDiscard}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(mockMessage.message)).toBeInTheDocument();
  });

  test('calls onRefine when Refine button is clicked', () => {
    render(
      <MessageCard
        message={mockMessage}
        onRefine={mockOnRefine}
        onApprove={mockOnApprove}
        onDiscard={mockOnDiscard}
      />
    );

    const refineButton = screen.getByText('✏️ Refine');
    fireEvent.click(refineButton);

    expect(mockOnRefine).toHaveBeenCalledWith(mockMessage);
  });

  test('calls onApprove when Approve button is clicked', () => {
    render(
      <MessageCard
        message={mockMessage}
        onRefine={mockOnRefine}
        onApprove={mockOnApprove}
        onDiscard={mockOnDiscard}
      />
    );

    const approveButton = screen.getByText('✓ Approve');
    fireEvent.click(approveButton);

    expect(mockOnApprove).toHaveBeenCalledWith(mockMessage.message, undefined);
  });

  test('calls onDiscard when Discard button is clicked', () => {
    render(
      <MessageCard
        message={mockMessage}
        onRefine={mockOnRefine}
        onApprove={mockOnApprove}
        onDiscard={mockOnDiscard}
      />
    );

    const discardButton = screen.getByText('🗑 Discard');
    fireEvent.click(discardButton);

    expect(mockOnDiscard).toHaveBeenCalledWith(mockMessage);
  });

  test('disables approve button when message is already approved', () => {
    const approvedMessage = { ...mockMessage, approved: true };

    render(
      <MessageCard
        message={approvedMessage}
        onRefine={mockOnRefine}
        onApprove={mockOnApprove}
        onDiscard={mockOnDiscard}
      />
    );

    const approveButton = screen.getByText('✓ Approved');
    expect(approveButton).toBeDisabled();
  });
});
