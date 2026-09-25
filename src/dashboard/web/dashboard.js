/* ═══════════════════════════════════════════════════════════════
   ANTIGRAVITY DASHBOARD JS — Autopilot Mode
═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Deactivate all
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      // Activate clicked
      item.classList.add('active');
      const viewId = item.getAttribute('data-view');
      document.getElementById('view-' + viewId).classList.add('active');
    });
  });

  // Mock initial logs to show connection to Antigravity IDE
  setTimeout(() => addLog('Antigravity Agent connected successfully.', 'success'), 500);
  setTimeout(() => addLog('Ready to accept manual commands or chat triggers.', 'info'), 1000);
});

// Controls
function sendControl(action) {
  if (action === 'start') {
    addLog('🚀 Triggering Antigravity Autopilot sequence...', 'info');
    document.getElementById('status-dot').className = 'status-dot running';
    document.getElementById('status-label').textContent = 'Active';
    document.getElementById('status-mode').textContent = 'Automating Threads...';
    
    setTimeout(() => {
      addLog('Agent has taken control of the browser subagent.', 'success');
      document.getElementById('activity-stream').innerHTML = `
        <div class="log-entry" style="background: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: 12px; border-left: 4px solid #10b981; margin-bottom: 12px;">
          <strong style="color: #10b981; display: block; margin-bottom: 4px;">Subagent Spawned</strong>
          <span style="color: #e2e8f0;">Antigravity Browser Agent is now executing your workflow in the background. Check your IDE chat for the final report.</span>
        </div>
      `;
      document.getElementById('activity-count').textContent = '1 active task';
    }, 1500);
  } else if (action === 'stop') {
    addLog('🛑 Autopilot stopped by user.', 'warn');
    document.getElementById('status-dot').className = 'status-dot idle';
    document.getElementById('status-label').textContent = 'Stopped';
    document.getElementById('status-mode').textContent = 'Awaiting command';
  }
}

// Logs
function addLog(msg, type = 'muted') {
  const stream = document.getElementById('log-stream');
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;
  
  const time = new Date().toLocaleTimeString([], { hour12: false });
  entry.innerHTML = \`<span style="color: #64748b; margin-right: 8px;">[\${time}]</span> \${msg}\`;
  
  stream.appendChild(entry);
  stream.scrollTop = stream.scrollHeight;
}
