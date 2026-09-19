// popup/popup.js
// Popup controller with Supabase toggle, confirmation answer, auto-minimize, purchase modal, CSV export
// Developed by CodeNagpur.in
// Version 4.3.1

console.log('🎯 BuyLead Assistant Popup v4.3.1 - Developed by CodeNagpur.in');

const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
let statusUpdateInterval = null;
let supabaseEnabled = true;
let confirmationAnswer = 'yes';
let autoMinimize = true;
let purchaseAction = 'close';

document.addEventListener('DOMContentLoaded', function() {
    initializeDefaultMode().then(function() {
        loadAllSettings();
        setupEventListeners();
        updateStatus();
        statusUpdateInterval = setInterval(updateStatus, 1500);
    });
});

// ============================================================
// INITIALIZE DEFAULT MODE
// ============================================================
function initializeDefaultMode() {
    return new Promise(function(resolve) {
        browserAPI.storage.local.get(['mode', 'userSetMode'], function(result) {
            if (!result.userSetMode) {
                browserAPI.storage.local.set({
                    mode: 'AUTOMATIC',
                    userSetMode: false
                }, function() {
                    setModeInContent('AUTOMATIC').then(function() { resolve(); }).catch(function() { resolve(); });
                });
            } else {
                setModeInContent(result.mode || 'MONITOR').then(function() { resolve(); }).catch(function() { resolve(); });
            }
        });
    });
}

// ============================================================
// LOAD ALL SETTINGS
// ============================================================
function loadAllSettings() {
    browserAPI.storage.local.get([
        'supabaseEnabled',
        'confirmationAnswer',
        'autoMinimize',
        'purchaseAction'
    ], function(result) {
        // Supabase
        supabaseEnabled = result.supabaseEnabled !== false;
        updateSupabaseUI(supabaseEnabled);

        // Confirmation answer
        confirmationAnswer = result.confirmationAnswer || 'yes';
        updateConfirmationUI(confirmationAnswer);

        // Auto-minimize
        autoMinimize = result.autoMinimize !== false;
        updateAutoMinimizeUI(autoMinimize);

        // Purchase action
        purchaseAction = result.purchaseAction || 'close';
        updatePurchaseUI(purchaseAction);
    });
}

// ============================================================
// SUPABASE UI
// ============================================================
function updateSupabaseUI(enabled) {
    var toggle = document.getElementById('supabaseToggle');
    var icon = document.getElementById('connectionIcon');
    var label = document.getElementById('connectionLabel');
    var status = document.getElementById('connectionStatus');
    var container = document.getElementById('connectionToggle');

    if (toggle) toggle.checked = enabled;

    if (enabled) {
        icon.textContent = '☁️';
        label.innerHTML = 'Supabase: <strong>ON</strong>';
        status.textContent = 'Connected to CRM';
        container.classList.remove('offline');
    } else {
        icon.textContent = '📴';
        label.innerHTML = 'Supabase: <strong>OFF</strong>';
        status.textContent = 'Offline mode • Local keywords only';
        container.classList.add('offline');
    }
}

// ============================================================
// CONFIRMATION UI
// ============================================================
function updateConfirmationUI(answer) {
    var toggle = document.getElementById('confirmToggle');
    var icon = document.getElementById('confirmIcon');
    var label = document.getElementById('confirmLabel');
    var status = document.getElementById('confirmStatus');
    var container = document.getElementById('confirmToggleWrap');

    if (toggle) toggle.checked = (answer === 'yes');

    if (answer === 'yes') {
        icon.textContent = '✅';
        label.innerHTML = 'Old Lead Confirmation: <strong>YES</strong>';
        status.textContent = 'Auto-answer to "Do you want to contact?"';
        if (container) {
            container.style.background = 'linear-gradient(135deg, #f0f8f7 0%, #e8f5f3 100%)';
            container.style.borderColor = '#02A699';
        }
    } else {
        icon.textContent = '❌';
        label.innerHTML = 'Old Lead Confirmation: <strong>NO</strong>';
        status.textContent = 'Will auto-skip old leads';
        if (container) {
            container.style.background = 'linear-gradient(135deg, #fff8e8 0%, #fef5e0 100%)';
            container.style.borderColor = '#f5a623';
        }
    }
}

