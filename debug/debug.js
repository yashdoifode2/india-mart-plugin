// debug/debug.js
// Debug log viewer - Complete working version
// Developed by CodeNagpur.in

console.log('🐞 BuyLead Assistant Debug - Developed by CodeNagpur.in');

const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
let refreshInterval = null;
let autoRefresh = true;
let allLogs = [];
let filteredLogs = [];

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Debug] Page loaded');
    loadLogs();
    setupEventListeners();
    startAutoRefresh();
    populateModules();
});

function setupEventListeners() {
    document.getElementById('applyFilter').addEventListener('click', function() {
        applyFilters();
    });
    
    document.getElementById('clearFilter').addEventListener('click', function() {
        document.getElementById('levelFilter').value = 'ALL';
        document.getElementById('moduleFilter').value = 'ALL';
        document.getElementById('searchFilter').value = '';
        applyFilters();
    });
    
    document.getElementById('refreshBtn').addEventListener('click', function() {
        loadLogs();
        showToast('🔄 Refreshed');
    });
    
    document.getElementById('autoRefreshBtn').addEventListener('click', function() {
        autoRefresh = !autoRefresh;
        this.textContent = autoRefresh ? '⏸ Pause Auto' : '▶ Resume Auto';
        showToast(autoRefresh ? '▶ Auto-refresh ON' : '⏸ Auto-refresh OFF');
    });
    
    document.getElementById('clearBtn').addEventListener('click', clearLogs);
    document.getElementById('exportBtn').addEventListener('click', exportLogs);
    
    document.getElementById('backLink').addEventListener('click', function() {
        window.close();
    });
    
    document.getElementById('searchFilter').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') applyFilters();
    });
    
    document.getElementById('levelFilter').addEventListener('change', applyFilters);
    document.getElementById('moduleFilter').addEventListener('change', applyFilters);
}

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(function() {
        if (autoRefresh) {
            loadLogs();
        }
    }, 3000);
}

function loadLogs() {
    console.log('[Debug] Loading logs...');
    
    browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            browserAPI.tabs.sendMessage(tabs[0].id, { action: 'GET_LOGS' }, function(response) {
                if (browserAPI.runtime.lastError) {
                    console.log('[Debug] Content script not available, trying storage...');
                    loadFromStorage();
                } else if (response && Array.isArray(response)) {
                    console.log('[Debug] Got', response.length, 'logs from content script');
                    allLogs = response;
                    populateModules();
                    applyFilters();
                } else {
                    console.log('[Debug] Invalid response, trying storage...');
                    loadFromStorage();
                }
            });
        } else {
            loadFromStorage();
        }
    });
}

function loadFromStorage() {
    browserAPI.storage.local.get('logs', function(result) {
        var logs = result.logs || [];
        console.log('[Debug] Got', logs.length, 'logs from storage');
        allLogs = logs;
        populateModules();
        applyFilters();
    });
}

function populateModules() {
    var modules = {};
    for (var i = 0; i < allLogs.length; i++) {
        if (allLogs[i].module) {
            modules[allLogs[i].module] = true;
        }
    }
    
    var select = document.getElementById('moduleFilter');
    var currentValue = select.value;
    
    select.innerHTML = '<option value="ALL">All Modules</option>';
    
    var moduleNames = Object.keys(modules).sort();
    for (var j = 0; j < moduleNames.length; j++) {
        var option = document.createElement('option');
        option.value = moduleNames[j];
        option.textContent = moduleNames[j];
        select.appendChild(option);
    }
    
    if (currentValue && currentValue !== 'ALL') {
        select.value = currentValue;
    }
}

function applyFilters() {
    var levelFilter = document.getElementById('levelFilter').value;
    var moduleFilter = document.getElementById('moduleFilter').value;
    var searchFilter = document.getElementById('searchFilter').value.toLowerCase();
    
    filteredLogs = allLogs.filter(function(log) {
        if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
        if (moduleFilter !== 'ALL' && log.module !== moduleFilter) return false;
        if (searchFilter) {
            var searchText = (log.message || '').toLowerCase() + ' ' +
                           (log.module || '').toLowerCase() + ' ' +
                           JSON.stringify(log.data || {}).toLowerCase();
            if (searchText.indexOf(searchFilter) === -1) return false;
        }
        return true;
    });
    
    renderLogs(filteredLogs);
    updateStats();
}

