const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const enabled = Boolean(GOOGLE_CLIENT_ID);

// Verifies the ID token sent by Google's "Sign in with Google" button and
// returns { email, name, googleId } on success, or throws on failure.
async function verifyGoogleToken(idToken) {
  if (!client) throw new Error('Google login konfiqurasiya edilməyib (GOOGLE_CLIENT_ID yoxdur).');
  const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) throw new Error('Google tokeni etibarsızdır.');
  return { email: payload.email, name: payload.name || payload.email.split('@')[0], googleId: payload.sub };
}

module.exports = { GOOGLE_CLIENT_ID, enabled, verifyGoogleToken };
