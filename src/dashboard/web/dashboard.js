/**
 * dashboard.js — Antigravity Dashboard Client
 * Handles: view navigation, profile form, WebSocket real-time updates,
 * intent review, live log streaming, analytics updates, control commands.
 */

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
const state = {
  ws: null,
  telemetry: null,
  profile: null,
  intent: null,
  maxCommentsPerHour: 8,
  maxDmsPerHour: 4,
  logEntries: [],
};

/* ══════════════════════════════════════
   VIEW NAVIGATION
══════════════════════════════════════ */
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById(`view-${viewId}`);
  const nav  = document.getElementById(`nav-${viewId}`);
  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ══════════════════════════════════════
   WEBSOCKET CONNECTION
══════════════════════════════════════ */
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  state.ws = new WebSocket(wsUrl);

  state.ws.addEventListener('open', () => {
    activateLogPulse(true);
    addLogEntry('Connected to Antigravity agent.', 'info');
  });

  state.ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch {}
  });

  state.ws.addEventListener('close', () => {
    activateLogPulse(false);
    addLogEntry('WebSocket disconnected. Reconnecting in 3s...', 'warn');
    setTimeout(connectWebSocket, 3000);
  });

  state.ws.addEventListener('error', () => {
    addLogEntry('WebSocket connection error.', 'error');
  });
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'TELEMETRY':
      state.telemetry = msg.data;
      updateTelemetryUI(msg.data);
      break;
    case 'PROFILE':
      state.profile = msg.data;
      prefillForm(msg.data);
      break;
    case 'INTENT':
      state.intent = msg.data;
      renderIntent(msg.data);
      showIntentBadge(true);
      break;
    case 'INTENT_APPROVED':
      showIntentBadge(false);
      addLogEntry('✓ Intent approved — automation starting!', 'success');
      switchView('monitor');
      break;
    case 'SECURITY_ALERT':
      showSecurityAlert(msg.message);
      break;
    case 'LOG':
      addLogEntry(msg.entry);
      break;
    default:
      break;
  }
}

/* ══════════════════════════════════════
   TELEMETRY UI UPDATES
══════════════════════════════════════ */
function updateTelemetryUI(t) {
  if (!t) return;

  // Sidebar status
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  const mode  = document.getElementById('status-mode');

  dot.className = 'status-dot';
  if (t.isPaused) { dot.classList.add('paused'); label.textContent = 'Paused'; }
  else if (t.isRunning) { dot.classList.add('running'); label.textContent = 'Running'; }
  else { dot.classList.add('idle'); label.textContent = 'Idle'; }
  mode.textContent = t.currentMode || '—';

  // Stats
  setVal('val-cycles',   t.cycleCount);
  setVal('val-comments', t.stats?.totalComments);
  setVal('val-dms',      t.stats?.totalDMs);
  setVal('val-scrolls',  t.stats?.totalScrolls);
  setVal('val-uptime',   (t.uptimeMinutes || 0) + 'm');

  // Analytics
  setVal('an-comments-hour',    t.stats?.commentsPastHour);
  setVal('an-dms-hour',         t.stats?.dmsPastHour);
  setVal('an-total-comments',   t.stats?.totalComments);
  setVal('an-total-dms',        t.stats?.totalDMs);
  setVal('an-total-scrolls',    t.stats?.totalScrolls);
  setVal('an-total-interactions', t.stats?.totalInteractions);
  setVal('an-uptime',           (t.uptimeMinutes || 0) + ' min');

  // Rate bars
  const cPct = Math.min(100, Math.round((t.stats?.commentsPastHour / state.maxCommentsPerHour) * 100));
  const dPct = Math.min(100, Math.round((t.stats?.dmsPastHour / state.maxDmsPerHour) * 100));
  document.getElementById('rate-fill-comments').style.width = cPct + '%';
  document.getElementById('rate-fill-dms').style.width = dPct + '%';
  document.getElementById('rate-pct-comments').textContent = cPct + '%';
  document.getElementById('rate-pct-dms').textContent = dPct + '%';

  // Cooling status
  const coolingDot = document.querySelector('.cooling-dot');
  const coolingText = document.querySelector('.cooling-status span:last-child');
  if (t.stats?.isCoolingDown) {
    coolingDot.classList.add('active');
    coolingText.textContent = 'Cooldown active';
  } else {
    coolingDot.classList.remove('active');
    coolingText.textContent = 'No cooldown';
  }

  // Pause/Resume button toggle
  const btnPause  = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  if (t.isPaused) {
    btnPause.style.display = 'none';
    btnResume.style.display = '';
  } else {
    btnPause.style.display = '';
    btnResume.style.display = 'none';
  }

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === t.currentMode);
  });
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val != null ? val : '0';
}

