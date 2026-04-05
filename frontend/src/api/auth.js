import { axiosInstance, setStoredAccessToken } from './axiosInstance';

export async function signup(payload) {
  const response = await axiosInstance.post('/auth/signup', payload);
  return response.data;
}

export async function login(payload) {
  const response = await axiosInstance.post('/auth/login', payload);
  const result = response.data;
  const accessToken = result?.data?.accessToken;

  if (accessToken) {
    setStoredAccessToken(accessToken);
  }

  return result;
}

export async function getMe() {
  const response = await axiosInstance.get('/auth/me');
  return response.data;
}
