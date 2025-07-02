// server.js
import 'dotenv/config.js';
import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser());

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REDIRECT_URI,
  PORT = 3001,
} = process.env;

// In-memory tokens (for demo; swap out for a DB in prod)
let accessToken = '';
let refreshToken = '';

// 1) Kick off OAuth
app.get('/oauth/link', (req, res) => {
  const scope = [
    'ZohoCRM.modules.ALL',
    'ZohoInventory.FullAccess.all',
    // …other scopes…
  ].join(',');
  const authUrl = new URL('https://accounts.zoho.eu/oauth/v2/auth');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('client_id', ZOHO_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('redirect_uri', ZOHO_REDIRECT_URI);
  res.redirect(authUrl.toString());
});

// 2) OAuth callback
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');

  try {
    const tokenRes = await axios.post('https://accounts.zoho.eu/oauth/v2/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        redirect_uri: ZOHO_REDIRECT_URI,
        code,
      },
    });

    accessToken  = tokenRes.data.access_token;
    refreshToken = tokenRes.data.refresh_token;

    res
      .cookie('zoho_rt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      })
      .send('Authenticated with Zoho! You can close this window.');
  } catch (err) {
    console.error('Token exchange failed', err.response?.data || err);
    res.status(500).send('Token exchange failed');
  }
});

// 3) Token refresher
async function ensureAccessToken() {
  if (accessToken) return accessToken;
  if (refreshToken) {
    const r = await axios.post('https://accounts.zoho.eu/oauth/v2/token', null, {
      params: {
        grant_type: 'refresh_token',
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        refresh_token: refreshToken,
      },
    });
    accessToken = r.data.access_token;
    return accessToken;
  }
  throw new Error('No refresh token; please re-authenticate at /oauth/link');
}

// 4) Customers proxy
app.get('/api/zoho/customers', async (req, res) => {
  try {
    const token = await ensureAccessToken();
    const zohoRes = await axios.get(
      'https://www.zohoapis.eu/inventory/v1/customers',
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const options = zohoRes.data.customers.map(c => ({
      id: c.customer_id,
      name: c.customer_name,
    }));
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// 5) Agents proxy
app.get('/api/zoho/agents', async (req, res) => {
  try {
    const token = await ensureAccessToken();
    const zohoRes = await axios.get(
      'https://www.zohoapis.eu/crm/v2/users',
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const options = zohoRes.data.users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.full_name,
    }));
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch agents' });
  }
});

app.listen(PORT, () => {
  console.log(`Zoho OAuth server running on http://localhost:${PORT}`);
});