import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function getMyNotifications() {
  const response = await axiosInstance.get('/notifications/me');
  return unwrapApiResponse(response);
}

export async function readNotification(notificationId) {
  const response = await axiosInstance.patch(`/notifications/${notificationId}/read`);
  return unwrapApiResponse(response);
}

export async function readAllNotifications() {
  const response = await axiosInstance.patch('/notifications/read-all');
  return unwrapApiResponse(response);
}
