(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ui = {
    video: $('camera-video'), finder: $('viewfinder'), startPanel: $('start-panel'),
    startTitle: $('start-title'), startDescription: $('start-description'),
    startButton: $('start-button'), startLabel: $('start-label'),
    stopButton: $('stop-button'), stopLabel: $('stop-label'),
    captureButton: $('capture-button'), switchButton: $('switch-button'),
    liveMeta: $('live-meta'), footer: $('finder-footer'), cameraLabel: $('camera-label'),
    resolution: $('resolution'), status: $('capture-status'), processing: $('processing-indicator'),
    flash: $('capture-flash'), lastButton: $('last-photo-button'), thumbnail: $('thumbnail'),
    placeholder: $('thumbnail-placeholder'), photoDialog: $('photo-dialog'),
    photoPreview: $('photo-preview-image'), photoTime: $('photo-time'),
    photoDimensions: $('photo-dimensions'), filename: $('photo-filename'),
    photoFeedback: $('photo-feedback'), download: $('download-button'), share: $('share-button'),
    downloadLabel: $('download-label'), shareLabel: $('share-label'), saveNote: $('photo-save-note'),
    helpDialog: $('help-dialog'), saveMode: $('save-mode-text'),
  };

  // Use device detection only to choose the save flow; camera/share APIs are feature-detected.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const browserName = isIOS ? 'Safari' : 'Chrome';
  const readyMessage = isIOS ? '撮影できます · 撮影後に写真を保存' : '撮影できます · JPEGを自動保存';
  document.body.dataset.platform = isIOS ? 'ios' : 'other';
  ui.video.muted = true;
  ui.video.defaultMuted = true;
  ui.video.playsInline = true;
  ui.video.setAttribute('playsinline', '');
  if (isIOS) {
    ui.saveMode.textContent = '撮影後の画面から「写真」に保存';
    ui.captureButton.setAttribute('aria-label', '写真を撮影して保存画面を開く');
    ui.shareLabel.textContent = '写真に保存';
    ui.downloadLabel.textContent = 'ファイルに保存';
    ui.saveNote.textContent = '画像を長押しして保存することもできます。「写真に保存」は共有画面を開きます。';
    $('iphone-save-steps').hidden = false;
    $('android-save-steps').hidden = true;
  }

  const state = {
    phase: 'idle', stream: null, facing: 'environment', requestId: 0,
    last: null, capturing: false, shotCount: 0, sharing: false,
  };
  let statusTimer = null;
  let flashTimer = null;
  let activeReadinessCancel = null;
  const downloadUrls = new Set();
  const webMcpLifecycle = new AbortController();

  function stopTracks(stream) {
    if (stream) stream.getTracks().forEach((track) => track.stop());
  }

  function ready() {
    return state.phase === 'live' && !document.hidden &&
      state.stream?.getVideoTracks().some((track) => track.readyState === 'live') &&
      ui.video.readyState >= 2 && ui.video.videoWidth > 0 && ui.video.videoHeight > 0;
  }

  function updateControls() {
    const live = state.phase === 'live';
    const starting = state.phase === 'starting';
    const hasFrame = ready();
    ui.finder.dataset.phase = state.phase;
    ui.startPanel.hidden = live;
    ui.liveMeta.hidden = !live;
    ui.footer.hidden = !live;
    ui.startButton.disabled = starting;
    ui.stopButton.disabled = !live && !starting;
    ui.stopLabel.textContent = starting ? 'キャンセル' : '停止';
    ui.captureButton.disabled = !hasFrame || state.capturing;
    ui.switchButton.disabled = !live || state.capturing;
    ui.lastButton.disabled = !state.last || state.capturing;
    ui.processing.hidden = !state.capturing;
    ui.captureButton.setAttribute('aria-busy', String(state.capturing));
    if (hasFrame) ui.resolution.textContent = `${ui.video.videoWidth} × ${ui.video.videoHeight}`;
    ui.cameraLabel.textContent = state.facing === 'user' ? '前面カメラ' : '背面カメラ';
  }

  function showStatus(message, tone = 'normal', temporary = false) {
    clearTimeout(statusTimer);
    ui.status.textContent = message;
    ui.status.dataset.tone = tone;
    if (temporary) {
      statusTimer = setTimeout(() => {
        if (state.phase === 'live' && !state.capturing) {
          ui.status.textContent = readyMessage;
          ui.status.dataset.tone = 'normal';
        }
      }, 5000);
    }
  }

  function setStartPanel(title, description, buttonLabel = 'カメラを起動する') {
    ui.startTitle.textContent = title;
    ui.startDescription.textContent = description;
    ui.startLabel.textContent = buttonLabel;
  }

  function releaseCurrentStream() {
    activeReadinessCancel?.();
    activeReadinessCancel = null;
    stopTracks(state.stream);
    state.stream = null;
    ui.video.pause();
    ui.video.srcObject = null;
  }

  function stopCamera(reason = 'カメラを停止しました') {
    state.requestId += 1;
    state.phase = 'idle';
    releaseCurrentStream();
    setStartPanel('カメラは停止中', '再開するとカメラの映像が表示されます。', 'カメラを再開する');
    updateControls();
    showStatus(reason);
  }

  function cameraError(error) {
    const name = error?.name;
    if (!window.isSecureContext) {
      return ['HTTPSで開いてください', `カメラは安全な接続で利用できます。サイトのHTTPSのURLを${browserName}で開いてください。`];
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return ['カメラの許可が必要です', isIOS
        ? 'SafariのページメニューのWebサイト設定で、カメラを許可してください。許可できない場合は、iPhoneの設定でSafariのカメラ権限を確認してください。'
        : 'Chromeのアドレスバーのサイト設定でカメラを許可してください。許可済みならAndroidの設定でChromeのカメラ権限も確認してください。'];
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return ['カメラが見つかりません', `カメラを使える端末で、${browserName}からこのページを開いてください。`];
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return ['カメラを開始できませんでした', 'ほかのカメラアプリを閉じてから、もう一度お試しください。'];
    }
    if (name === 'TimeoutError') {
      return ['カメラの映像を取得できません', 'カメラの使用を許可して、もう一度お試しください。'];
    }
    return ['カメラを開始できませんでした', `${isIOS ? 'iPhoneのSafari' : 'AndroidのChrome'}で開き、カメラの使用を許可してから再度お試しください。`];
  }

  function waitForFrame() {
    return new Promise((resolve, reject) => {
      let timeout;
      let frameToken;
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        ui.video.removeEventListener('loadeddata', check);
        ui.video.removeEventListener('playing', check);
        ui.video.removeEventListener('resize', check);
        if (frameToken != null && ui.video.cancelVideoFrameCallback) ui.video.cancelVideoFrameCallback(frameToken);
        activeReadinessCancel = null;
        if (error) reject(error); else resolve();
      };
      const check = () => {
        if (ui.video.readyState >= 2 && ui.video.videoWidth > 0 && ui.video.videoHeight > 0) finish();
      };
      activeReadinessCancel = () => finish(new DOMException('Camera stopped', 'AbortError'));
      ui.video.addEventListener('loadeddata', check);
      ui.video.addEventListener('playing', check);
      ui.video.addEventListener('resize', check);
      timeout = setTimeout(() => finish(new DOMException('Camera frame timed out', 'TimeoutError')), 15000);
      if (ui.video.requestVideoFrameCallback) frameToken = ui.video.requestVideoFrameCallback(check);
      check();
    });
  }

  async function startCamera(facing = state.facing) {
    if (document.hidden || state.capturing) return;
    const token = ++state.requestId;
    releaseCurrentStream();
    state.phase = 'starting';
    setStartPanel('カメラに接続中', '確認が表示されたら、カメラの使用を許可してください。', '接続しています…');
    showStatus('カメラを準備しています');
    updateControls();

    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        throw new DOMException('Camera unavailable', 'NotSupportedError');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 24, max: 30 } },
        });
      } catch (error) {
        if (token !== state.requestId || document.hidden) return;
        if (error.name !== 'OverconstrainedError') throw error;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing } } });
      }
      if (token !== state.requestId || document.hidden) {
        stopTracks(stream);
        return;
      }
      state.stream = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) throw new DOMException('No video track', 'NotFoundError');
      const actualFacing = track.getSettings?.().facingMode;
      state.facing = actualFacing === 'user' || actualFacing === 'environment' ? actualFacing : facing;
      track.addEventListener('ended', () => {
        if (state.stream === stream) stopCamera('カメラとの接続が終了しました。再開できます。');
      }, { once: true });
      ui.video.srcObject = stream;
      await ui.video.play();
      if (token !== state.requestId) return;
      await waitForFrame();
      if (token !== state.requestId || document.hidden) return;
      state.phase = 'live';
      updateControls();
      showStatus(readyMessage);
    } catch (error) {
      if (token !== state.requestId) return;
      releaseCurrentStream();
      state.phase = 'error';
      const [title, message] = cameraError(error);
      setStartPanel(title, message, 'もう一度試す');
      updateControls();
      showStatus(title, 'error');
    }
  }

  function makeFilename(date) {
    const pad = (value, length = 2) => String(value).padStart(length, '0');
    return `SHIZUKA_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}_${pad(date.getMilliseconds(), 3)}.jpg`;
  }

  function encodeJpeg(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob?.size > 0 && blob.type === 'image/jpeg') resolve(blob);
        else reject(new Error('JPEG encoding failed'));
      }, 'image/jpeg', 0.95);
    });
  }

  function canSharePhoto(photo) {
    if (!photo || !navigator.share || !navigator.canShare) return false;
    try { return navigator.canShare({ files: [photo.file] }); } catch { return false; }
  }

  function makePreviewUrl(blob, fallbackUrl) {
    if (!isIOS || typeof FileReader === 'undefined') return Promise.resolve(fallbackUrl);
    // A real JPEG data source also supports Safari's image long-press save menu.
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : fallbackUrl);
      reader.onerror = reader.onabort = () => resolve(fallbackUrl);
      try { reader.readAsDataURL(blob); } catch { resolve(fallbackUrl); }
    });
  }

  function photoSaveInstructions(photo) {
    if (!isIOS) return '保存できていない場合は、もう一度保存してください。';
    return canSharePhoto(photo)
      ? '「写真に保存」を押し、共有画面で「画像を保存」を選んでください。'
      : '写真を長押しして「画像を保存」や「写真に保存」を選んでください。';
  }

  function startDownload(photo) {
    if (!photo) throw new Error('No photo');
    const url = URL.createObjectURL(photo.blob);
    downloadUrls.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = photo.filename;
    link.rel = 'noopener';
    link.hidden = true;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      // Keep a separate URL alive long enough for Android's download confirmation.
      setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 120000);
    }
    return { requested: true, filename: photo.filename };
  }

  function presentPhoto(photo) {
    ui.thumbnail.src = photo.url;
    ui.thumbnail.hidden = false;
    ui.placeholder.hidden = true;
    ui.photoPreview.src = photo.previewUrl;
    ui.photoTime.textContent = photo.date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    ui.photoDimensions.textContent = `${photo.width} × ${photo.height} · ${(photo.blob.size / 1024 / 1024).toFixed(1)} MB`;
    ui.filename.textContent = photo.filename;
    ui.share.hidden = !canSharePhoto(photo);
    if (isIOS) {
      ui.share.classList.remove('secondary');
      ui.share.classList.add('primary');
      ui.download.classList.remove('primary', 'secondary');
      ui.download.classList.add(ui.share.hidden ? 'primary' : 'secondary');
      ui.saveNote.textContent = ui.share.hidden
        ? '「ファイルに保存」は「ファイル」アプリへのダウンロードです。写真アプリへの保存は画像を長押ししてください。'
        : '画像を長押しして保存することもできます。「写真に保存」は共有画面を開きます。';
    }
    ui.photoFeedback.textContent = photoSaveInstructions(photo);
  }

  async function capturePhoto() {
    if (!ready() || state.capturing) return;
    state.capturing = true;
    updateControls();
    const canvas = document.createElement('canvas');
    let captured = false;
    let downloadRequested = false;
    try {
      const width = ui.video.videoWidth;
      const height = ui.video.videoHeight;
      const date = new Date();
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas is unavailable');
      // Capture exactly the visible, unmirrored stream. No native still-photo API.
      context.drawImage(ui.video, 0, 0, width, height);
      clearTimeout(flashTimer);
      ui.flash.classList.remove('flash');
      void ui.flash.offsetWidth;
      ui.flash.classList.add('flash');
      flashTimer = setTimeout(() => ui.flash.classList.remove('flash'), 250);
      const blob = await encodeJpeg(canvas);
      const filename = makeFilename(date);
      const photo = { blob, filename, date, width, height, url: URL.createObjectURL(blob),
        file: new File([blob], filename, { type: 'image/jpeg', lastModified: date.getTime() }) };
      photo.previewUrl = await makePreviewUrl(blob, photo.url);
      const old = state.last;
      state.last = photo;
      state.shotCount += 1;
      presentPhoto(photo);
      if (old) URL.revokeObjectURL(old.url);
      captured = true;
      if (isIOS) {
        showStatus('撮影しました · 保存操作を選んでください', 'success');
        // A separate tap preserves user activation for Safari's native share sheet.
        if (!document.hidden) openPhoto();
      } else {
        try {
          startDownload(photo);
          downloadRequested = true;
          showStatus('保存を開始しました · 確認が出たら許可', 'success', true);
        } catch {
          showStatus('撮影しました。直前の写真から保存してください。', 'error');
          ui.photoFeedback.textContent = '自動保存を開始できませんでした。もう一度保存してください。';
        }
      }
    } catch {
      showStatus('撮影できませんでした。もう一度お試しください。', 'error');
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      state.capturing = false;
      updateControls();
    }
    return captured ? { captured: true, downloadRequested } : { captured: false };
  }

  function openDialog(dialog, opener) {
    if (dialog.open) return;
    dialog.showModal();
    dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }), { once: true });
  }

  function openPhoto() {
    if (state.last) openDialog(ui.photoDialog, ui.lastButton);
  }

  async function sharePhoto() {
    if (!state.last || state.sharing) return;
    if (!canSharePhoto(state.last)) {
      ui.photoFeedback.textContent = isIOS
        ? '共有できません。表示中の写真を長押しして保存してください。'
        : 'このブラウザでは共有できません。「もう一度保存」を使ってください。';
      return;
    }
    state.sharing = true;
    ui.share.disabled = true;
    try {
      await navigator.share({ files: [state.last.file] });
      ui.photoFeedback.textContent = isIOS
        ? '共有操作が終了しました。「写真」アプリで保存を確認してください。'
        : '選んだアプリに写真を渡しました。保存操作はそのアプリで完了してください。';
    } catch (error) {
      ui.photoFeedback.textContent = error.name === 'AbortError'
        ? '共有を閉じました。写真はもう一度保存できます。'
        : isIOS ? '共有できませんでした。写真を長押しして保存するか、「ファイルに保存」をお試しください。'
          : '共有できませんでした。「もう一度保存」を使ってください。';
    } finally {
      state.sharing = false;
      ui.share.disabled = false;
    }
  }

  ui.startButton.addEventListener('click', () => { void startCamera(); });
  ui.stopButton.addEventListener('click', () => stopCamera());
  ui.captureButton.addEventListener('click', () => { void capturePhoto(); });
  ui.switchButton.addEventListener('click', () => { void startCamera(state.facing === 'user' ? 'environment' : 'user'); });
  ui.lastButton.addEventListener('click', openPhoto);
  ui.download.addEventListener('click', () => {
    try {
      startDownload(state.last);
      ui.photoFeedback.textContent = isIOS
        ? 'ダウンロードを開始しました。保存先は「ファイル」アプリで確認してください。「写真」への保存は「写真に保存」または画像の長押しを使ってください。'
        : 'ダウンロードを開始しました。確認が表示されたら許可してください。';
    } catch {
      ui.photoFeedback.textContent = isIOS ? '保存を開始できませんでした。写真を長押しして保存してください。'
        : '保存を開始できませんでした。「フォトなどに送る」が表示されている場合は、そちらをお試しください。';
    }
  });
  ui.share.addEventListener('click', () => { void sharePhoto(); });
  $('close-photo').addEventListener('click', () => ui.photoDialog.close());
  $('help-button').addEventListener('click', () => openDialog(ui.helpDialog, $('help-button')));
  $('save-guide-button').addEventListener('click', () => openDialog(ui.helpDialog, $('save-guide-button')));
  $('close-help').addEventListener('click', () => ui.helpDialog.close());
  $('help-done').addEventListener('click', () => ui.helpDialog.close());
  [ui.helpDialog, ui.photoDialog].forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  ui.video.addEventListener('resize', updateControls);
  ui.video.addEventListener('loadeddata', updateControls);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state.stream || state.phase === 'starting')) {
      stopCamera('ページを離れたため停止しました。再開できます。');
    }
  });
  window.addEventListener('pagehide', (event) => {
    stopCamera();
    clearTimeout(statusTimer);
    clearTimeout(flashTimer);
    if (!event.persisted) {
      if (state.last) URL.revokeObjectURL(state.last.url);
      downloadUrls.forEach((url) => URL.revokeObjectURL(url));
      webMcpLifecycle.abort();
    }
  });

  // Optional browser tool support. Camera access and capture remain explicit UI actions.
  function requireEmptyInput(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) {
      throw new TypeError('Expected an empty object');
    }
  }
  const context = document.modelContext;
  if (context?.registerTool) {
    const inputSchema = { type: 'object', properties: {}, additionalProperties: false };
    const tools = [
      {
        name: 'get_camera_status', title: 'カメラの状態を確認',
        description: 'Read whether the camera is active, frame dimensions, and the current session capture count. Does not access image pixels.',
        inputSchema, annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) {
          requireEmptyInput(input);
          return { phase: state.phase, ready: Boolean(ready()), facing: state.facing, shotsThisSession: state.shotCount,
            width: ready() ? ui.video.videoWidth : 0, height: ready() ? ui.video.videoHeight : 0,
            hasRecentPhoto: Boolean(state.last) };
        },
      },
      {
        name: 'stop_camera', title: 'カメラを停止',
        description: 'Stop the camera and release its hardware. Does not capture, download, share, or delete photos.',
        inputSchema, annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) { requireEmptyInput(input); stopCamera(); return { phase: state.phase, stopped: true }; },
      },
    ];
    tools.forEach((tool) => {
      try { Promise.resolve(context.registerTool(tool, { signal: webMcpLifecycle.signal })).catch(() => {}); }
      catch { /* Browser tools are optional; the camera UI remains available. */ }
    });
  }

  if (!window.isSecureContext) {
    state.phase = 'error';
    setStartPanel('HTTPSで開いてください', `カメラを利用するには、サイトのHTTPSのURLを${browserName}で開いてください。`);
  } else if (!navigator.mediaDevices?.getUserMedia) {
    state.phase = 'error';
    setStartPanel(`${browserName}で開いてください`, `このブラウザはカメラに対応していません。${isIOS ? 'iPhoneのSafari' : 'AndroidのChrome'}でサイトを開いてください。`);
  }
  updateControls();
})();
