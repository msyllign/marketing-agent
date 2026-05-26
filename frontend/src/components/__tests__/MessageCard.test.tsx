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
  const mockOnUnapprove = jest.fn();
  const mockOnDiscard = jest.fn();

  const defaultProps = {
    onRefine: mockOnRefine,
    onApprove: mockOnApprove,
    onUnapprove: mockOnUnapprove,
    onDiscard: mockOnDiscard,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders message card with persona information', () => {
    render(<MessageCard message={mockMessage} {...defaultProps} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(mockMessage.message)).toBeInTheDocument();
  });

  test('calls onRefine when Refine button is clicked', () => {
    render(<MessageCard message={mockMessage} {...defaultProps} />);

    const refineButton = screen.getByText('✏️ Refine');
    fireEvent.click(refineButton);

    expect(mockOnRefine).toHaveBeenCalledWith(mockMessage);
  });

  test('calls onApprove when Approve button is clicked', () => {
    render(<MessageCard message={mockMessage} {...defaultProps} />);

    const approveButton = screen.getByText('✓ Approve');
    fireEvent.click(approveButton);

    expect(mockOnApprove).toHaveBeenCalledWith(mockMessage.message, undefined);
  });

  test('calls onDiscard when Discard button is clicked', () => {
    render(<MessageCard message={mockMessage} {...defaultProps} />);

    const discardButton = screen.getByText('🗑 Discard');
    fireEvent.click(discardButton);

    expect(mockOnDiscard).toHaveBeenCalledWith(mockMessage);
  });

  test('shows Unapprove and Refine & Re-approve buttons when message is approved', () => {
    const approvedMessage = { ...mockMessage, approved: true };

    render(<MessageCard message={approvedMessage} {...defaultProps} />);

    expect(screen.getByText('↩ Unapprove')).toBeInTheDocument();
    expect(screen.getByText('✏️ Refine & Re-approve')).toBeInTheDocument();
    // Discard and plain Approve should not be shown
    expect(screen.queryByText('🗑 Discard')).not.toBeInTheDocument();
    expect(screen.queryByText('✓ Approve')).not.toBeInTheDocument();
  });

  test('calls onUnapprove when Unapprove button is clicked', () => {
    const approvedMessage = { ...mockMessage, approved: true };

    render(<MessageCard message={approvedMessage} {...defaultProps} />);

    const unapproveButton = screen.getByText('↩ Unapprove');
    fireEvent.click(unapproveButton);

    expect(mockOnUnapprove).toHaveBeenCalledWith(approvedMessage);
  });
});
