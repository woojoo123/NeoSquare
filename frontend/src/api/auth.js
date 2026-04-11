import { axiosInstance } from './axiosInstance';

function unwrapResponse(response) {
  return response.data?.data ?? response.data;
}

export async function signup(payload) {
  const response = await axiosInstance.post('/auth/signup', payload);
  return unwrapResponse(response);
}

export async function login(payload) {
  const response = await axiosInstance.post('/auth/login', payload, {
    skipAuthRedirect: true,
    skipAuthRefresh: true,
  });
  return unwrapResponse(response);
}

export async function getMe() {
  const response = await axiosInstance.get('/auth/me');
  return unwrapResponse(response);
}

export async function logout() {
  const response = await axiosInstance.post('/auth/logout');

  return unwrapResponse(response);
}
