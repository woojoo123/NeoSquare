import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function getMentorCourseDetail(courseId) {
  const response = await axiosInstance.get(`/mentor-courses/${courseId}`);
  return unwrapApiResponse(response);
}
