import { axiosInstance } from './axiosInstance';

export async function getSpaces() {
  const response = await axiosInstance.get('/spaces');
  return response.data;
}
