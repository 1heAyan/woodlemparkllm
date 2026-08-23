/**
 * Utility functions for opening and downloading files cleanly across all devices
 * without using restrictive or messy iframe modals on mobile devices.
 */

export interface FileItemPayload {
  fileName: string;
  fileUrl?: string;
  externalLink?: string;
  studentName?: string;
  title?: string;
  description?: string;
  submissionDate?: string;
}

// Convert base64 data URI to Blob
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Cleanly opens a document, image, or certificate in a new browser tab.
 */
export function openFileInNewTab(payload: FileItemPayload): void {
  const targetUrl = payload.fileUrl || payload.externalLink;

  if (targetUrl) {
    if (targetUrl.startsWith('data:')) {
      try {
        const blob = dataURItoBlob(targetUrl);
        const blobUrl = URL.createObjectURL(blob);
        const newTab = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        if (!newTab) {
          // If popup blocker blocked the tab, fallback to direct download
          downloadFile(payload);
        }
        // Cleanup after 60 seconds
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      } catch (err) {
        console.warn('Failed to convert data URI to blob:', err);
      }
    }

    // Regular URL or external link
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Fallback: If no file URL exists, create a clean printable HTML document in a new tab
  const docContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.fileName || 'Woodlem Document'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F9F8F6;
      color: #2D2C2A;
      padding: 32px 16px;
      margin: 0;
      display: flex;
      justify-content: center;
    }
    .card {
      background: #FFFFFF;
      max-width: 680px;
      width: 100%;
      border-radius: 12px;
      border: 1px solid #E5E3DF;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      border-bottom: 2px solid #2C6E6A;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title {
      font-size: 20px;
      font-weight: 800;
      color: #2C6E6A;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #F0EFEA;
      font-size: 14px;
    }
    .meta-label { color: #73716D; font-weight: 600; }
    .desc-box {
      margin-top: 20px;
      background: #FAF9F6;
      border: 1px solid #E5E3DF;
      border-radius: 8px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: #2C6E6A;
      color: #FFFFFF;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">WOODLEM PARK SCHOOL</div>
        <div style="font-size: 12px; color: #73716D; margin-top: 2px;">Official Verified Academic Distinction Proof</div>
      </div>
    </div>
    <div class="meta-row"><span class="meta-label">Student Name:</span> <strong>${payload.studentName || 'Student'}</strong></div>
    <div class="meta-row"><span class="meta-label">Distinction / Title:</span> <strong>${payload.title || 'Official Achievement'}</strong></div>
    <div class="meta-row"><span class="meta-label">Document Name:</span> <strong>${payload.fileName}</strong></div>
    <div class="meta-row"><span class="meta-label">Recorded Date:</span> <strong>${payload.submissionDate || new Date().toLocaleDateString()}</strong></div>
    <div class="desc-box">
      <strong>Citation & Description:</strong><br/>
      ${payload.description || 'Verified academic distinction proof logged in Woodlem LMS.'}
    </div>
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;

  const blob = new Blob([docContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

/**
 * Downloads the file directly to user's device.
 */
export function downloadFile(payload: FileItemPayload): void {
  const targetUrl = payload.fileUrl || payload.externalLink;

  if (targetUrl) {
    if (targetUrl.startsWith('data:')) {
      try {
        const blob = dataURItoBlob(targetUrl);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = payload.fileName || 'Woodlem_Document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        return;
      } catch (e) {}
    }

    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = payload.fileName || 'Woodlem_Document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Text certificate fallback
  const docContent = `=====================================================
WOODLEM PARK SCHOOL - VERIFIED ACADEMIC ACHIEVEMENT PROOF
=====================================================
Student Name:       ${payload.studentName || 'Student'}
Distinction / Title: ${payload.title || 'Official School Achievement'}
Date:               ${payload.submissionDate || new Date().toLocaleDateString()}
Document / Proof:   ${payload.fileName}

DESCRIPTION / CITATION:
-----------------------------------------------------
${payload.description || 'Verified academic distinction proof record.'}
-----------------------------------------------------
Certified Woodlem LMS Student Academic Distinction Record`;

  const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload.fileName.endsWith('.txt') ? payload.fileName : `${payload.fileName || 'Certificate'}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