/* ══════════════════════════════════════
   LIVE LOG
══════════════════════════════════════ */
function addLogEntry(text, type = '') {
  const stream = document.getElementById('log-stream');
  if (!stream) return;

  // Remove "waiting" placeholder
  const placeholder = stream.querySelector('.log-entry.muted');
  if (placeholder && placeholder.textContent.includes('Waiting')) placeholder.remove();

  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.textContent = text;
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;

  state.logEntries.push({ text, type });
  if (state.logEntries.length > 200) state.logEntries.shift();
}

function clearLog() {
  const stream = document.getElementById('log-stream');
  if (stream) {
    stream.innerHTML = '<div class="log-entry muted">Log cleared.</div>';
  }
  state.logEntries = [];
}

function activateLogPulse(active) {
  const pulse = document.getElementById('log-pulse');
  if (pulse) pulse.classList.toggle('active', active);
}

/* ══════════════════════════════════════
   SECURITY ALERT
══════════════════════════════════════ */
function showSecurityAlert(message) {
  const banner = document.getElementById('security-alert');
  const msgEl  = document.getElementById('security-alert-msg');
  if (banner) banner.style.display = '';
  if (msgEl) msgEl.textContent = message;

  addLogEntry('⚠ ' + message, 'error');

  // Update status dot
  const dot = document.getElementById('status-dot');
  if (dot) { dot.className = 'status-dot alert'; }
}

function hideSecurityAlert() {
  const banner = document.getElementById('security-alert');
  if (banner) banner.style.display = 'none';
}

/* ══════════════════════════════════════
   INTENT REVIEW
══════════════════════════════════════ */
function renderIntent(intent) {
  const empty = document.getElementById('intent-empty');
  const card  = document.getElementById('intent-card');
  const body  = document.getElementById('intent-body');
  const list  = document.getElementById('intent-actions-list');
  const time  = document.getElementById('intent-time');

  if (!intent) return;

  empty.style.display = 'none';
  card.style.display  = '';
  time.textContent = new Date().toLocaleTimeString();

  body.textContent = intent.sessionSummary || '';

  list.innerHTML = '';
  (intent.plannedActions || []).forEach(action => {
    const div = document.createElement('div');
    div.className = 'intent-action-item';
    div.textContent = action;
    list.appendChild(div);
  });
}

function showIntentBadge(show) {
  const badge = document.getElementById('intent-badge');
  if (badge) badge.style.display = show ? '' : 'none';
}

document.getElementById('btn-approve')?.addEventListener('click', async () => {
  const notes = document.getElementById('intent-notes')?.value || '';
  try {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      document.getElementById('btn-approve').textContent = '✓ Approved!';
      document.getElementById('btn-approve').disabled = true;
      showIntentBadge(false);
      setTimeout(() => switchView('monitor'), 1500);
    }
  } catch (err) {
    addLogEntry('Failed to send approval: ' + err.message, 'error');
  }
});

document.getElementById('btn-modify')?.addEventListener('click', () => switchView('setup'));

/* ══════════════════════════════════════
   CONTROL COMMANDS
══════════════════════════════════════ */
async function sendControl(action, extra = {}) {
  try {
    const body = { action, ...extra };
    await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (action === 'resume') hideSecurityAlert();
    addLogEntry(`Control command sent: ${action}`, 'info');
  } catch (err) {
    addLogEntry('Control error: ' + err.message, 'error');
  }
}

function switchMode(mode) {
  sendControl('mode', { mode });
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

/* ══════════════════════════════════════
   PROFILE FORM
══════════════════════════════════════ */

// Goal chips toggle
document.querySelectorAll('.goal-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const checkbox = chip.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    chip.classList.toggle('checked', checkbox.checked);

    // Show/hide custom goal field
    const customGroup = document.getElementById('custom-goal-group');
    const anyCustom = [...document.querySelectorAll('.goal-chip input[value="CUSTOM"]')].some(cb => cb.checked);
    customGroup.style.display = anyCustom ? '' : 'none';
  });
});

