// netlify/functions/api.js

import { createServer, proxy } from 'aws-serverless-express';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Compute __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load your .env from the project root (one level up)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REDIRECT_URI,
  ZOHO_ORG_ID,
  ZOHO_REFRESH_TOKEN
} = process.env;

// 1) Redirect to Zoho consent
app.get('/oauth/url', (req, res) => {
  const AUTH = 'https://accounts.zoho.eu/oauth/v2/auth';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     ZOHO_CLIENT_ID,
    redirect_uri:  ZOHO_REDIRECT_URI,
    scope:         'ZohoInventory.fullaccess.all',
    access_type:   'offline',
    prompt:        'consent'
  });
  res.redirect(`${AUTH}?${params}`);
});

// 2) OAuth callback
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const tokenRes = await fetch('https://accounts.zoho.eu/oauth/v2/token?' +
      new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        redirect_uri:  ZOHO_REDIRECT_URI,
        code
      })
    );
    const data = await tokenRes.json();
    if (data.error) return res.status(400).send(data.error_description||data.error);

    // overwrite root .env refresh token
    const envPath = path.resolve(__dirname, '../../.env');
    fs.writeFileSync(envPath,
`ZOHO_CLIENT_ID=${ZOHO_CLIENT_ID}
ZOHO_CLIENT_SECRET=${ZOHO_CLIENT_SECRET}
ZOHO_REDIRECT_URI=${ZOHO_REDIRECT_URI}
ZOHO_ORG_ID=${ZOHO_ORG_ID}
ZOHO_REFRESH_TOKEN=${data.refresh_token}
`);
    res.send(`<h1>Connected</h1><p>Expires in ${data.expires_in}s</p>`);
  } catch (e) {
    console.error(e);
    res.status(500).send('Token exchange failed');
  }
});

// 3) Refresh endpoint
app.get('/oauth/refresh', async (req, res) => {
  try {
    const tokenRes = await fetch('https://accounts.zoho.eu/oauth/v2/token?' +
      new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        refresh_token: ZOHO_REFRESH_TOKEN
      })
    );
    const data = await tokenRes.json();
    if (data.error) throw data;
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send('Refresh failed');
  }
});

// Helper to call Zoho
async function getZoho(endpoint, options={}) {
  const tokenRes = await fetch(`${req.protocol}://${req.get('host')}/.netlify/functions/api/oauth/refresh`);
  const { access_token } = await tokenRes.json();
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `https://www.zohoapis.eu/inventory/v1${endpoint}${sep}organization_id=${ZOHO_ORG_ID}`;
  const apiRes = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Zoho-oauthtoken ${access_token}`, 'Content-Type':'application/json' }
  });
  if (!apiRes.ok) throw new Error(`Zoho ${apiRes.status}`);
  return apiRes.json();
}

// 4) Inventory routes
app.get('/items',        async (req, res) => res.json(await getZoho('/items')));
app.get('/purchaseorders', async (req, res) => res.json(await getZoho(`/purchaseorders?status=${req.query.status||'open'}`)));
app.post('/purchaseorders',async (req, res) => res.json(await getZoho('/purchaseorders', { method:'POST', body: JSON.stringify(req.body) })));

// 5) CRM routes
app.get('/agents',    async (req, res) => res.json(await getZoho('/settings/agents')));
app.get('/customers', async (req, res) => res.json(await getZoho('/contacts')));

// Wrap it up for Netlify
const server = createServer(app);
export const handler = (event, context) => proxy(server, event, context);