import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function getMyMentorProfile() {
  const response = await axiosInstance.get('/mentor-management/profile');
  return unwrapApiResponse(response);
}

export async function updateMyMentorProfile(payload) {
  const response = await axiosInstance.patch('/mentor-management/profile', payload);
  return unwrapApiResponse(response);
}

export async function getMyMentorAvailability() {
  const response = await axiosInstance.get('/mentor-management/availability');
  return unwrapApiResponse(response);
}

export async function updateMyMentorAvailability(payload) {
  const response = await axiosInstance.put('/mentor-management/availability', payload);
  return unwrapApiResponse(response);
}

export async function getMyMentorCourses() {
  const response = await axiosInstance.get('/mentor-management/courses');
  return unwrapApiResponse(response);
}

export async function createMyMentorCourse(payload) {
  const response = await axiosInstance.post('/mentor-management/courses', payload);
  return unwrapApiResponse(response);
}

export async function updateMyMentorCourse(courseId, payload) {
  const response = await axiosInstance.patch(`/mentor-management/courses/${courseId}`, payload);
  return unwrapApiResponse(response);
}
