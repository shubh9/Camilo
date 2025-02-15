const { google } = require("googleapis");

class OAuthService {
  static SCOPES = ["https://www.googleapis.com/auth/blogger"];

  static createOAuthClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NODE_ENV === "production"
        ? "https://camilo-xn71.vercel.app/auth/google/callback"
        : "http://localhost:3001/auth/google/callback"
    );
  }

  static getConfiguredClient(accessToken, refreshToken) {
    const oauth2Client = this.createOAuthClient();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      scope: this.SCOPES,
    });
    return oauth2Client;
  }

  static getBloggerInstance(auth) {
    return google.blogger({
      version: "v3",
      auth: auth,
    });
  }
}

module.exports = OAuthService;
