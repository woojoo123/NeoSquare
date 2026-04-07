import { axiosInstance } from './axiosInstance';

export async function createMentoringRequest(payload) {
  const response = await axiosInstance.post('/mentoring/requests', payload);
  return response.data;
}

export async function getSentMentoringRequests() {
  const response = await axiosInstance.get('/mentoring/requests/sent');
  return response.data;
}

export async function getReceivedMentoringRequests() {
  const response = await axiosInstance.get('/mentoring/requests/received');
  return response.data;
}

export async function acceptMentoringRequest(requestId) {
  const response = await axiosInstance.patch(`/mentoring/requests/${requestId}/accept`);
  return response.data;
}

export async function rejectMentoringRequest(requestId) {
  const response = await axiosInstance.patch(`/mentoring/requests/${requestId}/reject`);
  return response.data;
}
