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
// 7. Upload History Tab
// ============================================================================
function addHistoryRecord(item) {
  uploadHistory.unshift({
    name: item.file.name,
    size: item.file.size,
    url: item.fileUrl || `https://drive.google.com/drive/u/4/folders/${CONFIG.folderId}`,
    time: new Date().toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
  });
  uploadHistory = uploadHistory.slice(0, 30);
  localStorage.setItem('drivedrop_history', JSON.stringify(uploadHistory));
  renderHistory();
}

function renderHistory() {
  historyBadge.textContent = uploadHistory.length;
  historyBadge.classList.toggle('hidden', uploadHistory.length === 0);
  emptyHistoryEl.classList.toggle('hidden', uploadHistory.length > 0);
  historyListEl.innerHTML = '';

  uploadHistory.forEach((rec) => {
    const li = document.createElement('li');
    li.className = 'file-item status-success';
    const ext = getFileExtension(rec.name);
    li.innerHTML = `
      <div class="file-main">
        <div class="file-thumb">${escapeHtml(ext)}</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(rec.name)}</div>
          <div class="file-sub">
            <span>${formatBytes(rec.size)}</span>
            <span>•</span>
            <span>${escapeHtml(rec.time)}</span>
          </div>
        </div>
      </div>
      <div class="file-right">
        <a href="${rec.url}" target="_blank" rel="noopener" class="act-link">เปิดดู ↗</a>
      </div>
    `;
    historyListEl.appendChild(li);
  });
}

clearHistoryBtn.addEventListener('click', () => {
  playSound('delete');
  uploadHistory = [];
  localStorage.removeItem('drivedrop_history');
  renderHistory();
  showToast('ล้างประวัติการอัปโหลดเรียบร้อย');
});

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
