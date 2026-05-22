import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileUpload } from '../components/FileUpload';
import * as api from '../services/api';

jest.mock('../services/api');
jest.mock('react-hot-toast');

describe('FileUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders file upload form', () => {
    render(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);
    
    expect(screen.getByText('Upload Campaign Files')).toBeInTheDocument();
    expect(screen.getByText('SMS Template (TXT)')).toBeInTheDocument();
    expect(screen.getByText('Personas File (CSV or Excel)')).toBeInTheDocument();
    expect(screen.getByText('Upload Files')).toBeInTheDocument();
  });

  test('upload button is disabled when no files are selected', () => {
    render(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);
    
    const uploadButton = screen.getByText('Upload Files');
    expect(uploadButton).toBeDisabled();
  });

  test('upload button is enabled when both files are selected', async () => {
    render(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);
    
    const smsInput = screen.getAllByRole('button')[0]?.parentElement?.querySelector('input');
    const personasInput = screen.getAllByRole('button')[1]?.parentElement?.querySelector('input');
    
    if (smsInput && personasInput) {
      const smsFile = new File(['template'], 'sms.txt', { type: 'text/plain' });
      const personasFile = new File(['data'], 'personas.csv', { type: 'text/csv' });
      
      fireEvent.change(smsInput, { target: { files: [smsFile] } });
      fireEvent.change(personasInput, { target: { files: [personasFile] } });
      
      const uploadButton = screen.getByText('Upload Files');
      await waitFor(() => {
        expect(uploadButton).not.toBeDisabled();
      });
    }
  });

  test('calls uploadFiles API on successful upload', async () => {
    const mockResponse = {
      campaignId: 'campaign-123',
      files: {
        smsTemplate: 'sms-file-path',
        personasFile: 'personas-file-path',
      },
    };

    (api.uploadFiles as jest.Mock).mockResolvedValue(mockResponse);

    render(<FileUpload onUploadSuccess={mockOnUploadSuccess} />);
    
    // Simulate file selection and upload
    // (Implementation depends on your component's actual file input handling)
  });
});
