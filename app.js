/**
 * ค่าการเชื่อมต่อ Google Apps Script และ Google Drive Folder (ฝังในโค้ดถาวร)
 */
const CONFIG = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbzqs0yUDnckp0w6X9-XbhPQQ81e8neGOvJTO0zxFAZvoxs_OrhIYk-_8DZa7xZawLvz/exec',
  folderId: '1KbcClXSo3h019E5vXrSKx8f2dWqpQQ1m'
};

// State เก็บรายการไฟล์ในคิว
let fileQueue = [];
let isUploading = false;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const queueSection = document.getElementById('queueSection');
const fileListEl = document.getElementById('fileList');
const fileCountText = document.getElementById('fileCountText');
const totalSizeText = document.getElementById('totalSizeText');
const uploadAllBtn = document.getElementById('uploadAllBtn');
const uploadBtnText = document.getElementById('uploadBtnText');
const clearAllBtn = document.getElementById('clearAllBtn');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');

const overallProgressWrap = document.getElementById('overallProgressWrap');
const overallStatusText = document.getElementById('overallStatusText');
const overallPercentText = document.getElementById('overallPercentText');
const overallProgressBar = document.getElementById('overallProgressBar');
const toastEl = document.getElementById('toast');

// ระบบ Drag & Drop และเลือกไฟล์
dropZone.addEventListener('click', () => {
  if (!isUploading) fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    addFilesToQueue(Array.from(e.target.files));
    fileInput.value = '';
  }
});

