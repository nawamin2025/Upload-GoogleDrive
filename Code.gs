/**
 * Google Apps Script สำหรับอัปโหลดไฟล์เข้า Google Drive แบบไม่จำกัดขนาดไฟล์ (Resumable Upload)
 * รองรับไฟล์ขนาดใหญ่ระดับ GB / TB (สูงสุดตามพื้นที่ว่างใน Google Drive ของคุณ)
 * 
 * วิธีตั้งค่า:
 * 1. เปลี่ยนค่า FOLDER_ID ด้านล่างให้เป็นรหัสโฟลเดอร์ Google Drive ของคุณ
 * 2. กด Deploy > New deployment > เลือกประเภทเป็น Web app
 * 3. ตั้งค่า:
 *    - Execute as: Me (บัญชีของคุณ)
 *    - Who has access: Anyone (ทุกคน)
 * 4. กด Deploy และคัดลอก Web App URL ไปใส่ในหน้าเว็บ
 */

const FOLDER_ID = '1KbcClXSo3h019E5vXrSKx8f2dWqpQQ1m'; // โฟลเดอร์เป้าหมายของคุณ

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'ไม่พบข้อมูลที่ส่งมา (No payload)' });
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'base64Upload';
    const targetFolder = getTargetFolder(data.folderId || FOLDER_ID);

    // โหมดที่ 1: ขอ Resumable Upload URL สำหรับอัปโหลดไฟล์ตรงเข้า Google Drive โดยไม่จำกัดขนาดไฟล์
    if (action === 'initResumable') {
      const { fileName, mimeType, fileSize, origin } = data;
      if (!fileName) {
        return createJsonResponse({ status: 'error', message: 'ไม่ระบุชื่อไฟล์ (Missing fileName)' });
      }

      const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
      const metadata = {
        name: fileName,
        mimeType: mimeType || 'application/octet-stream',
        parents: [targetFolder.getId()]
      };

      const headers = {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Type': mimeType || 'application/octet-stream'
      };

      if (typeof fileSize === 'number' && fileSize >= 0) {
        headers['X-Upload-Content-Length'] = String(fileSize);
      }

      if (origin && origin !== 'null') {
        headers['Origin'] = origin;
      }

      const response = UrlFetchApp.fetch(initUrl, {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        headers: headers,
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true
      });

      const code = response.getResponseCode();
      if (code !== 200) {
        return createJsonResponse({
          status: 'error',
          message: 'ไม่สามารถสร้างเซสชันอัปโหลดได้ (HTTP ' + code + '): ' + response.getContentText()
        });
      }

      const allHeaders = response.getAllHeaders();
      const uploadUrl = allHeaders['Location'] || allHeaders['location'];

      return createJsonResponse({
        status: 'success',
        uploadUrl: uploadUrl,
        folderName: targetFolder.getName()
      });
    }

    // โหมดที่ 2 (Fallback): อัปโหลดผ่าน Base64 กรณีเปิดไฟล์แบบออฟไลน์ (file://)
    const { fileName, mimeType, base64Data } = data;
    if (!fileName || !base64Data) {
      return createJsonResponse({ status: 'error', message: 'ข้อมูลไฟล์ไม่ครบถ้วน' });
    }

    const decodedBytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType || 'application/octet-stream', fileName);
    const file = targetFolder.createFile(blob);

    return createJsonResponse({
      status: 'success',
      message: 'อัปโหลดสำเร็จ',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      folderName: targetFolder.getName()
    });
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function doGet() {
  // เรียก DriveApp เพื่อให้ Google Apps Script ขอสิทธิ์ Scope ของ Google Drive ครบถ้วนตอนกด Authorize
  DriveApp.getStorageLimit();
  return createJsonResponse({
    status: 'ok',
    message: 'Google Drive Unlimited Uploader API is running.'
  });
}

function getTargetFolder(id) {
  if (id && id !== 'PUT_YOUR_FOLDER_ID_HERE' && id.trim() !== '') {
    try {
      return DriveApp.getFolderById(id.trim());
    } catch (err) {
      throw new Error('ไม่พบโฟลเดอร์จาก Folder ID ที่ระบุ กรุณาตรวจสอบรหัสโฟลเดอร์อีกครั้ง');
    }
  }

  const defaultFolderName = 'Web_Uploads';
  const folders = DriveApp.getFoldersByName(defaultFolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(defaultFolderName);
}

function createJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
