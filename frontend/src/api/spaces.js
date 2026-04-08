import { axiosInstance } from './axiosInstance';

export async function getSpaces() {
  const response = await axiosInstance.get('/spaces');
  return response.data?.data ?? response.data;
}

export async function getSpace(spaceId) {
  const response = await axiosInstance.get(`/spaces/${spaceId}`);
  return response.data?.data ?? response.data;
}
