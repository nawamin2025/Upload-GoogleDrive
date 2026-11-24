/**
 * DriveDrop Cloud — Interactive Animated Uploader with Web Audio Sound FX & Confetti
 */
const CONFIG = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbzqs0yUDnckp0w6X9-XbhPQQ81e8neGOvJTO0zxFAZvoxs_OrhIYk-_8DZa7xZawLvz/exec',
  folderId: '1KbcClXSo3h019E5vXrSKx8f2dWqpQQ1m'
};

const THEMES = [
  { id: 'aurora', label: 'Aurora', icon: '🌌' },
  { id: 'daylight', label: 'Daylight', icon: '🌤️' },
  { id: 'sunset', label: 'Sunset', icon: '🌸' }
];

let fileQueue = [];
let uploadHistory = JSON.parse(localStorage.getItem('drivedrop_history') || '[]');
let isUploading = false;
let soundEnabled = localStorage.getItem('drivedrop_sound') !== 'off';
let currentThemeIdx = 0;

// ============================================================================
// 1. Web Audio API Synthesizer (เสียงคลิก & เอฟเฟกต์แบบไม่ต้องใช้ไฟล์เสียงภายนอก)
// ============================================================================
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type = 'click') {
  if (navigator.vibrate) {
    navigator.vibrate(type === 'success' ? [20, 40, 30] : 10);
  }
  if (!soundEnabled) return;

  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'click' || type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'pop' ? 520 : 680, now);
      osc.frequency.exponentialRampToValueAtTime(type === 'pop' ? 880 : 320, now + 0.065);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'add') {
      [440, 587.33].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.12, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.13);
      });
    } else if (type === 'success') {
      // คอร์ดเสียงฉลองเมื่ออัปโหลดสำเร็จ
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.15, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.3);
      });
    } else if (type === 'delete') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.09);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (_) {}
}

// ============================================================================
// 2. Interactive Background Particles & Confetti Fireworks
// ============================================================================
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
const confettiCanvas = document.getElementById('confettiCanvas');
const confCtx = confettiCanvas.getContext('2d');

let particles = [];
let confettiPieces = [];
let pointer = { x: -500, y: -500 };

function resizeCanvases() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvases);
resizeCanvases();

window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

function initParticles() {
  particles = [];
  const count = Math.min(36, Math.floor(window.innerWidth / 28));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      r: Math.random() * 2.2 + 1,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      alpha: Math.random() * 0.45 + 0.15
    });
  }
}
initParticles();

function launchConfetti() {
  const colors = ['#38bdf8', '#6366f1', '#10b981', '#f472b6', '#fbbf24'];
  for (let i = 0; i < 70; i++) {
    confettiPieces.push({
      x: confettiCanvas.width / 2 + (Math.random() - 0.5) * 140,
      y: confettiCanvas.height * 0.45,
      vx: (Math.random() - 0.5) * 11,
      vy: -(Math.random() * 10 + 4),
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      life: 1
    });
  }
}

