/**
 * UTILITY: Google Drive Uploader
 * Uploads a local file to a specific Google Drive folder.
 *
 * Real-life analogy: Like a courier picking up your document from your desk
 * and dropping it into the exact filing cabinet drawer you specified.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

function getDriveClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Upload a local CSV file to Google Drive folder.
 * @param {string} localFilePath - Path to local CSV file
 * @returns {Object} { fileId, fileName, webViewLink }
 */
export async function uploadToDrive(localFilePath) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID in .env');
  }

  const drive = getDriveClient();
  const fileName = path.basename(localFilePath);

  console.log(`☁️  Uploading to Google Drive folder: ${folderId}`);
  console.log(`   File: ${fileName}`);

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: 'text/csv',
    body: fs.createReadStream(localFilePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink',
  });

  const { id: fileId, name, webViewLink } = response.data;

  console.log(`✅ Drive upload complete`);
  console.log(`   File ID: ${fileId}`);
  console.log(`   Link: ${webViewLink}`);

  return { fileId, fileName: name, webViewLink };
}
