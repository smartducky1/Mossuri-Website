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

  const wallet =
    String(req.query.wallet || '').trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return sendJson(res, 400, {
      ok: false,
      status: 'INVALID WALLET',
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
     * MUST match taskStatusMessage_()
     * in Code.gs exactly.
     */
    const message = [
      'task-status',
      String(timestamp),
      wallet,
    ].join('|');

    const signature = createHmac(
      'sha256',
      HMAC_SECRET.trim()
    )
      .update(message, 'utf8')
      .digest('hex');

    const requestBody = JSON.stringify({
      type: 'task-status',
      timestamp,
      wallet,
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
        status: 'ERROR',
      });
    }

    return sendJson(
      res,
      data.ok ? 200 : 400,
      data
    );
  } catch (error) {
    console.error(
      'Task status error:',
      error
    );

    return sendJson(res, 500, {
      ok: false,
      status: 'ERROR',
    });
  }
}
