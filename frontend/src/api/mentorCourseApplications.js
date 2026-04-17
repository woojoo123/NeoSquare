import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function createMentorCourseApplication(courseId, payload = {}) {
  const response = await axiosInstance.post(`/mentor-courses/${courseId}/applications`, payload);
  return unwrapApiResponse(response);
}

export async function getMyMentorCourseApplications() {
  const response = await axiosInstance.get('/mentor-courses/applications/me');
  return unwrapApiResponse(response);
}

export async function getReceivedMentorCourseApplications() {
  const response = await axiosInstance.get('/mentor-courses/applications/received');
  return unwrapApiResponse(response);
}

export async function getMentorCourseApplicationSessionEntry(applicationId) {
  const response = await axiosInstance.get(
    `/mentor-courses/applications/${applicationId}/session-entry`
  );
  return unwrapApiResponse(response);
}

export async function approveMentorCourseApplication(applicationId, payload = {}) {
  const response = await axiosInstance.patch(
    `/mentor-courses/applications/${applicationId}/approve`,
    payload
  );
  return unwrapApiResponse(response);
}

export async function rejectMentorCourseApplication(applicationId, payload = {}) {
  const response = await axiosInstance.patch(
    `/mentor-courses/applications/${applicationId}/reject`,
    payload
  );
  return unwrapApiResponse(response);
}

export async function cancelMentorCourseApplication(applicationId) {
  const response = await axiosInstance.patch(`/mentor-courses/applications/${applicationId}/cancel`);
  return unwrapApiResponse(response);
}