// Tone chips toggle
document.querySelectorAll('.tone-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    chip.querySelector('input').checked = true;
  });
});

// Set default tone
const defaultTone = document.querySelector('[data-tone="casual_friendly"]');
if (defaultTone) defaultTone.classList.add('selected');

// Range sliders
const ranges = [
  { id: 'field-hours-start', valId: 'hours-start-val', fmt: v => `${v}:00` },
  { id: 'field-hours-end',   valId: 'hours-end-val',   fmt: v => `${v}:00` },
  { id: 'field-max-comments',valId: 'max-comments-val', fmt: v => v },
  { id: 'field-max-dms',     valId: 'max-dms-val',      fmt: v => v },
];
ranges.forEach(({ id, valId, fmt }) => {
  const input = document.getElementById(id);
  const span  = document.getElementById(valId);
  if (input && span) {
    span.textContent = fmt(input.value);
    input.addEventListener('input', () => {
      span.textContent = fmt(input.value);
      if (id === 'field-max-comments') state.maxCommentsPerHour = parseInt(input.value);
      if (id === 'field-max-dms')      state.maxDmsPerHour      = parseInt(input.value);
    });
  }
});

// Context keywords → tags
document.getElementById('field-context')?.addEventListener('input', (e) => {
  const container = document.getElementById('context-tags');
  const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
  container.innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');
});

// Add sample comment
document.getElementById('btn-add-sample')?.addEventListener('click', () => {
  const container = document.getElementById('sample-comments-container');
  const row = document.createElement('div');
  row.className = 'sample-comment-row';
  row.innerHTML = `
    <input type="text" class="sample-comment-input" placeholder="Write a sample comment in your natural voice..." />
    <button type="button" class="btn-remove-sample" aria-label="Remove">✕</button>
  `;
  row.querySelector('.btn-remove-sample').addEventListener('click', () => row.remove());
  container.appendChild(row);
});

// Remove sample comment buttons (initial)
document.querySelectorAll('.btn-remove-sample').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.sample-comment-row').remove());
});

// Form submit
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn  = document.getElementById('btn-save-profile');

  // Collect goals
  const goals = [...form.querySelectorAll('input[name="goals"]:checked')].map(cb => cb.value);
  if (goals.length === 0) {
    addLogEntry('Please select at least one automation goal.', 'warn');
    return;
  }

  // Collect tone
  const toneInput = form.querySelector('input[name="toneStyle"]:checked');
  if (!toneInput) {
    addLogEntry('Please select a communication tone.', 'warn');
    return;
  }

  // Collect sample comments
  const sampleComments = [...form.querySelectorAll('.sample-comment-input')]
    .map(i => i.value.trim()).filter(Boolean);

  // Collect context keywords
  const contextRaw = document.getElementById('field-context')?.value || '';
  const contextKeywords = contextRaw.split(',').map(t => t.trim()).filter(Boolean);

  const profile = {
    geminiKey:          form.querySelector('#field-gemini-key')?.value?.trim() || '',
    openaiKey:          form.querySelector('#field-openai-key')?.value?.trim() || '',
    name:               form.querySelector('#field-name')?.value?.trim() || '',
    profession:         form.querySelector('#field-profession')?.value?.trim() || '',
    bio:                form.querySelector('#field-bio')?.value?.trim() || '',
    platform:           'THREADS',
    goals,
    customGoal:         form.querySelector('#field-custom-goal')?.value?.trim() || undefined,
    toneStyle:          toneInput.value,
    contextKeywords,
    sampleComments,
    activeHoursStart:   parseInt(document.getElementById('field-hours-start')?.value || '9'),
    activeHoursEnd:     parseInt(document.getElementById('field-hours-end')?.value || '18'),
    maxCommentsPerHour: parseInt(document.getElementById('field-max-comments')?.value || '8'),
    maxDmsPerHour:      parseInt(document.getElementById('field-max-dms')?.value || '4'),
  };

  if (!profile.geminiKey) {
    addLogEntry('Please provide a Google Gemini API Key.', 'warn');
    return;
  }
  if (!profile.name || !profile.profession || !profile.bio) {
    addLogEntry('Please fill in your name, profession, and bio.', 'warn');
    return;
  }

  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });

    if (res.ok) {
      addLogEntry(`✓ Profile saved for ${profile.name}. Session plan being generated...`, 'success');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path d="M5 13l4 4L19 7"/></svg> Saved!`;

      // Switch to intent view after a moment
      setTimeout(() => {
        switchView('intent');
        showIntentBadge(true);
      }, 1200);
    } else {
      const data = await res.json();
      addLogEntry('Error saving profile: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (err) {
    addLogEntry('Network error: ' + err.message, 'error');
  } finally {
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><path d="M5 13l4 4L19 7"/></svg> Save Profile & Generate Plan`;
      btn.disabled = false;
    }, 3000);
  }
});

