import React, { useState } from 'react';
import { uploadFiles } from '../services/api';
import toast from 'react-hot-toast';

interface FileUploadProps {
  onUploadSuccess: (campaignId: string, smsFile: string, personasFile: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [smsTemplate, setSmsTemplate] = useState<File | null>(null);
  const [personasFile, setPersonasFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!smsTemplate || !personasFile) {
      toast.error('Please select both files');
      return;
    }

    setLoading(true);
    try {
      const result = await uploadFiles(smsTemplate, personasFile);
      toast.success('Files uploaded successfully!');
      onUploadSuccess(result.campaignId, result.files.smsTemplate, result.files.personasFile);
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Upload Campaign Files</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">SMS / Viber Template (TXT or DOCX)</label>
          <input
            type="file"
            accept=".txt,.docx"
            onChange={(e) => setSmsTemplate(e.target.files?.[0] || null)}
            className="w-full border rounded px-3 py-2"
          />
          {smsTemplate && <p className="text-sm text-gray-600 mt-1">✓ {smsTemplate.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Personas File (CSV or Excel)</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setPersonasFile(e.target.files?.[0] || null)}
            className="w-full border rounded px-3 py-2"
          />
          {personasFile && <p className="text-sm text-gray-600 mt-1">✓ {personasFile.name}</p>}
        </div>

        <button
          onClick={handleUpload}
          disabled={loading || !smsTemplate || !personasFile}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? 'Uploading...' : 'Upload Files'}
        </button>
      </div>
    </div>
  );
};
