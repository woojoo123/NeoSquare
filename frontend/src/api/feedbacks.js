import { axiosInstance } from './axiosInstance';

function unwrapApiResponse(response) {
  return response.data?.data ?? response.data;
}

export async function createSessionFeedback(payload) {
  const isReservationFeedback =
    payload?.sessionSource === 'reservation' || payload?.reservationId != null;
  const endpoint = isReservationFeedback
    ? '/mentoring/reservation-feedbacks'
    : '/mentoring/feedbacks';

  const body = isReservationFeedback
    ? {
        reservationId: payload.reservationId,
        rating: payload.rating,
        summary: payload.summary,
        feedback: payload.feedback,
      }
    : payload;

  const response = await axiosInstance.post(endpoint, body);
  return unwrapApiResponse(response);
}

export async function getMySessionFeedbacks() {
  const [requestResponse, reservationResponse] = await Promise.all([
    axiosInstance.get('/mentoring/feedbacks/me'),
    axiosInstance.get('/mentoring/reservation-feedbacks/me'),
  ]);

  return [
    ...unwrapApiResponse(requestResponse),
    ...unwrapApiResponse(reservationResponse),
  ];
}

export async function getSessionFeedback(feedbackId) {
  const response = await axiosInstance.get(`/mentoring/feedbacks/${feedbackId}`);
  return unwrapApiResponse(response);
}

export async function getSessionFeedbackByRequestId(requestId) {
  const response = await axiosInstance.get(`/mentoring/feedbacks/by-request/${requestId}`);
  return unwrapApiResponse(response);
}

export async function getSessionFeedbackByReservationId(reservationId) {
  const response = await axiosInstance.get(
    `/mentoring/reservation-feedbacks/by-reservation/${reservationId}`
  );
  return unwrapApiResponse(response);
}
