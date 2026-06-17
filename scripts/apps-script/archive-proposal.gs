/**
 * Capucor — signed-proposal PDF archiver (PR10).
 *
 * A Google Apps Script Web App that receives a rendered proposal (HTML) from the
 * Capucor site when a client signs, converts it to PDF, and files it in the
 * firm's central "Internal Drive" folder (a Google Shared Drive). The site never
 * touches Drive directly — this script runs as its owner (zjak@capucor.com) and
 * has the Drive access, so no service account / key is needed on the site.
 *
 * Setup (see README.md in this folder for the full walkthrough):
 *   1. Create a Shared Drive + an "Internal Drive" folder for signed proposals;
 *      copy that folder's id.
 *   2. In this Apps Script project: Services → add "Drive API" (Advanced Drive
 *      Service, identifier `Drive`).
 *   3. Project Settings → Script properties: add
 *        FOLDER_ID     = <the Shared Drive folder id>
 *        SHARED_SECRET = <a long random string; also a Cloudflare secret>
 *   4. Deploy → New deployment → Web app: execute as ME, who has access = anyone
 *      (the shared secret is the real gate). Copy the /exec URL.
 *   5. On Cloudflare, set the site secrets:
 *        APPS_SCRIPT_PDF_URL    = <the /exec URL>
 *        APPS_SCRIPT_PDF_SECRET = <the same SHARED_SECRET>
 */

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SHARED_SECRET');
    var folderId = props.getProperty('FOLDER_ID');

    if (!expected || body.secret !== expected) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    if (!folderId) {
      return json_({ ok: false, error: 'FOLDER_ID script property is not set' });
    }
    if (!body.html) {
      return json_({ ok: false, error: 'missing html' });
    }

    var filename = body.filename || 'signed proposal.pdf';

    // HTML → PDF via Google's converter.
    var pdfBlob = Utilities.newBlob(body.html, 'text/html', filename).getAs('application/pdf');
    pdfBlob.setName(filename);

    // File into the Shared Drive folder. The Advanced Drive Service with
    // supportsAllDrives is the reliable path for Shared Drives.
    var file = Drive.Files.create(
      { name: filename, parents: [folderId] },
      pdfBlob,
      { supportsAllDrives: true, fields: 'id,webViewLink' }
    );

    return json_({ ok: true, fileId: file.id, fileUrl: file.webViewLink });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
