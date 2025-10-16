// backend/services/rdstation.js
const axios = require("axios");

const rdApi = axios.create({
  baseURL: "https://api.rd.services/platform/v1", // URL base da API do RD Station v1
  headers: {
    Authorization: `Bearer ${process.env.RDSTATION_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

module.exports = rdApi;
