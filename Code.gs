const FOLDER_ID = '1KbcClXSo3h019E5vXrSKx8f2dWqpQQ1m';
const TELEGRAM_BOT_TOKEN = '9146466574:AAEN9NrsWVyfb9fw52jpckzqBTpnMdmQTX4';
const ALLOWED_CHAT_IDS = []; // หากต้องการล็อกให้ใช้ได้เฉพาะคุณ ให้ใส่ Chat ID ในวงเล็บ เช่น [123456789]

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'No payload' });
    }

    const data = JSON.parse(e.postData.contents);

    // 1. รับไฟล์และคำสั่งจาก Telegram Bot (@Upload_Drive2_bot)
    if (data.update_id || data.message || data.edited_message) {
      if (isDuplicateTelegramUpdate(data.update_id)) {
        return HtmlService.createHtmlOutput('OK');
      }
      handleTelegramUpdate(data);
      return HtmlService.createHtmlOutput('OK');
    }

    // 2. จัดการประวัติชื่อไฟล์บน Cloud (เก็บเฉพาะชื่อไฟล์เท่านั้น ไม่เก็บลิงก์)
    const action = data.action || 'base64Upload';

    if (action === 'getHistory') {
      return createJsonResponse({
        status: 'success',
        history: getCloudHistoryNames()
      });
    }

    if (action === 'logHistory') {
      if (data.fileName) {
        addCloudHistoryName(data.fileName);
      }
      return createJsonResponse({
        status: 'success',
        history: getCloudHistoryNames()
      });
    }

    if (action === 'clearHistory') {
      clearCloudHistoryNames();
      return createJsonResponse({
        status: 'success',
        history: []
      });
    }

    // 3. รับไฟล์จากหน้าเว็บ HTML/JS
    const targetFolder = DriveApp.getFolderById((data.folderId || FOLDER_ID).trim());

    if (action === 'initResumable') {
      const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
      const metadata = {
        name: data.fileName,
        mimeType: data.mimeType || 'application/octet-stream',
        parents: [targetFolder.getId()]
      };

      const headers = {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Type': data.mimeType || 'application/octet-stream'
      };
      if (typeof data.fileSize === 'number' && data.fileSize >= 0) {
        headers['X-Upload-Content-Length'] = String(data.fileSize);
      }
      if (data.origin && data.origin !== 'null') {
        headers['Origin'] = data.origin;
      }

      const response = UrlFetchApp.fetch(initUrl, {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        headers: headers,
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) {
        return createJsonResponse({ status: 'error', message: response.getContentText() });
      }

      const allHeaders = response.getAllHeaders();
      return createJsonResponse({
        status: 'success',
        uploadUrl: allHeaders['Location'] || allHeaders['location']
      });
    }

    const decoded = Utilities.base64Decode(data.base64Data);
    const blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', data.fileName);
    const file = targetFolder.createFile(blob);

    // บันทึกเฉพาะชื่อไฟล์ลง Cloud History
    addCloudHistoryName(file.getName());

    return createJsonResponse({
      status: 'success',
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl()
    });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * บันทึกเฉพาะชื่อไฟล์ลง Cloud PropertiesService (ไม่เก็บ URL หรือข้อมูลไฟล์)
 */
function addCloudHistoryName(fileName) {
  if (!fileName) return;
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('CLOUD_HISTORY_NAMES');
    let list = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (_) {
        list = [];
      }
    }
    list.unshift({
      name: String(fileName),
      time: Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm')
    });
    // เก็บสูงสุด 150 รายการล่าสุดบน Cloud
    list = list.slice(0, 150);
    props.setProperty('CLOUD_HISTORY_NAMES', JSON.stringify(list));
  } finally {
    lock.releaseLock();
  }
}

function getCloudHistoryNames() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('CLOUD_HISTORY_NAMES');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function clearCloudHistoryNames() {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    PropertiesService.getScriptProperties().deleteProperty('CLOUD_HISTORY_NAMES');
  } finally {
    lock.releaseLock();
  }
}

function isDuplicateTelegramUpdate(updateId) {
  if (!updateId) return false;
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'tg_uid_' + updateId;
    if (cache.get(cacheKey)) {
      return true;
    }
    cache.put(cacheKey, '1', 21600);

    const props = PropertiesService.getScriptProperties();
    const lastId = Number(props.getProperty('LAST_TG_UPDATE_ID') || 0);
    if (updateId <= lastId) {
      return true;
    }
    props.setProperty('LAST_TG_UPDATE_ID', String(updateId));
    return false;
  } finally {
    lock.releaseLock();
  }
}

function handleTelegramUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.chat) return;

  const chatId = msg.chat.id;

  if (ALLOWED_CHAT_IDS.length > 0 && ALLOWED_CHAT_IDS.indexOf(chatId) === -1) {
    sendTelegramMessage(chatId, '⛔ บอทนี้จำกัดสิทธิ์เฉพาะเจ้าของเท่านั้น (Your Chat ID: ' + chatId + ')');
    return;
  }

  if (msg.text && (msg.text.startsWith('/start') || msg.text.startsWith('/help'))) {
    sendTelegramMessage(
      chatId,
      '📂 *Google Drive Uploader Bot (@Upload_Drive2_bot) พร้อมใช้งาน!*\n\n' +
      '• ส่งไฟล์, รูปภาพ, วิดีโอ หรือไฟล์เสียง มาในแชทนี้เพื่ออัปโหลดเข้า Google Drive ได้ทันที (สูงสุด 20 MB ต่อไฟล์สำหรับบอท Telegram)\n' +
      '• สำหรับไฟล์ขนาดใหญ่ไม่จำกัดขนาด อัปโหลดผ่านเว็บได้ที่:\nhttps://nawamin2025.github.io/Upload-GoogleDrive/\n\n' +
      '🆔 Chat ID ของคุณคือ: `' + chatId + '`'
    );
    return;
  }

  let fileId = null;
  let fileName = null;
  let mimeType = null;

  if (msg.document) {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || ('document_' + Date.now());
    mimeType = msg.document.mime_type;
  } else if (msg.photo && msg.photo.length > 0) {
    const largestPhoto = msg.photo[msg.photo.length - 1];
    fileId = largestPhoto.file_id;
    fileName = 'photo_' + formatTimestamp() + '.jpg';
    mimeType = 'image/jpeg';
  } else if (msg.video) {
    fileId = msg.video.file_id;
    fileName = msg.video.file_name || ('video_' + formatTimestamp() + '.mp4');
    mimeType = msg.video.mime_type || 'video/mp4';
  } else if (msg.audio) {
    fileId = msg.audio.file_id;
    fileName = msg.audio.file_name || ('audio_' + formatTimestamp() + '.mp3');
    mimeType = msg.audio.mime_type || 'audio/mpeg';
  } else if (msg.voice) {
    fileId = msg.voice.file_id;
    fileName = 'voice_' + formatTimestamp() + '.ogg';
    mimeType = msg.voice.mime_type || 'audio/ogg';
  }

  if (!fileId) {
    sendTelegramMessage(chatId, '💡 ส่งไฟล์ รูปภาพ หรือวิดีโอที่ต้องการอัปโหลดเข้า Google Drive มาในแชทนี้ได้เลยครับ');
    return;
  }

  try {
    const getFileUrl = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/getFile?file_id=' + encodeURIComponent(fileId);
    const fileInfoRes = UrlFetchApp.fetch(getFileUrl, { muteHttpExceptions: true });
    const fileInfo = JSON.parse(fileInfoRes.getContentText());

    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
      sendTelegramMessage(
        chatId,
        '❌ ไม่สามารถดึงไฟล์จาก Telegram ได้ (ไฟล์อาจมีขนาดเกิน 20 MB ตามข้อจำกัดของ Telegram Bot)\n' +
        '👉 สำหรับไฟล์ขนาดใหญ่ อัปโหลดผ่านหน้าเว็บได้ที่:\nhttps://nawamin2025.github.io/Upload-GoogleDrive/'
      );
      return;
    }

    const downloadUrl = 'https://api.telegram.org/file/bot' + TELEGRAM_BOT_TOKEN + '/' + fileInfo.result.file_path;
    const fileBlob = UrlFetchApp.fetch(downloadUrl).getBlob();
    fileBlob.setName(fileName);
    if (mimeType) fileBlob.setContentType(mimeType);

    const targetFolder = DriveApp.getFolderById(FOLDER_ID);
    const savedFile = targetFolder.createFile(fileBlob);

    // บันทึกเฉพาะชื่อไฟล์ลง Cloud History ด้วย
    addCloudHistoryName(savedFile.getName());

    sendTelegramMessage(
      chatId,
      '✅ *อัปโหลดเข้า Google Drive สำเร็จ!*\n' +
      '📄 *ชื่อไฟล์:* `' + savedFile.getName() + '`\n' +
      '🔗 [เปิดดูไฟล์ใน Google Drive](' + savedFile.getUrl() + ')'
    );
  } catch (err) {
    sendTelegramMessage(chatId, '❌ เกิดข้อผิดพลาดในการอัปโหลด: ' + err.toString());
  }
}

function sendTelegramMessage(chatId, text) {
  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });
}

function setupTelegramWebhook() {
  const webAppUrl = ScriptApp.getService().getUrl();
  const apiUrl = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/setWebhook?drop_pending_updates=true&url=' + encodeURIComponent(webAppUrl);
  const res = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
  return JSON.parse(res.getContentText());
}

function formatTimestamp() {
  return Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmmss');
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getHistory') {
    return createJsonResponse({
      status: 'success',
      history: getCloudHistoryNames()
    });
  }
  DriveApp.getStorageLimit();
  const webhookResult = setupTelegramWebhook();
  return createJsonResponse({
    status: 'ok',
    message: 'เชื่อมต่อ Telegram Bot (@Upload_Drive2_bot) และ Web Uploader เรียบร้อยแล้ว!',
    webhook: webhookResult
  });
}

function createJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