// ============================================================
// AUTO-MINIMIZE UI
// ============================================================
function updateAutoMinimizeUI(enabled) {
    var toggle = document.getElementById('autoMinToggle');
    var icon = document.getElementById('autoMinIcon');
    var label = document.getElementById('autoMinLabel');
    var status = document.getElementById('autoMinStatus');
    var container = document.getElementById('autoMinToggleWrap');

    if (toggle) toggle.checked = enabled;

    if (enabled) {
        icon.textContent = '✓';
        label.innerHTML = 'Auto-Handle Popups: <strong>ON</strong>';
        status.textContent = 'Popup handled automatically after acquisition';
        if (container) {
            container.style.background = 'linear-gradient(135deg, #f0f8f7 0%, #e8f5f3 100%)';
            container.style.borderColor = '#02A699';
        }
    } else {
        icon.textContent = '○';
        label.innerHTML = 'Auto-Handle Popups: <strong>OFF</strong>';
        status.textContent = 'Popups must be closed manually';
        if (container) {
            container.style.background = 'linear-gradient(135deg, #f5f5f5 0%, #ebebeb 100%)';
            container.style.borderColor = '#999';
        }
    }
}

// ============================================================
// PURCHASE MODAL UI
// ============================================================
function updatePurchaseUI(action) {
    var toggle = document.getElementById('purchaseToggle');
    var icon = document.getElementById('purchaseIcon');
    var label = document.getElementById('purchaseLabel');
    var status = document.getElementById('purchaseStatus');
    var container = document.getElementById('purchaseToggleWrap');

    if (toggle) toggle.checked = (action === 'close');

    if (action === 'close') {
        icon.textContent = '💳';
        label.innerHTML = 'Purchase Modal: <strong>Auto-Close</strong>';
        status.textContent = 'Auto-close and continue';
        if (container) {
            container.style.background = 'linear-gradient(135deg, #f0f8f7 0%, #e8f5f3 100%)';
            container.style.borderColor = '#02A699';
        }
    } else {
        icon.textContent = '🛑';
        label.innerHTML = 'Purchase Modal: <strong>Stop</strong>';
        status.textContent = 'Pause queue when purchase prompt appears';
        if (container) {
            container.style.background = 'linear-gradient(135deg, #fef0f0 0%, #fce5e5 100%)';
            container.style.borderColor = '#ef7076';
        }
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var mode = this.dataset.mode;
            setMode(mode);
        });
    });

    // Supabase toggle
    document.getElementById('supabaseToggle').addEventListener('change', function() {
        var enabled = this.checked;
        supabaseEnabled = enabled;

        browserAPI.storage.local.set({ supabaseEnabled: enabled }, function() {
            updateSupabaseUI(enabled);
            showToast(enabled ? '☁️ Supabase ON - CRM mode' : '📴 Supabase OFF - Offline mode', enabled ? 'success' : 'warning');

            sendToContent({
                action: 'TOGGLE_SUPABASE',
                enabled: enabled
            });
        });
    });

    // Confirmation answer toggle
    document.getElementById('confirmToggle').addEventListener('change', function() {
        var answer = this.checked ? 'yes' : 'no';
        confirmationAnswer = answer;

        browserAPI.storage.local.set({ confirmationAnswer: answer }, function() {
            updateConfirmationUI(answer);
            showToast('Old lead answer: ' + answer.toUpperCase(), answer === 'yes' ? 'success' : 'warning');

            sendToContent({
                action: 'SET_CONFIRMATION_ANSWER',
                answer: answer
            });
        });
    });

    // Auto-minimize toggle
    document.getElementById('autoMinToggle').addEventListener('change', function() {
        var enabled = this.checked;
        autoMinimize = enabled;

        browserAPI.storage.local.set({ autoMinimize: enabled }, function() {
            updateAutoMinimizeUI(enabled);
            showToast(enabled ? '✓ Auto-popup ON' : '○ Auto-popup OFF', enabled ? 'success' : 'warning');

            sendToContent({
                action: 'SET_AUTO_MINIMIZE',
                enabled: enabled
            });
        });
    });

    // Purchase modal toggle
    document.getElementById('purchaseToggle').addEventListener('change', function() {
        var action = this.checked ? 'close' : 'stop';
        purchaseAction = action;

        browserAPI.storage.local.set({ purchaseAction: action }, function() {
            updatePurchaseUI(action);
            showToast(
                action === 'close' ? '💳 Purchase modal: Auto-close' : '🛑 Purchase modal: Stop queue',
                action === 'close' ? 'success' : 'warning'
            );

            sendToContent({
                action: 'SET_PURCHASE_ACTION',
                purchaseAction: action
            });
        });
    });

    // Emergency stop
    document.getElementById('emergencyBtn').addEventListener('click', function() {
        if (confirm('🛑 Emergency Stop - Stop all automation?')) {
            sendToContent({ action: 'EMERGENCY_STOP' });
            showToast('🛑 Emergency stop activated', 'error');
        }
    });

    // Resume
    document.getElementById('resumeBtn').addEventListener('click', function() {
        sendToContent({ action: 'RESUME' });
        showToast('▶️ Resumed', 'success');
    });

    // Export CSV
    document.getElementById('exportCsvBtn').addEventListener('click', exportAllDataAsCsv);

    // Config link
    document.getElementById('configLink').addEventListener('click', function() {
        browserAPI.tabs.create({ url: browserAPI.runtime.getURL('config/index.html') });
    });

    // Debug link
    document.getElementById('debugLink').addEventListener('click', function() {
        browserAPI.tabs.create({ url: browserAPI.runtime.getURL('debug/index.html') });
    });
}

