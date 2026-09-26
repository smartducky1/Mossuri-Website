import { createHmac } from 'node:crypto';

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const HMAC_SECRET = process.env.MOSSURI_HMAC_SECRET;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

export default async function handler(req, res) {

  // ============================================
  // METHOD
  // ============================================

  if (req.method === 'OPTIONS') {
    res.status(204);
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.'
    });
  }

  // ============================================
  // ENVIRONMENT VARIABLES
  // ============================================

  if (!APPS_SCRIPT_URL) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Submission service is not configured.'
    });
  }

  if (!HMAC_SECRET) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Submission security is not configured.'
    });
  }

  try {

    // ============================================
    // READ REQUEST
    // ============================================

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    // ============================================
    // FORM DATA
    // ============================================

    const xUsername =
      String(body.xUsername || '')
        .trim()
        .replace(/^@/, '');

    const quoteTweet =
      String(body.quoteTweet || '').trim();

    const tagFriends =
      String(body.tagFriends || '').trim();

    const wallet =
      String(body.wallet || '').trim();

    // ============================================
    // VALIDATE X USERNAME
    // ============================================

    if (!xUsername) {
      return sendJson(res, 400, {
        ok: false,
        error: 'X username is required.'
      });
    }

    if (!/^[A-Za-z0-9_]{1,15}$/.test(xUsername)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid X username.'
      });
    }

    // ============================================
    // VALIDATE QUOTE TWEET
    // ============================================

    if (!quoteTweet) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Quote tweet is required.'
      });
    }

    // ============================================
    // VALIDATE TAGGED FRIENDS
    // ============================================

    if (!tagFriends) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Tagged friends are required.'
      });
    }

    // ============================================
    // VALIDATE WALLET
    // ============================================

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid EVM wallet address.'
      });
    }

    // ============================================
    // TIMESTAMP
    // ============================================

    const timestamp = Date.now();

    // ============================================
    // PAYLOAD
    //
    // IMPORTANT:
    // This matches the fields currently sent by
    // your main.jsx.
    // ============================================

    const payloadObject = {
      source: 'whitelist',
      timestamp,
      xUsername,
      likeRt: 'completed',
      quoteTweet,
      tagFriends,
      wallet
    };

    // ============================================
    // CREATE HMAC
    // ============================================

    const payload =
      JSON.stringify(payloadObject);

    const signature =
      createHmac(
        'sha256',
        HMAC_SECRET
      )
        .update(payload, 'utf8')
        .digest('hex');

    // ============================================
    // FINAL GOOGLE APPS SCRIPT REQUEST
    // ============================================

    const requestBody = JSON.stringify({
      ...payloadObject,
      signature
    });

    console.log(
      'Sending whitelist application to Google Apps Script'
    );

    // ============================================
    // GOOGLE APPS SCRIPT
    // ============================================

    const googleResponse = await fetch(
      APPS_SCRIPT_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: requestBody,

        redirect: 'follow'
      }
    );

    // ============================================
    // READ RESPONSE
    // ============================================

    const responseText =
      await googleResponse.text();

    console.log(
      'Google Apps Script response:',
      googleResponse.status,
      responseText
    );

    // ============================================
    // HTTP ERROR
    // ============================================

    if (!googleResponse.ok) {
      return sendJson(res, 502, {
        ok: false,
        error:
          `Google Apps Script returned HTTP ${googleResponse.status}.`
      });
    }

    // ============================================
    // PARSE RESPONSE
    // ============================================

    let googleData;

    try {
      googleData =
        JSON.parse(responseText);
    } catch (error) {

      console.error(
        'Invalid Google Apps Script response:',
        responseText
      );

      return sendJson(res, 502, {
        ok: false,
        error:
          'Google Apps Script returned an invalid response.'
      });
    }

    // ============================================
    // GOOGLE APPS SCRIPT REJECTED
    // ============================================

    if (!googleData.ok) {

      console.error(
        'Google Apps Script rejected application:',
        googleData
      );

      return sendJson(res, 400, {
        ok: false,
        error:
          googleData.error ||
          'Submission was rejected.'
      });
    }

    // ============================================
    // SUCCESS
    // ============================================

    return sendJson(res, 200, {
      ok: true,
      success: true,
      message:
        'Application submitted successfully.'
    });

  } catch (error) {

    console.error(
      'Whitelist submission error:',
      error
    );

    return sendJson(res, 500, {
      ok: false,
      error:
        'Could not save your application. Please try again.'
    });
  }
}
