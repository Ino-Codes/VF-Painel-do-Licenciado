import axios from 'axios';

// Lê a variável de ambiente REACT_APP_API_URL. Se não existir, usa localhost:3001.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL
});

console.log('A API está se comunicando com:', API_URL); // Log para depuração

export default api;