// ============================================================
// SET MODE
// ============================================================
function setMode(mode) {
    browserAPI.storage.local.set({
        mode: mode,
        userSetMode: true
    }, function() {
        setModeInContent(mode).then(function() {
            showToast('✅ Mode: ' + mode, 'success');
            updateStatus();
        });
    });
}

function setModeInContent(mode) {
    return new Promise(function(resolve) {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                browserAPI.tabs.sendMessage(tabs[0].id, { action: 'SET_MODE', mode: mode }, function(response) {
                    if (browserAPI.runtime.lastError) {
                        browserAPI.runtime.sendMessage({ action: 'SET_MODE', mode: mode }, function(bgResponse) {
                            resolve(bgResponse);
                        });
                    } else {
                        resolve(response);
                    }
                });
            } else {
                resolve({ success: false });
            }
        });
    });
}

// ============================================================
// SEND TO CONTENT
// ============================================================
function sendToContent(message, callback) {
    browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            browserAPI.tabs.sendMessage(tabs[0].id, message, function(response) {
                if (browserAPI.runtime.lastError) {
                    browserAPI.runtime.sendMessage(message, callback);
                } else {
                    if (callback) callback(response);
                }
            });
        } else {
            if (callback) callback({ success: false, error: 'No active tab' });
        }
    });
}

