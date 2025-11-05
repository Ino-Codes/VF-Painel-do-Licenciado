import { useCallback } from "react";
import api from "../api";
import { AxiosRequestConfig } from "axios";

export const useApi = () => {
  const get = useCallback(async (url: string, config?: AxiosRequestConfig) => {
    return api.get(url, config);
  }, []);

  const post = useCallback(
    async (url: string, data?: any, config?: AxiosRequestConfig) => {
      return api.post(url, data, config);
    },
    []
  );

  const put = useCallback(
    async (url: string, data?: any, config?: AxiosRequestConfig) => {
      return api.put(url, data, config);
    },
    []
  );

  const del = useCallback(async (url: string, config?: AxiosRequestConfig) => {
    return api.delete(url, config);
  }, []);

  return {
    get,
    post,
    put,
    delete: del,
  };
};
