import { axiosInstance } from './axiosInstance';

export async function createMentoringRequest(payload) {
  const response = await axiosInstance.post('/mentoring/requests', payload);
  return response.data;
}

export async function getSentMentoringRequests() {
  const response = await axiosInstance.get('/mentoring/requests/sent');
  return response.data;
}