function animateLoop() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  const isDaylight = document.documentElement.getAttribute('data-theme') === 'daylight';
  const dotColor = isDaylight ? '37, 99, 235' : '148, 163, 184';

  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = bgCanvas.width;
    if (p.x > bgCanvas.width) p.x = 0;
    if (p.y < 0) p.y = bgCanvas.height;
    if (p.y > bgCanvas.height) p.y = 0;

    const dx = p.x - pointer.x;
    const dy = p.y - pointer.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 110 && dist > 0) {
      p.x += (dx / dist) * 0.8;
      p.y += (dy / dist) * 0.8;
    }

    bgCtx.beginPath();
    bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(${dotColor}, ${p.alpha})`;
    bgCtx.fill();
  }

  // Render confetti if active
  if (confettiPieces.length > 0) {
    confCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces = confettiPieces.filter((c) => c.life > 0.02);
    for (const c of confettiPieces) {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.28; // gravity
      c.rot += c.vRot;
      c.life -= 0.012;

      confCtx.save();
      confCtx.translate(c.x, c.y);
      confCtx.rotate(c.rot);
      confCtx.globalAlpha = Math.max(0, c.life);
      confCtx.fillStyle = c.color;
      confCtx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
      confCtx.restore();
    }
  }

  requestAnimationFrame(animateLoop);
}
animateLoop();

// ============================================================================
// 3. DOM Elements & Theme / Sound Controls
// ============================================================================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');

const btnPickFiles = document.getElementById('btnPickFiles');
const btnPickGallery = document.getElementById('btnPickGallery');
const btnPickCamera = document.getElementById('btnPickCamera');

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
const speedText = document.getElementById('speedText');

const themeBtn = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
const soundBtn = document.getElementById('soundBtn');
const soundIcon = document.getElementById('soundIcon');
const brandLogo = document.getElementById('brandLogo');

const queueBadge = document.getElementById('queueBadge');
const historyBadge = document.getElementById('historyBadge');
const historyListEl = document.getElementById('historyList');
const emptyHistoryEl = document.getElementById('emptyHistory');
const emptyHistoryText = document.getElementById('emptyHistoryText');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const toastEl = document.getElementById('toast');

// Load saved theme
const savedThemeId = localStorage.getItem('drivedrop_theme') || 'aurora';
currentThemeIdx = Math.max(0, THEMES.findIndex((t) => t.id === savedThemeId));
applyTheme(THEMES[currentThemeIdx]);
updateSoundUI();
renderHistory();

function applyTheme(themeObj) {
  document.documentElement.setAttribute('data-theme', themeObj.id);
  themeIcon.textContent = themeObj.icon;
  themeLabel.textContent = themeObj.label;
  localStorage.setItem('drivedrop_theme', themeObj.id);
}

themeBtn.addEventListener('click', () => {
  currentThemeIdx = (currentThemeIdx + 1) % THEMES.length;
  applyTheme(THEMES[currentThemeIdx]);
  playSound('pop');
  showToast(`เปลี่ยนโทนสีเป็น ${THEMES[currentThemeIdx].label} ${THEMES[currentThemeIdx].icon}`);
});

soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('drivedrop_sound', soundEnabled ? 'on' : 'off');
  updateSoundUI();
  if (soundEnabled) playSound('pop');
  showToast(soundEnabled ? '🔊 เปิดเสียงเอฟเฟกต์คลิกแล้ว' : '🔇 ปิดเสียงเอฟเฟกต์แล้ว');
});

function updateSoundUI() {
  soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  soundBtn.classList.toggle('active', soundEnabled);
}

brandLogo.addEventListener('click', () => {
  playSound('pop');
});

// Segmented Tabs Switching
document.querySelectorAll('.seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    playSound('click');
    document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const targetId = btn.getAttribute('data-tab');
    document.getElementById('uploadTab').classList.toggle('hidden', targetId !== 'uploadTab');
    document.getElementById('historyTab').classList.toggle('hidden', targetId !== 'historyTab');
    if (targetId === 'historyTab') {
      fetchCloudHistory(true);
    }
  });
});

document.querySelectorAll('[data-sound="pop"]').forEach((el) => {
  el.addEventListener('click', () => playSound('pop'));
});

// ============================================================================
// 4. File Selection, Camera Capture & Drag-and-Drop
// ============================================================================
btnPickFiles.addEventListener('click', (e) => {
  e.stopPropagation();
  playSound('click');
  if (!isUploading) fileInput.click();
});

btnPickGallery.addEventListener('click', (e) => {
  e.stopPropagation();
  playSound('click');
  if (!isUploading) galleryInput.click();
});

btnPickCamera.addEventListener('click', (e) => {
  e.stopPropagation();
  playSound('click');
  if (!isUploading) cameraInput.click();
});

dropZone.addEventListener('click', (e) => {
  if (e.target.closest('.quick-actions')) return;
  playSound('click');
  if (!isUploading) fileInput.click();
});

[fileInput, cameraInput, galleryInput].forEach((inp) => {
  inp.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
      inp.value = '';
    }
  });
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

// ============================================================================
// 5. Queue Management & Animated Rendering
// ============================================================================
function addFilesToQueue(files) {
  playSound('add');
  files.forEach((file) => {
    const id = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

    fileQueue.push({
      id,
      file,
      status: 'pending',
      progress: 0,
      uploadedBytes: 0,
      errorMsg: '',
      fileUrl: '',
      previewUrl
    });
  });

  renderQueue();
  showToast(`✨ เพิ่ม ${files.length} ไฟล์เข้าคิวแล้ว`);
}

function removeFileFromQueue(id) {
  if (isUploading) return;
  playSound('delete');
  const index = fileQueue.findIndex((item) => item.id === id);
  if (index !== -1) {
    if (fileQueue[index].previewUrl) URL.revokeObjectURL(fileQueue[index].previewUrl);
    fileQueue.splice(index, 1);
    renderQueue();
  }
}

clearAllBtn.addEventListener('click', () => {
  if (isUploading) return;
  playSound('delete');
  fileQueue.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  fileQueue = [];
  overallProgressWrap.classList.add('hidden');
  renderQueue();
});

clearCompletedBtn.addEventListener('click', () => {
  if (isUploading) return;
  playSound('click');
  fileQueue = fileQueue.filter((item) => {
    if (item.status === 'success') {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return false;
    }
    return true;
  });
  renderQueue();
});

function renderQueue() {
  queueBadge.textContent = fileQueue.length;
  queueBadge.classList.toggle('hidden', fileQueue.length === 0);

  if (fileQueue.length === 0) {
    queueSection.classList.add('hidden');
    return;
  }

  queueSection.classList.remove('hidden');

  const totalBytes = fileQueue.reduce((acc, item) => acc + item.file.size, 0);
  fileCountText.textContent = `${fileQueue.length} ไฟล์ในคิว`;
  totalSizeText.textContent = formatBytes(totalBytes);

  const hasCompleted = fileQueue.some((item) => item.status === 'success');
  clearCompletedBtn.classList.toggle('hidden', !hasCompleted);

  const pendingOrErrorCount = fileQueue.filter(
    (item) => item.status === 'pending' || item.status === 'error'
  ).length;

  uploadAllBtn.disabled = isUploading || pendingOrErrorCount === 0;
  clearAllBtn.disabled = isUploading;
  uploadBtnText.textContent = isUploading
    ? 'กำลังส่งไฟล์ขึ้น Google Drive...'
    : `เริ่มอัปโหลด (${pendingOrErrorCount} ไฟล์)`;

  fileListEl.innerHTML = '';

  fileQueue.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = `file-item status-${item.status}`;
    li.style.animationDelay = `${Math.min(idx * 0.04, 0.25)}s`;

    const ext = getFileExtension(item.file.name);
    const thumbContent = item.previewUrl
      ? `<img src="${item.previewUrl}" alt="${escapeHtml(item.file.name)}">`
      : escapeHtml(ext || 'FILE');

    let statusHtml = '';
    if (item.status === 'pending') {
      statusHtml = `<span class="badge-state pending">รอส่ง</span>`;
    } else if (item.status === 'uploading') {
      statusHtml = `<span class="badge-state uploading"><span class="spinner"></span><span id="pct_${item.id}">${item.progress}%</span></span>`;
    } else if (item.status === 'success') {
      statusHtml = `
        <span class="badge-state success">✓ สำเร็จ</span>
        ${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" rel="noopener" class="act-link">เปิดดู ↗</a>` : ''}
      `;
    } else if (item.status === 'error') {
      statusHtml = `<span class="badge-state error" title="${escapeHtml(item.errorMsg)}">! ล้มเหลว</span>`;
    }

    const progressBarHtml = item.status === 'uploading'
      ? `<div class="mini-track"><div id="bar_${item.id}" class="mini-fill" style="width:${item.progress}%"></div></div>`
      : '';

    li.innerHTML = `
      <div class="file-main">
        <div class="file-thumb">${thumbContent}</div>
        <div class="file-info">
          <div class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</div>
          <div class="file-sub">
            <span id="meta_${item.id}">${
              item.status === 'uploading'
                ? `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.file.size)}`
                : formatBytes(item.file.size)
            }</span>
            ${item.errorMsg ? `<span style="color:#ef4444;">• ${escapeHtml(item.errorMsg)}</span>` : ''}
          </div>
          ${progressBarHtml}
        </div>
      </div>
      <div class="file-right">
        ${statusHtml}
        ${!isUploading ? `
          <button class="btn-del" title="ลบออก" data-id="${item.id}">✕</button>
        ` : ''}
      </div>
    `;

    const delBtn = li.querySelector('.btn-del');
    if (delBtn) {
      delBtn.addEventListener('click', () => removeFileFromQueue(item.id));
    }

    fileListEl.appendChild(li);
  });
}

function updateFileProgressUI(item, speedBps) {
  const pctEl = document.getElementById(`pct_${item.id}`);
  const barEl = document.getElementById(`bar_${item.id}`);
  const metaEl = document.getElementById(`meta_${item.id}`);

  if (pctEl) pctEl.textContent = `${item.progress}%`;
  if (barEl) barEl.style.width = `${item.progress}%`;
  if (metaEl) metaEl.textContent = `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.file.size)}`;
  if (speedBps && speedText) {
    speedText.textContent = `${formatBytes(speedBps)}/s`;
  }
}

// ============================================================================
// 6. Upload Execution & History Recording
// ============================================================================
uploadAllBtn.addEventListener('click', async () => {
  playSound('pop');
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
      addHistoryRecord(item);
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

  if (successCount > 0) {
    playSound('success');
    launchConfetti();
  }
  showToast(`🎉 อัปโหลดสำเร็จ ${successCount} จาก ${total} ไฟล์!`);
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

  item.progress = 45;
  updateFileProgressUI(item, 0);
  if (onProgress) onProgress(45);

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
    updateFileProgressUI(item, 0);
    item.fileUrl = result.fileUrl || '';
  } else {
    throw new Error(result.message || 'อัปโหลดไม่สำเร็จ');
  }
}

function uploadFileViaXHR(item, uploadUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
        const speedBps = e.loaded / elapsedSec;
        item.progress = pct;
        item.uploadedBytes = e.loaded;
        updateFileProgressUI(item, speedBps);
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
    ? `อัปโหลดเสร็จสมบูรณ์ (${doneFiles}/${totalFiles} ไฟล์)`
    : `กำลังส่งไฟล์ที่ ${doneFiles + 1} จาก ${totalFiles}...`;
  overallPercentText.textContent = `${overallPct}%`;
  overallProgressBar.style.width = `${overallPct}%`;
}

// ============================================================================
// 7. Upload History Tab (Cloud Sync — เก็บเฉพาะชื่อไฟล์บน Cloud ไม่สูญหาย)
// ============================================================================

async function fetchCloudHistory(silent = false) {
  if (!silent && emptyHistoryText) {
    emptyHistoryText.textContent = '☁️ กำลังดึงรายชื่อไฟล์จาก Cloud...';
  }
  try {
    const res = await fetch(CONFIG.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getHistory' })
    });
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.history)) {
      // เก็บเฉพาะชื่อไฟล์และเวลาเท่านั้น
      uploadHistory = data.history.map((h) => ({
        name: String(h.name || ''),
        time: String(h.time || '')
      }));
      localStorage.setItem('drivedrop_history', JSON.stringify(uploadHistory));
      renderHistory();
      if (!silent) showToast('☁️ ซิงค์ประวัติชื่อไฟล์จาก Cloud แล้ว');
    }
  } catch (_) {
    if (emptyHistoryText && uploadHistory.length === 0) {
      emptyHistoryText.textContent = 'ยังไม่มีประวัติชื่อไฟล์บน Cloud';
    }
  }
}

async function addHistoryRecord(item) {
  const onlyNameRecord = {
    name: String(item.file.name),
    time: new Date().toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  };

  // อัปเดตหน้าเว็บทันที (เฉพาะชื่อไฟล์เท่านั้น)
  uploadHistory.unshift(onlyNameRecord);
  uploadHistory = uploadHistory.slice(0, 150);
  localStorage.setItem('drivedrop_history', JSON.stringify(uploadHistory));
  renderHistory();

  // บันทึกเฉพาะชื่อไฟล์ขึ้น Cloud
  try {
    const res = await fetch(CONFIG.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'logHistory',
        fileName: item.file.name
      })
    });
    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.history)) {
      uploadHistory = data.history.map((h) => ({
        name: String(h.name || ''),
        time: String(h.time || '')
      }));
      localStorage.setItem('drivedrop_history', JSON.stringify(uploadHistory));
      renderHistory();
    }
  } catch (_) {}
}

function renderHistory() {
  historyBadge.textContent = uploadHistory.length;
  historyBadge.classList.toggle('hidden', uploadHistory.length === 0);
  emptyHistoryEl.classList.toggle('hidden', uploadHistory.length > 0);
  if (emptyHistoryText && uploadHistory.length === 0) {
    emptyHistoryText.textContent = 'ยังไม่มีประวัติชื่อไฟล์บน Cloud';
  }
  historyListEl.innerHTML = '';

  uploadHistory.forEach((rec) => {
    const li = document.createElement('li');
    li.className = 'file-item status-success';
    const ext = getFileExtension(rec.name);
    li.innerHTML = `
      <div class="file-main">
        <div class="file-thumb">${escapeHtml(ext)}</div>
        <div class="file-info">
          <div class="file-name" title="${escapeHtml(rec.name)}">${escapeHtml(rec.name)}</div>
          <div class="file-sub">
            <span>☁️ บันทึกชื่อบน Cloud</span>
            ${rec.time ? `<span>•</span><span>${escapeHtml(rec.time)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="file-right">
        <span class="badge-state success">✓ ส่งแล้ว</span>
      </div>
    `;
    historyListEl.appendChild(li);
  });
}

