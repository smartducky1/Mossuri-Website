# Mossuri Whitelist

Vite + React one-page whitelist site for Vercel.

## Local
npm install
npm run dev

## Build
npm run build

## Vercel environment variables
- `GOOGLE_APPS_SCRIPT_URL` — your deployed Google Apps Script `/exec` URL.
- `MOSSURI_HMAC_SECRET` — the exact same random secret stored in Apps Script Script Properties as `HMAC_SECRET`.

Never put the HMAC secret in client-side code and never commit real `.env` values.

## Submission flow
Browser → `/api/submit-whitelist` on Vercel → HMAC-SHA256 → Google Apps Script → Google Sheet.

The frontend validates X usernames, X post/comment URLs, and EVM addresses before sending. The Vercel endpoint validates them again server-side.
