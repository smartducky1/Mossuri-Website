import { createHmac } from 'node:crypto';

const APPS_SCRIPT_URL =
  process.env.GOOGLE_APPS_SCRIPT_URL;

const HMAC_SECRET =
  process.env.MOSSURI_TASK_HMAC_SECRET;

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


async function postToGoogleAppsScript(
  url,
  body
) {

  const response = await fetch(
    url,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body,

      redirect: 'manual',
    }
  );


  if (
    response.status >= 300 &&
    response.status < 400
  ) {

    const location =
      response.headers.get(
        'location'
      );

    if (!location) {
      throw new Error(
        'Missing Google Apps Script redirect location.'
      );
    }

    const redirectedUrl =
      new URL(
        location,
        url
      ).toString();

    return fetch(
      redirectedUrl,
      {
        method: 'GET',
        redirect: 'follow',
      }
    );
  }


  return response;
}


export default async function handler(
  req,
  res
) {

  if (
    req.method !== 'GET'
  ) {

    return sendJson(
      res,
      405,
      {
        ok: false,
        error:
          'Method not allowed.',
      }
    );
  }


  if (
    !APPS_SCRIPT_URL ||
    !HMAC_SECRET
  ) {

    return sendJson(
      res,
      500,
      {
        ok: false,
        error:
          'Task backend is not configured.',
      }
    );
  }


  try {

    const timestamp =
      Date.now();


    /*
     * MUST match taskApprovedMessage_()
     * in Code.gs exactly.
     */
    const message = [
      'task-approved',
      String(timestamp),
    ].join('|');


    const signature =
      createHmac(
        'sha256',
        HMAC_SECRET.trim()
      )
        .update(
          message,
          'utf8'
        )
        .digest('hex');


    const requestBody =
      JSON.stringify({
        type: 'task-approved',
        timestamp,
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

      data =
        JSON.parse(text);

    } catch {

      console.error(
        'Invalid Google Apps Script response:',
        text
      );

      return sendJson(
        res,
        502,
        {
          ok: false,
          approved: [],
        }
      );
    }


    return sendJson(
      res,
      data.ok
        ? 200
        : 400,
      data
    );

  } catch (error) {

    console.error(
      'Approved leaderboard error:',
      error
    );

    return sendJson(
      res,
      500,
      {
        ok: false,
        approved: [],
      }
    );
  }
}