function updateStats() {
    document.getElementById('logCount').textContent = filteredLogs.length + ' entries';
    document.getElementById('statTotal').textContent = allLogs.length;
    
    var infoCount = 0, warnCount = 0, errorCount = 0, debugCount = 0;
    for (var i = 0; i < allLogs.length; i++) {
        switch (allLogs[i].level) {
            case 'INFO': infoCount++; break;
            case 'WARN': warnCount++; break;
            case 'ERROR': 
            case 'FATAL': errorCount++; break;
            case 'DEBUG': debugCount++; break;
        }
    }
    
    document.getElementById('statInfo').textContent = infoCount;
    document.getElementById('statWarn').textContent = warnCount;
    document.getElementById('statError').textContent = errorCount;
    document.getElementById('statDebug').textContent = debugCount;
}

function renderLogs(logs) {
    var container = document.getElementById('logContainer');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="empty"><span class="empty-icon">📭</span>No logs found<br><small style="color:#444;margin-top:8px;display:block;">Logs will appear here as the extension runs</small></div>';
        return;
    }
    
    var reversed = logs.slice().reverse();
    
    var html = '';
    for (var i = 0; i < reversed.length; i++) {
        var log = reversed[i];
        var levelClass = 'level-' + (log.level || 'INFO');
        var timestamp = log.timestamp || '';
        
        var timeStr = timestamp;
        try {
            var date = new Date(timestamp);
            timeStr = date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
        } catch (e) {}
        
        var moduleName = log.module || '-';
        var message = escapeHtml(log.message || '');
        
        var dataStr = '';
        var dataFull = '';
        if (log.data && Object.keys(log.data).length > 0) {
            try {
                dataStr = JSON.stringify(log.data).substring(0, 80);
                if (dataStr.length >= 80) dataStr += '...';
                dataFull = JSON.stringify(log.data, null, 2);
            } catch (e) {
                dataStr = '[object]';
            }
        }
        
        var hasData = dataFull.length > 0;
        
        html += '<div class="log-entry">' +
            '<span class="log-level ' + levelClass + '">' + (log.level || 'INFO') + '</span>' +
            '<span class="log-time">' + timeStr + '</span>' +
            '<span class="log-module">' + escapeHtml(moduleName) + '</span>' +
            '<span class="log-message">' + message +
                (hasData ? ' <button class="expand-btn" onclick="toggleData(this)">▼</button>' : '') +
            '</span>' +
            '<span class="log-data">' + escapeHtml(dataStr) + '</span>' +
            (hasData ? '<div class="log-data-full">' + escapeHtml(dataFull) + '</div>' : '') +
            '</div>';
    }
    
    container.innerHTML = html;
    container.scrollTop = 0;
}

function toggleData(btn) {
    var entry = btn.closest('.log-entry');
    var fullData = entry.querySelector('.log-data-full');
    if (fullData) {
        fullData.classList.toggle('show');
        btn.textContent = fullData.classList.contains('show') ? '▲' : '▼';
    }
}

window.toggleData = toggleData;

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearLogs() {
    if (!confirm('🗑 Clear all debug logs?\n\nThis action cannot be undone.')) return;
    
    browserAPI.storage.local.set({ logs: [] }, function() {
        allLogs = [];
        filteredLogs = [];
        renderLogs([]);
        updateStats();
        showToast('🗑 Logs cleared');
    });
}

function exportLogs() {
    if (allLogs.length === 0) {
        showToast('No logs to export');
        return;
    }
    
    var dataStr = JSON.stringify(allLogs, null, 2);
    var blob = new Blob([dataStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'buylead-debug-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('📥 Exported ' + allLogs.length + ' logs');
}

function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.animation = 'fadeInUp 0.3s ease';
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.style.animation = 'fadeOutDown 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
}

window.addEventListener('unload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
});