if (refreshHistoryBtn) {
  refreshHistoryBtn.addEventListener('click', () => {
    playSound('pop');
    fetchCloudHistory(false);
  });
}

clearHistoryBtn.addEventListener('click', async () => {
  playSound('delete');
  uploadHistory = [];
  localStorage.removeItem('drivedrop_history');
  renderHistory();
  showToast('กำลังล้างประวัติบน Cloud...');
  try {
    await fetch(CONFIG.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'clearHistory' })
    });
    showToast('☁️ ล้างประวัติชื่อไฟล์บน Cloud เรียบร้อย');
  } catch (_) {}
});

// ซิงค์ประวัติชื่อไฟล์จาก Cloud อัตโนมัติเมื่อเปิดหน้าเว็บ
fetchCloudHistory(true);

// ============================================================================
// Helpers
// ============================================================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
  const parts = String(filename).split('.');
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
  }, 3200);
}
// ============================================================================
// 8. Basketball Shoot-to-Upload Mini-Game ("ชู้ตบาสเข้าห่วง = อัปโหลดไฟล์ทันที!")
// ============================================================================
const openBasketBtn = document.getElementById('openBasketBtn');
const shootToUploadBtn = document.getElementById('shootToUploadBtn');
const closeBasketBtn = document.getElementById('closeBasketBtn');
const basketModal = document.getElementById('basketModal');
const basketCanvas = document.getElementById('basketCanvas');
const bCtx = basketCanvas.getContext('2d');