/* ══════════════════════════════════════
   PREFILL FORM FROM SAVED PROFILE
══════════════════════════════════════ */
function prefillForm(profile) {
  if (!profile) return;
  state.profile = profile;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('field-name', profile.name);
  set('field-profession', profile.profession);
  set('field-bio', profile.bio);
  set('field-context', (profile.contextKeywords || []).join(', '));
  set('field-hours-start', profile.activeHoursStart ?? 9);
  set('field-hours-end', profile.activeHoursEnd ?? 18);
  set('field-max-comments', profile.maxCommentsPerHour ?? 8);
  set('field-max-dms', profile.maxDmsPerHour ?? 4);
  if (profile.customGoal) set('field-custom-goal', profile.customGoal);

  // Trigger range display updates
  ranges.forEach(({ id, valId, fmt }) => {
    const input = document.getElementById(id);
    const span  = document.getElementById(valId);
    if (input && span) span.textContent = fmt(input.value);
  });

  // Goals
  (profile.goals || []).forEach(goal => {
    const chip = document.querySelector(`[data-goal="${goal}"]`);
    if (chip) {
      chip.classList.add('checked');
      const cb = chip.querySelector('input');
      if (cb) cb.checked = true;
    }
  });
  if ((profile.goals || []).includes('CUSTOM')) {
    document.getElementById('custom-goal-group').style.display = '';
  }

  // Tone
  const toneChip = document.querySelector(`[data-tone="${profile.toneStyle}"]`);
  if (toneChip) {
    document.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('selected'));
    toneChip.classList.add('selected');
    const ri = toneChip.querySelector('input');
    if (ri) ri.checked = true;
  }

  // Sample comments
  if (profile.sampleComments?.length) {
    const container = document.getElementById('sample-comments-container');
    container.innerHTML = '';
    profile.sampleComments.forEach(comment => {
      const row = document.createElement('div');
      row.className = 'sample-comment-row';
      row.innerHTML = `
        <input type="text" class="sample-comment-input" value="${comment.split('"').join('&quot;')}" />
        <button type="button" class="btn-remove-sample" aria-label="Remove">✕</button>
      `;
      row.querySelector('.btn-remove-sample').addEventListener('click', () => row.remove());
      container.appendChild(row);
    });
  }

  // Update context tags
  const contextEl = document.getElementById('field-context');
  if (contextEl) {
    const tags = (profile.contextKeywords || []);
    const container = document.getElementById('context-tags');
    if (container) container.innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');
  }

  state.maxCommentsPerHour = profile.maxCommentsPerHour ?? 8;
  state.maxDmsPerHour = profile.maxDmsPerHour ?? 4;
}