// ============================================================
// UPDATE STATUS
// ============================================================
function updateStatus() {
    sendToContent({ action: 'GET_STATUS' }, function(response) {
        if (!response || !response.success) {
            showDisconnected();
            return;
        }

        var data = response;
        var currentMode = data.mode || 'MONITOR';

        // Mode badge
        var badge = document.getElementById('modeBadge');
        badge.textContent = currentMode;
        badge.className = 'badge badge-' + currentMode.toLowerCase().replace('_', '');

        if (data.safety && data.safety.emergencyStop) {
            badge.className = 'badge badge-emergency';
            badge.textContent = '🚨 STOP';
        }

        // Status
        var statusText = document.getElementById('statusText');
        var isRunning = data.scanner && data.scanner.running;
        if (data.safety && data.safety.emergencyStop) {
            statusText.textContent = '🛑 Emergency Stop';
        } else if (isRunning && currentMode === 'AUTOMATIC') {
            statusText.textContent = '▶ Auto-Acquiring';
        } else if (isRunning) {
            statusText.textContent = '▶ Running';
        } else {
            statusText.textContent = '⏹ Stopped';
        }

        // Queue
        document.getElementById('queueStatus').textContent = (data.queue && data.queue.size) || 0;

        // Safety
        var safetyEl = document.getElementById('safetyStatus');
        if (data.safety && data.safety.emergencyStop) {
            safetyEl.textContent = '🛑 EMERGENCY';
            safetyEl.style.color = '#ef7076';
        } else if (data.safety && data.safety.cooldown) {
            safetyEl.textContent = '⏳ Cooldown';
            safetyEl.style.color = '#f5a623';
        } else if (currentMode === 'MONITOR') {
            safetyEl.textContent = '📊 Monitor';
            safetyEl.style.color = '#888';
        } else if (currentMode === 'DRY_RUN') {
            safetyEl.textContent = '🔬 Dry Run';
            safetyEl.style.color = '#f5a623';
        } else if (currentMode === 'AUTOMATIC') {
            safetyEl.textContent = '🔥 Auto';
            safetyEl.style.color = '#02A699';
        } else {
            safetyEl.textContent = '✅ OK';
            safetyEl.style.color = '#02A699';
        }

        // Auto-notice
        var autoNotice = document.getElementById('autoNotice');
        if (currentMode === 'AUTOMATIC' && !(data.safety && data.safety.emergencyStop)) {
            autoNotice.classList.remove('hidden');
        } else {
            autoNotice.classList.add('hidden');
        }

        // Acquired count
        document.getElementById('acquiredCount').textContent = (data.stats && data.stats.acquired) || 0;

        // Stats
        if (data.stats) {
            document.getElementById('statDiscovered').textContent = data.stats.discovered || 0;
            document.getElementById('statValidated').textContent = data.stats.validated || 0;
            document.getElementById('statScored').textContent = data.stats.scored || 0;
            document.getElementById('statQueued').textContent = data.stats.queued || 0;
            document.getElementById('statAcquired').textContent = data.stats.acquired || 0;
            document.getElementById('statRejected').textContent = data.stats.rejected || 0;
            document.getElementById('statDuplicate').textContent = data.stats.duplicate || 0;
            document.getElementById('statFailed').textContent = data.stats.failed || 0;
            document.getElementById('statPopups').textContent = data.stats.popupsHandled || data.popupsHandled || 0;
        }

        // Sync toggles from live state
        if (data.supabaseEnabled !== undefined && data.supabaseEnabled !== supabaseEnabled) {
            supabaseEnabled = data.supabaseEnabled;
            updateSupabaseUI(supabaseEnabled);
        }
        if (data.confirmationAnswer !== undefined && data.confirmationAnswer !== confirmationAnswer) {
            confirmationAnswer = data.confirmationAnswer;
            updateConfirmationUI(confirmationAnswer);
        }
        if (data.autoMinimize !== undefined && data.autoMinimize !== autoMinimize) {
            autoMinimize = data.autoMinimize;
            updateAutoMinimizeUI(autoMinimize);
        }
        if (data.purchaseAction !== undefined && data.purchaseAction !== purchaseAction) {
            purchaseAction = data.purchaseAction;
            updatePurchaseUI(purchaseAction);
        }

        // Emergency/Resume buttons
        var emergencyBtn = document.getElementById('emergencyBtn');
        var resumeBtn = document.getElementById('resumeBtn');
        if (data.safety && data.safety.emergencyStop) {
            emergencyBtn.style.display = 'none';
            resumeBtn.style.display = 'block';
        } else {
            emergencyBtn.style.display = 'block';
            resumeBtn.style.display = 'none';
        }

        // Highlight active mode button
        document.querySelectorAll('.mode-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
    });
}

function showDisconnected() {
    document.getElementById('modeBadge').textContent = '--';
    document.getElementById('modeBadge').className = 'badge badge-monitor';
    document.getElementById('statusText').textContent = '⏹ Disconnected';
    document.getElementById('safetyStatus').textContent = '⚠️ No connection';
    document.getElementById('safetyStatus').style.color = '#ef7076';
}

// ============================================================
// CSV EXPORT - MULTI-TAB
// ============================================================
function exportAllDataAsCsv() {
    var btn = document.getElementById('exportCsvBtn');
    var originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="export-icon">⏳</span><span>Exporting...</span>';

    Promise.all([
        getStorageData([
            'stats', 'mode', 'minScore', 'maxPerMinute', 'maxPerHour', 'maxPerDay', 'maxPerSession',
            'supabaseEnabled', 'userSetMode', 'keywords', 'logs', 'autoMinimize',
            'confirmationAnswer', 'purchaseAction'
        ]),
        getContentStatus()
    ]).then(function(results) {
        var storageData = results[0] || {};
        var contentStatus = results[1] || {};

        var csv = buildMultiTabCsv(storageData, contentStatus);
        downloadCsv(csv);

        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showToast('📥 Report exported successfully', 'success');
    }).catch(function(err) {
        console.error('Export failed:', err);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showToast('❌ Export failed: ' + err.message, 'error');
    });
}

function getStorageData(keys) {
    return new Promise(function(resolve) {
        browserAPI.storage.local.get(keys, function(result) {
            resolve(result || {});
        });
    });
}

function getContentStatus() {
    return new Promise(function(resolve) {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (!tabs[0]) { resolve(null); return; }
            browserAPI.tabs.sendMessage(tabs[0].id, { action: 'GET_STATUS' }, function(response) {
                if (browserAPI.runtime.lastError) resolve(null);
                else resolve(response || null);
            });
        });
    });
}