['dragenter', 'dragover'].forEach((evtName) => {
  dropZone.addEventListener(evtName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) dropZone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((evtName) => {
  dropZone.addEventListener(evtName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });
});

dropZone.addEventListener('drop', (e) => {
  if (isUploading) return;
  const droppedFiles = Array.from(e.dataTransfer.files);
  if (droppedFiles.length > 0) {
    addFilesToQueue(droppedFiles);
  }
});

// เพิ่มไฟล์เข้าคิว
function addFilesToQueue(files) {
  files.forEach((file) => {
    const id = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

    fileQueue.push({
      id,
      file,
      status: 'pending', // 'pending' | 'uploading' | 'success' | 'error'
      progress: 0,
      uploadedBytes: 0,
      errorMsg: '',
      fileUrl: '',
      previewUrl
    });
  });

  renderQueue();
}

// ลบไฟล์ออกจากคิว
function removeFileFromQueue(id) {
  if (isUploading) return;
  const index = fileQueue.findIndex((item) => item.id === id);
  if (index !== -1) {
    if (fileQueue[index].previewUrl) {
      URL.revokeObjectURL(fileQueue[index].previewUrl);
    }
    fileQueue.splice(index, 1);
    renderQueue();
  }
}

clearAllBtn.addEventListener('click', () => {
  if (isUploading) return;
  fileQueue.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  fileQueue = [];
  overallProgressWrap.classList.add('hidden');
  renderQueue();
});

clearCompletedBtn.addEventListener('click', () => {
  if (isUploading) return;
  fileQueue = fileQueue.filter((item) => {
    if (item.status === 'success' && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
      return false;
    }
    return true;
  });
  renderQueue();
});

// แสดงผลรายการไฟล์
function renderQueue() {
  if (fileQueue.length === 0) {
    queueSection.classList.add('hidden');
    return;
  }

  queueSection.classList.remove('hidden');

  const totalBytes = fileQueue.reduce((acc, item) => acc + item.file.size, 0);
  fileCountText.textContent = `${fileQueue.length} ไฟล์ในรายการ`;
  totalSizeText.textContent = formatBytes(totalBytes);

  const hasCompleted = fileQueue.some((item) => item.status === 'success');
  clearCompletedBtn.classList.toggle('hidden', !hasCompleted);

  const pendingOrErrorCount = fileQueue.filter(
    (item) => item.status === 'pending' || item.status === 'error'
  ).length;

  uploadAllBtn.disabled = isUploading || pendingOrErrorCount === 0;
  clearAllBtn.disabled = isUploading;
  uploadBtnText.textContent = isUploading
    ? 'กำลังอัปโหลด...'
    : `อัปโหลด (${pendingOrErrorCount} ไฟล์)`;

  fileListEl.innerHTML = '';

  fileQueue.forEach((item) => {
    const li = document.createElement('li');
    li.className = `file-item status-${item.status}`;
    li.id = `row_${item.id}`;

    const ext = getFileExtension(item.file.name);
    const badgeContent = item.previewUrl
      ? `<img src="${item.previewUrl}" alt="${escapeHtml(item.file.name)}">`
      : escapeHtml(ext || 'FILE');

    let statusHtml = '';
    if (item.status === 'pending') {
      statusHtml = `<span class="status-pill pending">รออัปโหลด</span>`;
    } else if (item.status === 'uploading') {
      statusHtml = `<span class="status-pill uploading"><span class="spinner"></span><span id="pct_${item.id}">${item.progress}%</span></span>`;
    } else if (item.status === 'success') {
      statusHtml = `
        <span class="status-pill success">สำเร็จ</span>
        ${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" rel="noopener" class="view-link">เปิดดูไฟล์</a>` : ''}
      `;
    } else if (item.status === 'error') {
      statusHtml = `<span class="status-pill error" title="${escapeHtml(item.errorMsg)}">ล้มเหลว</span>`;
    }

    const progressBarHtml = item.status === 'uploading'
      ? `<div class="file-progress-mini"><div id="bar_${item.id}" class="file-progress-mini-fill" style="width:${item.progress}%"></div></div>`
      : '';

    li.innerHTML = `
      <div class="file-main">
        <div class="file-type-badge">${badgeContent}</div>
        <div class="file-details">
          <div class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</div>
          <div class="file-meta">
            <span id="meta_${item.id}">${
              item.status === 'uploading'
                ? `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.file.size)}`
                : formatBytes(item.file.size)
            }</span>
            ${item.errorMsg ? `<span style="color:#f87171;">• ${escapeHtml(item.errorMsg)}</span>` : ''}
          </div>
          ${progressBarHtml}
        </div>
      </div>
      <div class="file-actions">
        ${statusHtml}
        ${!isUploading ? `
          <button class="remove-btn" title="ลบออกจากรายการ" data-id="${item.id}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;

    const removeBtn = li.querySelector('.remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeFileFromQueue(item.id));
    }

    fileListEl.appendChild(li);
  });
}

function updateFileProgressUI(item) {
  const pctEl = document.getElementById(`pct_${item.id}`);
  const barEl = document.getElementById(`bar_${item.id}`);
  const metaEl = document.getElementById(`meta_${item.id}`);

  if (pctEl) pctEl.textContent = `${item.progress}%`;
  if (barEl) barEl.style.width = `${item.progress}%`;
  if (metaEl) metaEl.textContent = `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.file.size)}`;
}

// เริ่มอัปโหลดไฟล์ทั้งหมด
uploadAllBtn.addEventListener('click', async () => {
  const targets = fileQueue.filter((item) => item.status === 'pending' || item.status === 'error');
  if (targets.length === 0) return;

  isUploading = true;
  overallProgressWrap.classList.remove('hidden');
  renderQueue();

  let completed = 0;
  let successCount = 0;
  const total = targets.length;

  updateOverallProgress(0, total, 0);

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    item.status = 'uploading';
    item.progress = 0;
    item.uploadedBytes = 0;
    item.errorMsg = '';
    renderQueue();

    try {
      await uploadSingleFileUnlimited(item, CONFIG.scriptUrl, CONFIG.folderId, (filePct) => {
        updateOverallProgress(completed, total, filePct);
      });
      item.status = 'success';
      item.progress = 100;
      successCount++;
    } catch (err) {
      item.status = 'error';
      item.errorMsg = err.message || 'เกิดข้อผิดพลาดในการอัปโหลด';
    }

    completed++;
    updateOverallProgress(completed, total, 0);
    renderQueue();
  }

  isUploading = false;
  renderQueue();
  showToast(`อัปโหลดเสร็จสิ้น สำเร็จ ${successCount} จาก ${total} ไฟล์`);
});

async function uploadSingleFileUnlimited(item, scriptUrl, folderId, onProgress) {
  const isFileProtocol = window.location.protocol === 'file:';

  if (!isFileProtocol) {
    try {
      const initRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'initResumable',
          fileName: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          fileSize: item.file.size,
          folderId: folderId,
          origin: window.location.origin
        })
      });

      const initData = await initRes.json();
      if (initData.status === 'success' && initData.uploadUrl) {
        const driveResponse = await uploadFileViaXHR(item, initData.uploadUrl, onProgress);
        if (driveResponse && driveResponse.id) {
          item.fileUrl = `https://drive.google.com/file/d/${driveResponse.id}/view`;
        }
        return;
      } else if (item.file.size > 35 * 1024 * 1024) {
        throw new Error(initData.message || 'ไม่สามารถสร้างลิงก์อัปโหลดไฟล์ขนาดใหญ่ได้');
      }
    } catch (resumableErr) {
      if (item.file.size > 35 * 1024 * 1024) {
        throw resumableErr;
      }
    }
  }

  item.progress = 50;
  updateFileProgressUI(item);
  if (onProgress) onProgress(50);

  const base64Data = await fileToBase64(item.file);
  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'base64Upload',
      fileName: item.file.name,
      mimeType: item.file.type || 'application/octet-stream',
      base64Data: base64Data,
      folderId: folderId
    })
  });

  const result = await response.json();
  if (result.status === 'success') {
    item.progress = 100;
    item.uploadedBytes = item.file.size;
    updateFileProgressUI(item);
    item.fileUrl = result.fileUrl || '';
  } else {
    throw new Error(result.message || 'อัปโหลดไม่สำเร็จ');
  }
}

function uploadFileViaXHR(item, uploadUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        item.progress = pct;
        item.uploadedBytes = e.loaded;
        updateFileProgressUI(item);
        if (onProgress) onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (_) {
          resolve({});
        }
      } else {
        reject(new Error(`Google Drive ตอบกลับด้วยรหัส ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('การเชื่อมต่อระหว่างอัปโหลดขัดข้อง'));
    };

    xhr.send(item.file);
  });
}

function updateOverallProgress(doneFiles, totalFiles, currentFilePct = 0) {
  const overallPct = totalFiles === 0
    ? 0
    : Math.min(100, Math.round(((doneFiles * 100 + currentFilePct) / (totalFiles * 100)) * 100));

  overallStatusText.textContent = doneFiles === totalFiles
    ? `ดำเนินการเสร็จสิ้น (${doneFiles}/${totalFiles} ไฟล์)`
    : `กำลังอัปโหลดไฟล์ที่ ${doneFiles + 1} จาก ${totalFiles}...`;
  overallPercentText.textContent = `${overallPct}%`;
  overallProgressBar.style.width = `${overallPct}%`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().slice(0, 4) : 'FILE';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3500);
}