const bScoreEl = document.getElementById('bScore');
const bStreakEl = document.getElementById('bStreak');
const bQueueCountEl = document.getElementById('bQueueCount');
const bAddFileBtn = document.getElementById('bAddFileBtn');
const bQuickShootBtn = document.getElementById('bQuickShootBtn');
const basketStatusMsg = document.getElementById('basketStatusMsg');

let bGameOpen = false;
let bScore = 0;
let bStreak = 0;
let netStretch = 0;
let floatingTexts = [];

const hoop = {
  x: 455,
  y: 135,
  rimRadius: 39,
  leftRimX: 416,
  rightRimX: 494,
  backboardX: 502,
  backboardTop: 60,
  backboardBottom: 155
};

const ball = {
  startX: 105,
  startY: 235,
  x: 105,
  y: 235,
  vx: 0,
  vy: 0,
  r: 20,
  angle: 0,
  vAngle: 0,
  inFlight: false,
  scoredThisShot: false,
  prevY: 235
};

let dragState = {
  active: false,
  startX: 0,
  startY: 0,
  currX: 0,
  currY: 0
};

function updateBasketQueueCount() {
  const pendingCount = fileQueue.filter((i) => i.status === 'pending' || i.status === 'error').length;
  if (bQueueCountEl) bQueueCountEl.textContent = pendingCount;
}

