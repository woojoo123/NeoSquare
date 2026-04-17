import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function getMentors() {
  const response = await axiosInstance.get('/users/mentors');
  return unwrapApiResponse(response);
}
