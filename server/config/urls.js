// URL Configuration
const DEV_CLIENT_URL = "http://localhost:3000";
const PROD_CLIENT_URL = "https://shubh.run";
const DEV_SERVER_URL = "http://localhost:3001";

const CLIENT_URL =
  process.env.NODE_ENV === "production" ? PROD_CLIENT_URL : DEV_CLIENT_URL;
const GOOGLE_CALLBACK_URL = `${CLIENT_URL}/auth/google/callback`;

module.exports = {
  DEV_CLIENT_URL,
  PROD_CLIENT_URL,
  DEV_SERVER_URL,
  CLIENT_URL,
  GOOGLE_CALLBACK_URL,
};
