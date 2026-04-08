import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function createSessionFeedback(payload) {
  const response = await axiosInstance.post('/mentoring/feedbacks', payload);
  return unwrapApiResponse(response);
}

export async function getMySessionFeedbacks() {
  const response = await axiosInstance.get('/mentoring/feedbacks/me');
  return unwrapApiResponse(response);
}

export async function getSessionFeedback(feedbackId) {
  const response = await axiosInstance.get(`/mentoring/feedbacks/${feedbackId}`);
  return unwrapApiResponse(response);
}

export async function getSessionFeedbackByRequestId(requestId) {
  const response = await axiosInstance.get(`/mentoring/feedbacks/by-request/${requestId}`);
  return unwrapApiResponse(response);
}
