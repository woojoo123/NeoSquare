import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function createReservation(payload) {
  const response = await axiosInstance.post('/mentoring/reservations', payload);
  return unwrapApiResponse(response);
}

export async function getMyReservations() {
  const response = await axiosInstance.get('/mentoring/reservations/me');
  return unwrapApiResponse(response);
}

export async function getReceivedReservations() {
  const response = await axiosInstance.get('/mentoring/reservations/received');
  return unwrapApiResponse(response);
}

export async function getReservation(reservationId) {
  const response = await axiosInstance.get(`/mentoring/reservations/${reservationId}`);
  return unwrapApiResponse(response);
}

export async function acceptReservation(reservationId) {
  const response = await axiosInstance.patch(`/mentoring/reservations/${reservationId}/accept`);
  return unwrapApiResponse(response);
}

export async function rejectReservation(reservationId) {
  const response = await axiosInstance.patch(`/mentoring/reservations/${reservationId}/reject`);
  return unwrapApiResponse(response);
}

export async function cancelReservation(reservationId) {
  const response = await axiosInstance.patch(`/mentoring/reservations/${reservationId}/cancel`);
  return unwrapApiResponse(response);
}

export async function completeReservation(reservationId) {
  const response = await axiosInstance.patch(`/mentoring/reservations/${reservationId}/complete`);
  return unwrapApiResponse(response);
}