function openBasketballGame() {
  playSound('pop');
  updateBasketQueueCount();
  resetBall();
  bGameOpen = true;
  basketModal.classList.remove('hidden');
}

function closeBasketballGame() {
  playSound('click');
  bGameOpen = false;
  basketModal.classList.add('hidden');
}

if (openBasketBtn) openBasketBtn.addEventListener('click', openBasketballGame);
if (shootToUploadBtn) shootToUploadBtn.addEventListener('click', openBasketballGame);
if (closeBasketBtn) closeBasketBtn.addEventListener('click', closeBasketballGame);

basketModal.addEventListener('click', (e) => {
  if (e.target === basketModal) closeBasketballGame();
});

if (bAddFileBtn) {
  bAddFileBtn.addEventListener('click', () => {
    playSound('click');
    if (!isUploading) fileInput.click();
  });
}

if (bQuickShootBtn) {
  bQuickShootBtn.addEventListener('click', () => {
    resetBall();
    const frames = 48;
    const vx = (hoop.x - ball.x) / frames;
    const vy = (hoop.y - ball.y - 0.38 * (frames * (frames - 1)) / 2) / frames;
    shootBallWithVelocity(vx, vy);
  });
}

function resetBall() {
  ball.x = ball.startX;
  ball.y = ball.startY;
  ball.prevY = ball.startY;
  ball.vx = 0;
  ball.vy = 0;
  ball.vAngle = 0;
  ball.inFlight = false;
  ball.scoredThisShot = false;
  updateBasketQueueCount();
}

function shootBallWithVelocity(vx, vy) {
  playSound('pop');
  ball.vx = vx;
  ball.vy = vy;
  ball.vAngle = vx * 0.04;
  ball.inFlight = true;
  ball.scoredThisShot = false;
}

