import axios from "axios";
import { safeStorage } from "./utils/safeStorage.ts";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:3001",
  //baseURL: "http://localhost:3001",
});

api.interceptors.request.use(
  (config) => {
    const token = safeStorage.get("token");

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default api;
