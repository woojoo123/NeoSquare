import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function getMyMentorApplication() {
  const response = await axiosInstance.get('/mentor-applications/me');
  return unwrapApiResponse(response);
}

export async function submitMentorApplication(payload) {
  const response = await axiosInstance.post('/mentor-applications', payload);
  return unwrapApiResponse(response);
}

export async function getPendingMentorApplications() {
  const response = await axiosInstance.get('/mentor-applications/pending');
  return unwrapApiResponse(response);
}

export async function approveMentorApplication(mentorApplicationId, payload = {}) {
  const response = await axiosInstance.patch(
    `/mentor-applications/${mentorApplicationId}/approve`,
    payload
  );
  return unwrapApiResponse(response);
}

export async function rejectMentorApplication(mentorApplicationId, payload = {}) {
  const response = await axiosInstance.patch(
    `/mentor-applications/${mentorApplicationId}/reject`,
    payload
  );
  return unwrapApiResponse(response);
}
