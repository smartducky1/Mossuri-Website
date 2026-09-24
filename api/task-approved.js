import { createHmac } from 'node:crypto';

const APPS_SCRIPT_URL =
  process.env.GOOGLE_APPS_SCRIPT_URL;

const HMAC_SECRET =
  process.env.MOSSURI_HMAC_SECRET;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader(
    'Content-Type',
    'application/json'
  );
  res.setHeader(
    'Cache-Control',
    'no-store'
  );

  return res.json(data);
}

async function postToGoogleAppsScript(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    redirect: 'follow',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.',
    });
  }

  if (!APPS_SCRIPT_URL || !HMAC_SECRET) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Backend is not configured.',
    });
  }

  try {
    const timestamp = Date.now();

    /*
     * MUST match taskApprovedMessage_()
     * in Code.gs exactly.
     */
    const message = [
      'task-approved',
      String(timestamp),
    ].join('|');

    const signature = createHmac(
      'sha256',
      HMAC_SECRET.trim()
    )
      .update(message, 'utf8')
      .digest('hex');

    const requestBody = JSON.stringify({
      type: 'task-approved',
      timestamp,
      signature,
    });

    const googleResponse =
      await postToGoogleAppsScript(
        APPS_SCRIPT_URL,
        requestBody
      );

    const responseText =
      await googleResponse.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(
        'Google Apps Script returned non-JSON:',
        responseText
      );

      return sendJson(res, 502, {
        ok: false,
        approved: [],
      });
    }

    return sendJson(
      res,
      data.ok ? 200 : 400,
      data
    );
  } catch (error) {
    console.error(
      'Approved leaderboard error:',
      error
    );

    return sendJson(res, 500, {
      ok: false,
      approved: [],
    });
  }
}
