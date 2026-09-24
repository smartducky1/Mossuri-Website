import { createHmac } from 'node:crypto';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const HMAC_SECRET = process.env.MOSSURI_HMAC_SECRET;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

async function postToGoogleAppsScript(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    redirect: 'manual',
  });

  /*
   * Google Apps Script redirects the response to
   * a googleusercontent.com URL.
   *
   * The POST has already been processed, so follow
   * the redirect with GET instead of POST.
   */
  if (
    response.status >= 300 &&
    response.status < 400
  ) {
    const location =
      response.headers.get('location');

    if (!location) {
      throw new Error(
        'Google Apps Script redirect has no location.'
      );
    }

    const redirectedUrl =
      new URL(location, url).toString();

    return fetch(redirectedUrl, {
      method: 'GET',
      redirect: 'follow',
    });
  }

  return response;
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

  if (
    !APPS_SCRIPT_URL ||
    !HMAC_SECRET
  ) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Backend is not configured.',
    });
  }

  try {
    const timestamp = Date.now();

    const payloadObject = {
      timestamp,
      wallet,
    };

    const payload =
      JSON.stringify(payloadObject);

    const signature = createHmac(
      'sha256',
      HMAC_SECRET
    )
      .update(payload, 'utf8')
      .digest('hex');

    const requestBody =
      JSON.stringify({
        type: 'task-status',
        ...payloadObject,
        signature,
      });

    const googleResponse =
      await postToGoogleAppsScript(
        APPS_SCRIPT_URL,
        requestBody
      );

    const text =
      await googleResponse.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      console.error(
        'Invalid Google Apps Script response:',
        text
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
