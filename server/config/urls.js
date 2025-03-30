// URL Configuration
const DEV_CLIENT_URL = "http://localhost:3000";
const PROD_CLIENT_URL = "https://shubh.run";
const PROD_SERVER_URL = "https://camilo-server.vercel.app";
const DEV_SERVER_URL = "http://localhost:3001";

const CLIENT_URL =
  process.env.NODE_ENV === "production" ? PROD_CLIENT_URL : DEV_CLIENT_URL;

// Use server URL for Google OAuth callback
const SERVER_URL =
  process.env.NODE_ENV === "production" ? PROD_SERVER_URL : DEV_SERVER_URL;

const GOOGLE_CALLBACK_URL = `${SERVER_URL}/auth/google/callback`;

console.log("OAuth callback URL being used:", GOOGLE_CALLBACK_URL);

module.exports = {
  DEV_CLIENT_URL,
  PROD_CLIENT_URL,
  DEV_SERVER_URL,
  PROD_SERVER_URL,
  CLIENT_URL,
  SERVER_URL,
  GOOGLE_CALLBACK_URL,
};