function getCanvasCoords(e) {
  const rect = basketCanvas.getBoundingClientRect();
  const scaleX = basketCanvas.width / rect.width;
  const scaleY = basketCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

basketCanvas.addEventListener('pointerdown', (e) => {
  if (ball.inFlight) {
    resetBall();
  }
  const pt = getCanvasCoords(e);
  dragState.active = true;
  dragState.startX = pt.x;
  dragState.startY = pt.y;
  dragState.currX = pt.x;
  dragState.currY = pt.y;
  basketCanvas.setPointerCapture(e.pointerId);
});

basketCanvas.addEventListener('pointermove', (e) => {
  if (!dragState.active) return;
  const pt = getCanvasCoords(e);
  dragState.currX = pt.x;
  dragState.currY = pt.y;
});

basketCanvas.addEventListener('pointerup', (e) => {
  if (!dragState.active) return;
  dragState.active = false;
  const pt = getCanvasCoords(e);
  const dx = pt.x - dragState.startX;
  const dy = pt.y - dragState.startY;
  const dragDist = Math.hypot(dx, dy);

  // หากแตะเฉยๆ หรือแตะที่แป้น ให้คำนวณวิถีโค้งสูงเข้ากลางห่วงอย่างแม่นยำ
  if (dragDist < 14) {
    const targetX = pt.x > 220 ? pt.x : hoop.x;
    const targetY = pt.x > 220 ? Math.max(80, Math.min(pt.y, hoop.y + 10)) : hoop.y;
    const frames = 48;
    const vx = (targetX - ball.x) / frames;
    const vy = (targetY - ball.y - 0.38 * (frames * (frames - 1)) / 2) / frames;
    shootBallWithVelocity(vx, vy);
    return;
  }

  // รองรับทั้งลากแบบง้างหนังสติ๊ก (ดึงถอยหลัง) และลากปัดไปข้างหน้า (Flick)
  let vx, vy;
  if (dx < 0) {
    // ดึงแบบหนังสติ๊ก
    vx = Math.min(14.5, Math.max(5.5, -dx * 0.11));
    vy = Math.max(-16, Math.min(-7, -dy * 0.11 - 3));
  } else {
    // ปัดไปข้างหน้า
    vx = Math.min(14.5, Math.max(5.5, dx * 0.085 + 4));
    vy = Math.max(-16, Math.min(-7, dy * 0.085 - 8.5));
  }
  shootBallWithVelocity(vx, vy);
});

function computeLaunchVelocityFromDrag() {
  const dx = dragState.currX - dragState.startX;
  const dy = dragState.currY - dragState.startY;
  if (Math.hypot(dx, dy) < 12) return { vx: 8.75, vy: -9.91 };
  if (dx < 0) {
    return {
      vx: Math.min(14.5, Math.max(5.5, -dx * 0.11)),
      vy: Math.max(-16, Math.min(-7, -dy * 0.11 - 3))
    };
  }
  return {
    vx: Math.min(14.5, Math.max(5.5, dx * 0.085 + 4)),
    vy: Math.max(-16, Math.min(-7, dy * 0.085 - 8.5))
  };
}

function onBasketScored() {
  bScore++;
  bStreak++;
  netStretch = 16;
  bScoreEl.textContent = bScore;
  bStreakEl.textContent = bStreak;

  playSound('success');
  launchConfetti();

  const pendingTargets = fileQueue.filter((item) => item.status === 'pending' || item.status === 'error');

  if (pendingTargets.length > 0 && !isUploading) {
    floatingTexts.push({
      x: hoop.x - 20,
      y: hoop.y - 25,
      text: `🏀 SWISH! ส่ง ${pendingTargets.length} ไฟล์ขึ้น Drive! 🚀`,
      life: 1.0,
      color: '#34d399'
    });
    basketStatusMsg.textContent = `🔥 ชู้ตลงห่วงแล้ว! กำลังอัปโหลด ${pendingTargets.length} ไฟล์เข้า Google Drive ทันที!`;
    uploadAllBtn.click();
  } else if (isUploading) {
    floatingTexts.push({
      x: hoop.x - 10,
      y: hoop.y - 25,
      text: `🔥 SWISH! +1 (กำลังอัปโหลด...)`,
      life: 1.0,
      color: '#38bdf8'
    });
  } else {
    floatingTexts.push({
      x: hoop.x - 10,
      y: hoop.y - 25,
      text: `🏀 SWISH! +1 แต้ม!`,
      life: 1.0,
      color: '#fbbf24'
    });
    basketStatusMsg.textContent = `🎯 แม่นมาก! เลือกไฟล์ใส่คิวแล้วชู้ตแบบนี้เพื่ออัปโหลดเข้า Google Drive ได้เลย!`;
  }
}

function updateBasketballPhysics() {
  if (netStretch > 0) netStretch *= 0.88;

  if (!ball.inFlight) return;

  ball.prevY = ball.y;
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vy += 0.38; // Gravity
  ball.angle += ball.vAngle;

  // ชนแป้นบาส (Backboard)
  if (
    ball.x + ball.r >= hoop.backboardX &&
    ball.x - ball.r <= hoop.backboardX + 12 &&
    ball.y >= hoop.backboardTop &&
    ball.y <= hoop.backboardBottom &&
    ball.vx > 0
  ) {
    ball.x = hoop.backboardX - ball.r;
    ball.vx = -ball.vx * 0.62;
    playSound('click');
  }

  // ชนขอบห่วงซ้ายและขวา
  [
    { rx: hoop.leftRimX, ry: hoop.y },
    { rx: hoop.rightRimX, ry: hoop.y }
  ].forEach((rim) => {
    const dx = ball.x - rim.rx;
    const dy = ball.y - rim.ry;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.r + 4;
    if (dist < minDist && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = rim.rx + nx * minDist;
      ball.y = rim.ry + ny * minDist;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * 0.68;
      ball.vy = (ball.vy - 2 * dot * ny) * 0.68;
      playSound('click');
    }
  });

  // ตรวจจับลูกบาสลอดห่วงลงมา (Swish!)
  if (
    !ball.scoredThisShot &&
    ball.vy > 0 &&
    ball.prevY <= hoop.y &&
    ball.y >= hoop.y &&
    ball.x > hoop.leftRimX + 8 &&
    ball.x < hoop.rightRimX - 8
  ) {
    ball.scoredThisShot = true;
    onBasketScored();
  }

  // ตกพื้นสนาม
  const floorY = 305;
  if (ball.y + ball.r > floorY) {
    ball.y = floorY - ball.r;
    ball.vy = -ball.vy * 0.55;
    ball.vx *= 0.78;
    if (Math.abs(ball.vy) < 1.5 || ball.x > basketCanvas.width + 40 || ball.x < -40) {
      if (!ball.scoredThisShot) {
        bStreak = 0;
        bStreakEl.textContent = '0';
      }
      ball.inFlight = false;
      setTimeout(() => {
        if (!ball.inFlight) resetBall();
      }, 420);
    }
  }

  if (ball.x > basketCanvas.width + 60 || ball.x < -60) {
    if (!ball.scoredThisShot) {
      bStreak = 0;
      bStreakEl.textContent = '0';
    }
    resetBall();
  }
}

function drawBasketballCourt() {
  if (!bGameOpen) {
    requestAnimationFrame(drawBasketballCourt);
    return;
  }

  updateBasketballPhysics();
  bCtx.clearRect(0, 0, basketCanvas.width, basketCanvas.height);

  // พื้นสนาม
  bCtx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  bCtx.lineWidth = 2;
  bCtx.beginPath();
  bCtx.moveTo(0, 305);
  bCtx.lineTo(basketCanvas.width, 305);
  bCtx.stroke();

  // เส้นโค้งเล็งเป้าหมายขณะกำลังลาก
  if (dragState.active && !ball.inFlight) {
    const { vx, vy } = computeLaunchVelocityFromDrag();
    bCtx.save();
    for (let t = 2; t <= 36; t += 2.5) {
      const px = ball.x + vx * t;
      const py = ball.y + vy * t + 0.5 * 0.38 * t * t;
      if (py > 305) break;
      bCtx.beginPath();
      bCtx.arc(px, py, 3.2, 0, Math.PI * 2);
      bCtx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.15, 0.85 - t * 0.02)})`;
      bCtx.fill();
    }
    bCtx.restore();
  }

  // เสาและแป้นบาส Google Drive Cloud
  bCtx.strokeStyle = '#64748b';
  bCtx.lineWidth = 6;
  bCtx.beginPath();
  bCtx.moveTo(525, 110);
  bCtx.lineTo(525, 305);
  bCtx.moveTo(500, 110);
  bCtx.lineTo(525, 110);
  bCtx.stroke();

  // แป้นบาส
  bCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  bCtx.strokeStyle = '#38bdf8';
  bCtx.lineWidth = 4;
  bCtx.beginPath();
  bCtx.roundRect(hoop.backboardX, hoop.backboardTop, 8, hoop.backboardBottom - hoop.backboardTop, 4);
  bCtx.fill();
  bCtx.stroke();

  // ป้าย "GOOGLE DRIVE HOOP" บนแป้น
  bCtx.fillStyle = 'rgba(56, 189, 248, 0.9)';
  bCtx.font = '600 11px Prompt, sans-serif';
  bCtx.textAlign = 'center';
  bCtx.fillText('☁️ DRIVE HOOP', hoop.x, hoop.backboardTop - 10);

  // ตาข่ายบาส (ยืดหดได้เมื่อชู้ตลง)
  const netBottomY = hoop.y + 38 + netStretch;
  bCtx.strokeStyle = 'rgba(241, 245, 249, 0.72)';
  bCtx.lineWidth = 1.6;
  for (let i = 0; i <= 5; i++) {
    const topX = hoop.leftRimX + (i / 5) * (hoop.rightRimX - hoop.leftRimX);
    const botX = hoop.leftRimX + 10 + (i / 5) * (hoop.rightRimX - hoop.leftRimX - 20);
    bCtx.beginPath();
    bCtx.moveTo(topX, hoop.y);
    bCtx.lineTo(botX, netBottomY);
    bCtx.stroke();
  }
  bCtx.beginPath();
  bCtx.moveTo(hoop.leftRimX + 6, hoop.y + 18 + netStretch * 0.4);
  bCtx.lineTo(hoop.rightRimX - 6, hoop.y + 18 + netStretch * 0.4);
  bCtx.moveTo(hoop.leftRimX + 10, netBottomY);
  bCtx.lineTo(hoop.rightRimX - 10, netBottomY);
  bCtx.stroke();

  // ห่วงบาสสีส้ม
  bCtx.strokeStyle = '#f97316';
  bCtx.lineWidth = 5;
  bCtx.beginPath();
  bCtx.moveTo(hoop.leftRimX, hoop.y);
  bCtx.lineTo(hoop.rightRimX, hoop.y);
  bCtx.stroke();

  // วาดลูกบาสเกตบอล
  bCtx.save();
  bCtx.translate(ball.x, ball.y);
  bCtx.rotate(ball.angle);

  const grad = bCtx.createRadialGradient(-6, -6, 3, 0, 0, ball.r);
  grad.addColorStop(0, '#fb923c');
  grad.addColorStop(1, '#ea580c');
  bCtx.beginPath();
  bCtx.arc(0, 0, ball.r, 0, Math.PI * 2);
  bCtx.fillStyle = grad;
  bCtx.fill();
  bCtx.lineWidth = 2;
  bCtx.strokeStyle = '#7c2d12';
  bCtx.stroke();

  // ลายเส้นลูกบาส
  bCtx.beginPath();
  bCtx.moveTo(-ball.r, 0);
  bCtx.lineTo(ball.r, 0);
  bCtx.moveTo(0, -ball.r);
  bCtx.lineTo(0, ball.r);
  bCtx.stroke();
  bCtx.restore();

  // ป้ายบอกจำนวนไฟล์บนลูกบาส
  const pendingCount = fileQueue.filter((i) => i.status === 'pending' || i.status === 'error').length;
  if (pendingCount > 0 && !ball.inFlight) {
    bCtx.fillStyle = '#38bdf8';
    bCtx.font = '600 12px Prompt, sans-serif';
    bCtx.textAlign = 'center';
    bCtx.fillText(`📦 ${pendingCount} ไฟล์พร้อมชู้ต!`, ball.x, ball.y - 30);
  }

  // ข้อความลอยเวลามีแต้ม
  floatingTexts = floatingTexts.filter((ft) => ft.life > 0.02);
  for (const ft of floatingTexts) {
    ft.y -= 0.9;
    ft.life -= 0.016;
    bCtx.save();
    bCtx.globalAlpha = Math.max(0, ft.life);
    bCtx.fillStyle = ft.color;
    bCtx.font = '700 15px Prompt, sans-serif';
    bCtx.textAlign = 'center';
    bCtx.fillText(ft.text, ft.x, ft.y);
    bCtx.restore();
  }

  requestAnimationFrame(drawBasketballCourt);
}
drawBasketballCourt();

// ซิงค์ตัวเลขจำนวนไฟล์ในเกมทุกครั้งที่คิวอัปเดต
const _origRenderQueue = renderQueue;
renderQueue = function () {
  _origRenderQueue();
  updateBasketQueueCount();
};
