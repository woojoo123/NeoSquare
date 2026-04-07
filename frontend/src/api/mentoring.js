import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function createMentoringRequest(payload) {
  const response = await axiosInstance.post('/mentoring/requests', payload);
  return unwrapApiResponse(response);
}

export async function getSentMentoringRequests() {
  const response = await axiosInstance.get('/mentoring/requests/sent');
  return unwrapApiResponse(response);
}

export async function getReceivedMentoringRequests() {
  const response = await axiosInstance.get('/mentoring/requests/received');
  return unwrapApiResponse(response);
}

export async function acceptMentoringRequest(requestId) {
  const response = await axiosInstance.patch(`/mentoring/requests/${requestId}/accept`);
  return unwrapApiResponse(response);
}

export async function rejectMentoringRequest(requestId) {
  const response = await axiosInstance.patch(`/mentoring/requests/${requestId}/reject`);
  return unwrapApiResponse(response);
}

export async function getMentoringRequest(requestId) {
  const response = await axiosInstance.get(`/mentoring/requests/${requestId}`);
  return unwrapApiResponse(response);
}
