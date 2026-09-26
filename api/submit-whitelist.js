import crypto from 'node:crypto';

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.json(data);
}

function timingSafeEqual(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export default async function handler(req, res) {

  // ============================================
  // METHOD
  // ============================================

  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.'
    });
  }

  try {

    // ============================================
    // ENVIRONMENT VARIABLES
    // ============================================

    const APPS_SCRIPT_URL =
      process.env.GOOGLE_APPS_SCRIPT_URL;

    const SUBMISSION_TOKEN =
      process.env.MOSSURI_SUBMISSION_TOKEN;

    if (!APPS_SCRIPT_URL) {
      console.error(
        'GOOGLE_APPS_SCRIPT_URL is missing.'
      );

      return sendJson(res, 500, {
        ok: false,
        error: 'Submission service is not configured.'
      });
    }

    if (!SUBMISSION_TOKEN) {
      console.error(
        'MOSSURI_SUBMISSION_TOKEN is missing.'
      );

      return sendJson(res, 500, {
        ok: false,
        error: 'Submission security is not configured.'
      });
    }

    // ============================================
    // READ BODY
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
    // VALIDATE EVM WALLET
    // ============================================

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid EVM wallet address.'
      });
    }

    // ============================================
    // CREATE SERVER PAYLOAD
    // ============================================

    const payload = {
      source: 'whitelist',
      timestamp: Date.now(),
      xUsername,
      quoteTweet,
      tagFriends,
      wallet,

      // Server-to-server authentication.
      // This NEVER comes from the browser.
      token: SUBMISSION_TOKEN
    };

    // ============================================
    // SEND TO GOOGLE APPS SCRIPT
    // ============================================

    const response = await fetch(
      APPS_SCRIPT_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(payload),

        redirect: 'follow'
      }
    );

    const responseText =
      await response.text();

    console.log(
      'Google Apps Script status:',
      response.status
    );

    // ============================================
    // PARSE RESPONSE
    // ============================================

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error(
        'Google Apps Script returned:',
        responseText
      );

      return sendJson(res, 502, {
        ok: false,
        error:
          'Invalid response from submission service.'
      });
    }

    // ============================================
    // HANDLE GOOGLE ERROR
    // ============================================

    if (!response.ok || result.ok === false) {

      console.error(
        'Google Apps Script rejected submission:',
        result
      );

      return sendJson(res, 400, {
        ok: false,
        error:
          result.error ||
          'Could not save your application.'
      });
    }

    // ============================================
    // SUCCESS
    // ============================================

    return sendJson(res, 200, {
      ok: true,
      success: true,
      message:
        result.message ||
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
