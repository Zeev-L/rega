/**
 * רגע — Email relay (Google Apps Script Web App)
 *
 * Receives a POST from the רגע desktop app and sends the evening summary
 * email through your own Gmail. Deploy as a Web App (see README.md).
 */

// Must match the "secret" you paste into the app (הגדרות → חיבור מייל).
const SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (!SECRET || SECRET === 'CHANGE_ME_TO_A_LONG_RANDOM_STRING') return out(500, 'set SECRET in Code.gs');
    if (body.secret !== SECRET) return out(403, 'bad secret');
    if (!body.to) return out(400, 'no recipient');

    MailApp.sendEmail({
      to: body.to,
      subject: body.subject || 'רגע · סיכום היום',
      htmlBody: body.html || '',
      name: 'רגע'
    });
    return out(200, 'sent');
  } catch (err) {
    return out(500, String(err));
  }
}

function doGet() {
  return ContentService.createTextOutput('rega relay ok');
}

function out(code, msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ code: code, msg: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
