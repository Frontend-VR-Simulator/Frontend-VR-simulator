import axios from "axios";
import { API_BASE_URL } from "../config/api";

export function createApi(token, onUnauthorized) {
  const client = axios.create({ baseURL: API_BASE_URL, headers: { Authorization: `Bearer ${token}` } });
  client.interceptors.response.use((response) => response, (error) => {
    if (error.response?.status === 401) onUnauthorized();
    return Promise.reject(error);
  });
  return client;
}

export function errorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}
