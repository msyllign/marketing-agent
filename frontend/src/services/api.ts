import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

export async function uploadFiles(smsTemplate: File, personasFile: File) {
  const formData = new FormData();
  formData.append('smsTemplate', smsTemplate);
  formData.append('personasFile', personasFile);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function generateMessages(campaignId: string, smsTemplateFile: string, personasFile: string) {
  const response = await api.post('/generate', {
    campaignId,
    smsTemplateFile,
    personasFile,
  });
  return response.data;
}

export async function refineMessage(message: string, feedback: string) {
  const response = await api.post('/chat/refine', {
    message,
    feedback,
  });
  return response.data;
}

export async function approveMessage(campaignId: string, personaName: string, message: string) {
  const response = await api.post('/approval/approve', {
    campaignId,
    personaName,
    message,
  });
  return response.data;
}

export async function exportApprovedMessages(campaignId: string) {
  const response = await api.get(`/approval/export/${campaignId}`);
  return response.data;
}
