import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function createStudySession(payload) {
  const response = await axiosInstance.post('/study/sessions', payload);
  return unwrapApiResponse(response);
}

export async function getMyStudySessions() {
  const response = await axiosInstance.get('/study/sessions/me');
  return unwrapApiResponse(response);
}

export async function getStudySessionsBySpace(spaceId) {
  const response = await axiosInstance.get(`/study/sessions/space/${spaceId}`);
  return unwrapApiResponse(response);
}

export async function getStudySession(studySessionId) {
  const response = await axiosInstance.get(`/study/sessions/${studySessionId}`);
  return unwrapApiResponse(response);
}

export async function joinStudySession(studySessionId) {
  const response = await axiosInstance.post(`/study/sessions/${studySessionId}/join`);
  return unwrapApiResponse(response);
}

export async function completeStudySession(studySessionId) {
  const response = await axiosInstance.patch(`/study/sessions/${studySessionId}/complete`);
  return unwrapApiResponse(response);
}