function buildMultiTabCsv(storage, status) {
    var today = new Date();
    var dateStr = today.toISOString().slice(0, 10);
    var timestamp = today.toISOString();

    var lines = [];

    // TAB 1: REPORT INFO
    lines.push('# ==================================================');
    lines.push('# INDIAMART BUYLEAD ASSISTANT REPORT');
    lines.push('# ==================================================');
    lines.push('# Generated:,' + csvEscape(timestamp));
    lines.push('# Date:,' + csvEscape(dateStr));
    lines.push('# Version:,4.3.1');
    lines.push('# Developer:,CodeNagpur.in');
    lines.push('');
    lines.push('');

    // TAB 2: SUMMARY
    lines.push('# ==================================================');
    lines.push('# TAB: SUMMARY');
    lines.push('# ==================================================');
    lines.push('Metric,Value');
    lines.push('Report Date,' + csvEscape(dateStr));
    lines.push('Report Time,' + csvEscape(timestamp));
    lines.push('Extension Version,4.3.1');
    lines.push('Supabase Enabled,' + (storage.supabaseEnabled !== false ? 'YES' : 'NO'));
    lines.push('Confirmation Answer,' + csvEscape(storage.confirmationAnswer || 'yes'));
    lines.push('Auto-Handle Popups,' + (storage.autoMinimize !== false ? 'YES' : 'NO'));
    lines.push('Purchase Modal Action,' + csvEscape(storage.purchaseAction || 'close'));
    if (status) {
        lines.push('Current Mode,' + csvEscape(status.mode || 'unknown'));
        lines.push('Emergency Stop,' + ((status.safety && status.safety.emergencyStop) ? 'YES' : 'NO'));
        lines.push('Cooldown Active,' + ((status.safety && status.safety.cooldown) ? 'YES' : 'NO'));
    }
    lines.push('');

    // TAB 3: STATISTICS
    lines.push('# ==================================================');
    lines.push('# TAB: STATISTICS');
    lines.push('# ==================================================');
    lines.push('Metric,Value');
    var stats = (status && status.stats) || storage.stats || {};
    lines.push('Discovered,' + (stats.discovered || 0));
    lines.push('Parsed,' + (stats.parsed || 0));
    lines.push('Validated,' + (stats.validated || 0));
    lines.push('Scored,' + (stats.scored || 0));
    lines.push('Queued,' + (stats.queued || 0));
    lines.push('Acquired,' + (stats.acquired || 0));
    lines.push('Rejected,' + (stats.rejected || 0));
    lines.push('Duplicate,' + (stats.duplicate || 0));
    lines.push('Failed,' + (stats.failed || 0));
    lines.push('DB Synced,' + (stats.dbSynced || 0));
    lines.push('Popups Handled,' + (stats.popupsHandled || 0));
    lines.push('');

    // TAB 4: CONFIGURATION
    lines.push('# ==================================================');
    lines.push('# TAB: CONFIGURATION');
    lines.push('# ==================================================');
    lines.push('Setting,Value');
    lines.push('Mode,' + csvEscape(storage.mode || 'AUTOMATIC'));
    lines.push('User Set Mode,' + (storage.userSetMode ? 'YES' : 'NO'));
    lines.push('Supabase Enabled,' + (storage.supabaseEnabled !== false ? 'YES' : 'NO'));
    lines.push('Confirmation Answer,' + csvEscape(storage.confirmationAnswer || 'yes'));
    lines.push('Auto-Handle Popups,' + (storage.autoMinimize !== false ? 'YES' : 'NO'));
    lines.push('Purchase Modal Action,' + csvEscape(storage.purchaseAction || 'close'));
    lines.push('Minimum Score,' + (storage.minScore || 60));
    lines.push('Max Per Minute,' + (storage.maxPerMinute || 5));
    lines.push('Max Per Hour,' + (storage.maxPerHour || 20));
    lines.push('Max Per Day,' + (storage.maxPerDay || 50));
    lines.push('Max Per Session,' + (storage.maxPerSession || 30));
    lines.push('');

    // TAB 5: KEYWORDS
    lines.push('# ==================================================');
    lines.push('# TAB: KEYWORDS');
    lines.push('# ==================================================');
    lines.push('Type,Keyword');
    var keywords = storage.keywords || {};
    var productKws = keywords.product || [];
    var negativeKws = keywords.negative || [];
    var requiredKws = keywords.required || [];
    var locationKws = keywords.location || [];
    productKws.forEach(function(kw) { lines.push('PRODUCT,' + csvEscape(kw)); });
    negativeKws.forEach(function(kw) { lines.push('NEGATIVE,' + csvEscape(kw)); });
    requiredKws.forEach(function(kw) { lines.push('REQUIRED,' + csvEscape(kw)); });
    locationKws.forEach(function(kw) { lines.push('LOCATION,' + csvEscape(kw)); });
    lines.push('');
    lines.push('Keyword Totals,');
    lines.push('Product Keywords,' + productKws.length);
    lines.push('Negative Keywords,' + negativeKws.length);
    lines.push('Required Keywords,' + requiredKws.length);
    lines.push('Location Keywords,' + locationKws.length);
    lines.push('Total Keywords,' + (productKws.length + negativeKws.length + requiredKws.length + locationKws.length));
    lines.push('');

    // TAB 6: SAFETY
    lines.push('# ==================================================');
    lines.push('# TAB: SAFETY');
    lines.push('# ==================================================');
    lines.push('Safety Metric,Value');
    if (status && status.safety) {
        lines.push('Emergency Stop,' + (status.safety.emergencyStop ? 'YES' : 'NO'));
        lines.push('Cooldown Active,' + (status.safety.cooldown ? 'YES' : 'NO'));
        lines.push('Current Mode,' + csvEscape(status.safety.mode || 'unknown'));
        if (status.safety.counters) {
            lines.push('Counter - Minute,' + (status.safety.counters.minute || 0));
            lines.push('Counter - Hour,' + (status.safety.counters.hour || 0));
            lines.push('Counter - Day,' + (status.safety.counters.day || 0));
            lines.push('Counter - Session,' + (status.safety.counters.session || 0));
        }
        if (status.safety.limits) {
            lines.push('Limit - Per Minute,' + (status.safety.limits.perMinute || 0));
            lines.push('Limit - Per Hour,' + (status.safety.limits.perHour || 0));
            lines.push('Limit - Per Day,' + (status.safety.limits.perDay || 0));
            lines.push('Limit - Per Session,' + (status.safety.limits.perSession || 0));
        }
    } else {
        lines.push('Status,Not available (page not active)');
    }
    lines.push('');

    // TAB 7: QUEUE
    lines.push('# ==================================================');
    lines.push('# TAB: QUEUE');
    lines.push('# ==================================================');
    lines.push('Queue Metric,Value');
    if (status && status.queue) {
        lines.push('Queue Size,' + (status.queue.size || 0));
        lines.push('Currently Processing,' + (status.queue.processing || 0));
        lines.push('Queue Running,' + (status.queue.running ? 'YES' : 'NO'));
    } else {
        lines.push('Status,Not available');
    }
    lines.push('');

    // TAB 8: SCANNER
    lines.push('# ==================================================');
    lines.push('# TAB: SCANNER');
    lines.push('# ==================================================');
    lines.push('Scanner Metric,Value');
    if (status && status.scanner) {
        lines.push('Scanner Running,' + (status.scanner.running ? 'YES' : 'NO'));
        lines.push('Known Leads,' + (status.scanner.knownLeads || 0));
    } else {
        lines.push('Status,Not available');
    }
    lines.push('');

    // TAB 9: STATE MACHINE
    lines.push('# ==================================================');
    lines.push('# TAB: STATE MACHINE');
    lines.push('# ==================================================');
    lines.push('State,Count');
    if (status && status.stateStats) {
        var states = status.stateStats;
        var stateKeys = Object.keys(states);
        if (stateKeys.length === 0) {
            lines.push('No states recorded,0');
        } else {
            stateKeys.forEach(function(state) {
                lines.push(csvEscape(state) + ',' + states[state]);
            });
        }
    } else {
        lines.push('Status,Not available');
    }
    lines.push('');

    // TAB 10: DEBUG LOGS
    lines.push('# ==================================================');
    lines.push('# TAB: DEBUG LOGS');
    lines.push('# ==================================================');
    lines.push('Timestamp,Level,Module,Correlation ID,Message,Data');
    var logs = storage.logs || [];
    if (logs.length === 0) {
        lines.push('No logs recorded,,,,,');
    } else {
        var recentLogs = logs.slice(-500);
        recentLogs.forEach(function(log) {
            lines.push([
                csvEscape(log.timestamp || ''),
                csvEscape(log.level || ''),
                csvEscape(log.module || ''),
                csvEscape(log.correlationId || ''),
                csvEscape(log.message || ''),
                csvEscape(JSON.stringify(log.data || {}))
            ].join(','));
        });
    }
    lines.push('');

    // TAB 11: ENVIRONMENT
    lines.push('# ==================================================');
    lines.push('# TAB: ENVIRONMENT');
    lines.push('# ==================================================');
    lines.push('Property,Value');
    lines.push('User Agent,' + csvEscape(navigator.userAgent || ''));
    lines.push('Platform,' + csvEscape(navigator.platform || ''));
    lines.push('Language,' + csvEscape(navigator.language || ''));
    lines.push('Extension ID,' + csvEscape(browserAPI.runtime.id || ''));
    lines.push('Export Timestamp,' + csvEscape(timestamp));
    lines.push('');

    lines.push('# ==================================================');
    lines.push('# END OF REPORT');
    lines.push('# Generated by CodeNagpur.in');
    lines.push('# ==================================================');

    return lines.join('\n');
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    var str = String(value);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function downloadCsv(content) {
    var today = new Date().toISOString().slice(0, 10);
    var filename = today + '-report.csv';
    var blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 100);
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
        toast.style.animation = 'fadeOutDown 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
}

// ============================================================
// CLEANUP
// ============================================================
window.addEventListener('unload', function() {
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }
});