// auth.js — Google OAuth2 authentication

const CLIENT_ID = '441317756280-ekc345fhpmdbtbgqccve22s3e2bsapt3.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file profile email';
const DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4',
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
];

let _tokenClient = null;
let _isInitialised = false;

export async function initAuth() {
  return new Promise((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        });
        _isInitialised = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

export function initTokenClient(onSuccess, onError) {
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        onError(response);
        return;
      }
      // Store token expiry
      const expiry = Date.now() + (response.expires_in * 1000);
      localStorage.setItem('finance_token_expiry', expiry.toString());
      onSuccess(response);
    },
  });
}

export function requestToken(prompt = '') {
  if (!_tokenClient) throw new Error('Token client not initialised');
  _tokenClient.requestAccessToken({ prompt });
}

export function isTokenValid() {
  const expiry = localStorage.getItem('finance_token_expiry');
  if (!expiry) return false;
  // Treat as expired 5 minutes early to avoid edge cases
  return Date.now() < (parseInt(expiry) - 5 * 60 * 1000);
}

export function revokeToken() {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken(null);
  }
  localStorage.removeItem('finance_token_expiry');
  localStorage.removeItem('finance_sheet_id');
}

export function isSignedIn() {
  return isTokenValid() && gapi.client.getToken() !== null;
}