/* ══════════════════════════════════════
   POST COMPOSER & PUBLISH LOGIC
══════════════════════════════════════ */
function setupPostComposer() {
  const postInput = document.getElementById('post-text-input');
  const charCount = document.getElementById('post-char-count');
  const previewText = document.getElementById('preview-post-text');
  const btnPublish = document.getElementById('btn-publish-post');
  const btnQuickComment = document.getElementById('btn-quick-comment');
  const postToast = document.getElementById('post-toast');

  if (!postInput) return;

  // Sync typing with live preview and character count
  postInput.addEventListener('input', () => {
    const val = postInput.value;
    if (charCount) charCount.textContent = `${val.length} / 500`;
    if (previewText) previewText.textContent = val.trim() || 'Your post will appear here...';
  });

  // Template buttons
  const tplJob = document.getElementById('tpl-remote-job');
  const tplShowcase = document.getElementById('tpl-react-showcase');
  const tplMern = document.getElementById('tpl-mern-insight');

  if (tplJob) {
    tplJob.addEventListener('click', () => {
      postInput.value = `Hey everyone! I'm Sanskriti, a React.js & Frontend Developer with hands-on internship experience in React, Tailwind CSS, and Firebase. I'm actively looking for remote frontend or full-stack opportunities. Would love to connect with tech founders & teams hiring! Portfolio: https://my-portfolio-psi-liard-97.vercel.app #remotejobs #reactjs #hiring`;
      postInput.dispatchEvent(new Event('input'));
    });
  }

  if (tplShowcase) {
    tplShowcase.addEventListener('click', () => {
      postInput.value = `Just updated my personal portfolio built with ReactJS and Tailwind CSS! It showcases projects like my Modern Shoe Store UI and MERN stack applications. Check it out and let me know your thoughts: https://my-portfolio-psi-liard-97.vercel.app #webdev #frontend #react`;
      postInput.dispatchEvent(new Event('input'));
    });
  }

  if (tplMern) {
    tplMern.addEventListener('click', () => {
      postInput.value = `Building clean, modular components in ReactJS while managing responsive styling with Tailwind makes scaling frontend apps so seamless. Currently deepening my MERN and full-stack toolkit! What's your favorite tech stack in 2026? #reactjs #webdevelopment #mern`;
      postInput.dispatchEvent(new Event('input'));
    });
  }

  // Publish post button
  if (btnPublish) {
    btnPublish.addEventListener('click', async () => {
      const text = postInput.value.trim();
      if (!text) {
        showPostToast('Please enter some text before publishing.', 'error');
        return;
      }

      btnPublish.disabled = true;
      btnPublish.textContent = 'Publishing to Threads...';

      try {
        const res = await fetch('/api/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (data.success) {
          showPostToast('✓ Post published successfully to Threads!', 'success');
          addLogEntry(`[Dashboard] Post published: "${text.slice(0, 45)}..."`, 'success');
          postInput.value = '';
          postInput.dispatchEvent(new Event('input'));
        } else {
          showPostToast(`Failed: ${data.message || 'Error publishing post'}`, 'error');
        }
      } catch (err) {
        showPostToast(`Network error: ${err.message}`, 'error');
      } finally {
        btnPublish.disabled = false;
        btnPublish.textContent = '🚀 Publish to Threads';
      }
    });
  }

  // Quick comment button
  if (btnQuickComment) {
    btnQuickComment.addEventListener('click', async () => {
      const text = postInput.value.trim();
      btnQuickComment.disabled = true;
      btnQuickComment.textContent = 'Commenting on Threads...';

      try {
        const res = await fetch('/api/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text || undefined }),
        });
        const data = await res.json();
        if (data.success) {
          showPostToast('✓ Comment posted successfully on Threads!', 'success');
          addLogEntry(`[Dashboard] Comment dispatched: "${(text || 'Default pitch').slice(0, 45)}..."`, 'success');
        } else {
          showPostToast(`Failed: ${data.message || 'Error posting comment'}`, 'error');
        }
      } catch (err) {
        showPostToast(`Network error: ${err.message}`, 'error');
      } finally {
        btnQuickComment.disabled = false;
        btnQuickComment.textContent = '💬 Post as Comment Instead';
      }
    });
  }

  function showPostToast(msg, type) {
    if (!postToast) return;
    postToast.textContent = msg;
    postToast.className = `post-toast ${type}`;
    postToast.style.display = 'block';
    setTimeout(() => { postToast.style.display = 'none'; }, 5000);
  }
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
async function init() {
  setupPostComposer();

  // Try to load saved profile
  try {
    const res = await fetch('/api/profile/saved');
    if (res.ok) {
      const data = await res.json();
      if (data.profile) prefillForm(data.profile);
    }
  } catch {}

  // Try to load pending intent
  try {
    const res = await fetch('/api/intent');
    if (res.ok) {
      const data = await res.json();
      if (data.intent) {
        renderIntent(data.intent);
        if (!data.intent.approved) showIntentBadge(true);
      }
    }
  } catch {}

  // Load current telemetry
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const tel = await res.json();
      updateTelemetryUI(tel);
    }
  } catch {}

  // Connect WebSocket
  connectWebSocket();
}

init();
