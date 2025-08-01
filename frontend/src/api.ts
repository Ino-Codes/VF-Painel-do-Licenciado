import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL
});

console.log('A API está se comunicando com:', API_URL);

export default api;