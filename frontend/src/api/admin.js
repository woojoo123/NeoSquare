import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function getAdminDashboard() {
  const response = await axiosInstance.get('/admin/dashboard');
  return unwrapApiResponse(response);
}

export async function updateAdminMentorVisibility(mentorId, payload) {
  const response = await axiosInstance.patch(`/admin/mentors/${mentorId}/visibility`, payload);
  return unwrapApiResponse(response);
}

export async function updateAdminCourseStatus(courseId, payload) {
  const response = await axiosInstance.patch(`/admin/courses/${courseId}/status`, payload);
  return unwrapApiResponse(response);
}
