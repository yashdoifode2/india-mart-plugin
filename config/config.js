// config/config.js
// Full config controller with scoring + data management
// Developed by CodeNagpur.in
// Version 4.9.0

console.log('⚙️ BuyLead Assistant Config v4.9.0');

const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
const SUPABASE_URL = 'https://zvhuromubukylsxrsfiz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aHVyb211YnVreWxzeHJzZml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODI4MDYsImV4cCI6MjEwMzY1ODgwNn0.29J2uGHxFhPtEqRZvnXjaYpL-x4I0uEc2TT8u9d5PVw';

var supabaseEnabled = true;

const DEFAULT_CONFIG = {
    mode: 'AUTOMATIC',
    minScore: 60,
    maxPerMinute: 5, maxPerHour: 20, maxPerDay: 50, maxPerSession: 30, cooldownMs: 2000,
    scoreWeights: {
        base: 50,
        perProductKeyword: 10, maxProductBonus: 30,
        preferredState: 15, countryMatch: 15,
        hasMobile: 10, hasEmail: 8, hasPhone: 5,
        detailedRequirement: 5, requirementLengthThreshold: 100
    },
    scorePenalties: { wrongCountry: -20, wrongState: -10, noContact: -5 },
    preferredStates: ['maharashtra'],
    preferredCountries: ['IN'],
    autoScroll: true, scrollSpeed: 400, scrollDelayMs: 100, bottomWaitMs: 1500,
    loopIntervalMs: 1200, loadMoreWaitMs: 3000, maxStuckLoops: 4,
    maxReloadsPerSession: 20, autoReloadOnComplete: true, autoReloadDelayMs: 2000,
    autoMinimize: true, popupTimeoutMs: 10000,
    confirmationAnswer: 'yes', purchaseAction: 'close',
    supabaseEnabled: true
};

document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
    loadKeywords();
    loadSupabaseSetting();
    loadFiltersFromSupabase();
    refreshCounts();
    setupTabs();
    setupModeButtons();
    setupEventListeners();
    setupKeywordCounters();
});

// ============================================================
// TABS
// ============================================================
function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            var target = document.getElementById('tab-' + this.dataset.tab);
            if (target) target.classList.add('active');
            if (this.dataset.tab === 'data') refreshCounts();
        });
    });
}

function setupModeButtons() {
    document.querySelectorAll('.mode-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            updateModeInfo(this.dataset.mode);
        });
    });
}

function updateModeInfo(mode) {
    var infoBox = document.getElementById('modeInfo');
    var descriptions = {
        'MONITOR': '<strong>Monitor:</strong> Only detects and displays leads.',
        'DRY_RUN': '<strong>Dry Run:</strong> Full pipeline but no real clicks.',
        'ASSISTED': '<strong>Assisted:</strong> Shows approval popup for each matched lead.',
        'AUTOMATIC': '<strong>Automatic:</strong> Auto-clicks "Contact Buyer Now".'
    };
    infoBox.innerHTML = descriptions[mode] || descriptions['MONITOR'];
}

function setupKeywordCounters() {
    ['product', 'negative', 'required'].forEach(function(type) {
        var t = document.getElementById(type + 'Keywords');
        if (t) t.addEventListener('input', function() { updateKeywordCount(type); });
    });
}

function updateKeywordCount(type) {
    var t = document.getElementById(type + 'Keywords');
    if (!t) return;
    var count = t.value.split('\n').filter(function(k) { return k.trim().length > 0; }).length;
    var el = document.getElementById(type + 'Count');
    if (el) el.textContent = count;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    document.getElementById('saveAllBtn').addEventListener('click', saveAll);
    document.getElementById('resetAllBtn').addEventListener('click', resetAllToDefaults);
    document.getElementById('saveKeywordsBtn').addEventListener('click', saveKeywords);
    document.getElementById('resetKeywordsBtn').addEventListener('click', resetKeywords);
    document.getElementById('saveScoringBtn').addEventListener('click', saveScoring);
    document.getElementById('resetScoringBtn').addEventListener('click', resetScoring);
    document.getElementById('refreshFiltersBtn').addEventListener('click', refreshFilters);
    document.getElementById('refreshCountsBtn').addEventListener('click', function() {
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Refreshing...';
        refreshCounts();
        setTimeout(function() {
            btn.disabled = false;
            btn.textContent = origText;
        }, 1200);
    });
    document.getElementById('backBtn').addEventListener('click', function() { window.close(); });
    document.getElementById('debugLink').addEventListener('click', function() {
        browserAPI.tabs.create({ url: browserAPI.runtime.getURL('debug/index.html') });
    });

    document.getElementById('configSupabaseToggle').addEventListener('change', function() {
        var enabled = this.checked;
        supabaseEnabled = enabled;
        browserAPI.storage.local.set({ supabaseEnabled: enabled }, function() {
            updateConfigSupabaseUI(enabled);
            browserAPI.runtime.sendMessage({ action: 'TOGGLE_SUPABASE', enabled: enabled });
            showToast(enabled ? '☁️ Supabase ON' : '📴 Supabase OFF', 'success');
        });
    });

    // ============ LOCAL DATA ============
    document.getElementById('clearDupCacheBtn').addEventListener('click', function() {
        if (!confirm('Clear the in-memory duplicate cache?\n\nAlready-acquired leads may be re-processed.')) return;
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Clearing...';
        browserAPI.runtime.sendMessage({ action: 'CLEAR_DUPLICATE_CACHE' }, function(r) {
            btn.disabled = false;
            btn.textContent = origText;
            if (r && r.success) showToast('✅ ' + (r.message || 'Duplicate cache cleared'), 'success');
            else showToast('⚠️ ' + (r ? r.error : 'Failed'), 'error');
        });
    });

    document.getElementById('clearAllLocalBtn').addEventListener('click', function() {
        if (!confirm('⚠️ Delete ALL local data?\n\nThis removes debug logs, stats, cached data.\nYour keywords and config will be KEPT.')) return;
        if (!confirm('Are you REALLY sure?')) return;
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Clearing...';
        browserAPI.runtime.sendMessage({ action: 'CLEAR_ALL_LOCAL_DATA' }, function() {
            btn.disabled = false;
            btn.textContent = origText;
            showToast('🗑️ Local data cleared (config preserved)', 'success');
        });
    });

    // ============ SUPABASE: RESET FILTER STATS ============
    document.getElementById('resetStatsBtn').addEventListener('click', function() {
        if (!confirm('Reset filter stats in Supabase?\n\nSets scanned/matched/clicked counters to zero.')) return;
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Resetting...';
        browserAPI.runtime.sendMessage({ action: 'SUPABASE_RESET_STATS' }, function(r) {
            btn.disabled = false;
            btn.textContent = origText;
            if (r && r.success) {
                showToast('✅ Filter stats reset to zero', 'success');
                refreshCounts();
            } else {
                showToast('❌ ' + (r ? r.error : 'No response'), 'error');
            }
        });
    });

    // ============ SUPABASE: CLEAR HISTORY ============
    document.getElementById('clearHistoryBtn').addEventListener('click', function() {
        if (!confirm('⚠️ Delete ALL lead history from Supabase?\n\nThis removes every entry in lead_history.')) return;
        if (!confirm('Confirm again: delete all history?')) return;
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Deleting...';
        browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_HISTORY' }, function(r) {
            btn.disabled = false;
            btn.textContent = origText;
            if (r && r.success) {
                showToast('✅ History deleted from Supabase', 'success');
                refreshCounts();
            } else {
                showToast('❌ ' + (r ? r.error : 'No response'), 'error');
            }
        });
    });

    // ============ SUPABASE: CLEAR ALL LEADS ============
    document.getElementById('clearLeadsBtn').addEventListener('click', function() {
        if (!confirm('☢️ Delete ALL LEADS from Supabase?\n\n⚠️ This cascades and deletes history too!')) return;
        if (!confirm('Final warning:\n\nDelete EVERY lead?')) return;
        var confirmText = prompt('Type "DELETE ALL" to confirm:');
        if (confirmText !== 'DELETE ALL') {
            showToast('❌ Cancelled — text did not match', 'error');
            return;
        }
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Deleting...';
        browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_LEADS' }, function(r) {
            btn.disabled = false;
            btn.textContent = origText;
            if (r && r.success) {
                showToast('🗑️ All leads deleted from Supabase', 'success');
                refreshCounts();
            } else {
                showToast('❌ ' + (r ? r.error : 'No response'), 'error');
            }
        });
    });

    // ============ SUPABASE: CLEAR BEFORE DATE ============
    document.getElementById('clearBeforeBtn').addEventListener('click', function() {
        var dateStr = prompt('Delete leads created BEFORE this date.\nFormat: YYYY-MM-DD (e.g. 2026-09-01)');
        if (!dateStr) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            showToast('❌ Invalid date (use YYYY-MM-DD)', 'error');
            return;
        }
        if (!confirm('Delete all leads created before ' + dateStr + '?')) return;
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Deleting...';
        browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_BEFORE', date: dateStr + 'T00:00:00Z' }, function(r) {
            btn.disabled = false;
            btn.textContent = origText;
            if (r && r.success) {
                showToast('✅ Old leads deleted', 'success');
                refreshCounts();
            } else {
                showToast('❌ ' + (r ? r.error : 'No response'), 'error');
            }
        });
    });

    // ============ SUPABASE: CLEAR ALL FILTERS ============
    document.getElementById('clearFiltersBtn').addEventListener('click', function() {
        if (!confirm('⚠️ Delete ALL filters from Supabase?\n\nThis removes the config that drives matching.')) return;
        if (!confirm('Final warning: delete all filters?')) return;
        var confirmText = prompt('Type "DELETE FILTERS" to confirm:');
        if (confirmText !== 'DELETE FILTERS') {
            showToast('❌ Cancelled — text did not match', 'error');
            return;
        }
        var btn = this;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Deleting...';
        browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_FILTERS' }, function(r) {
            btn.disabled = false;
            btn.textContent = origText;
            if (r && r.success) {
                showToast('🗑️ All filters deleted', 'success');
                refreshCounts();
                loadFiltersFromSupabase();
            } else {
                showToast('❌ ' + (r ? r.error : 'No response'), 'error');
            }
        });
    });
}

// ============================================================
// SUPABASE SETTING
// ============================================================
function loadSupabaseSetting() {
    browserAPI.storage.local.get(['supabaseEnabled'], function(result) {
        supabaseEnabled = result.supabaseEnabled !== false;
        var toggle = document.getElementById('configSupabaseToggle');
        if (toggle) toggle.checked = supabaseEnabled;
        updateConfigSupabaseUI(supabaseEnabled);
    });
}

function updateConfigSupabaseUI(enabled) {
    var container = document.getElementById('connectionToggle');
    var icon = document.getElementById('configConnIcon');
    var label = document.getElementById('configConnLabel');
    var desc = document.getElementById('configConnDesc');
    if (enabled) {
        container.classList.remove('offline');
        icon.textContent = '☁️';
        label.textContent = 'Supabase Mode: ON';
        desc.textContent = 'Using CRM filters from Supabase';
    } else {
        container.classList.add('offline');
        icon.textContent = '📴';
        label.textContent = 'Supabase Mode: OFF';
        desc.textContent = 'Offline mode - using local keywords only';
    }
}

// ============================================================
// LOAD CONFIG
// ============================================================
function loadConfig() {
    browserAPI.storage.local.get(DEFAULT_CONFIG, function(config) {
        var m = Object.assign({}, DEFAULT_CONFIG, config);

        document.querySelectorAll('.mode-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.mode === m.mode);
        });
        updateModeInfo(m.mode);

        ['minScore', 'perMinute', 'perHour', 'perDay', 'perSession', 'cooldownMs',
         'scrollSpeed', 'scrollDelayMs', 'bottomWaitMs', 'loopIntervalMs', 'loadMoreWaitMs', 'maxStuckLoops',
         'autoReloadDelayMs', 'maxReloadsPerSession', 'popupTimeoutMs'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = m[id];
        });

        ['autoScroll', 'autoReloadOnComplete', 'autoMinimize'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.checked = m[id] !== false;
        });

        ['confirmationAnswer', 'purchaseAction'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = m[id];
        });

        var w = Object.assign({}, DEFAULT_CONFIG.scoreWeights, m.scoreWeights || {});
        ['base', 'perProductKeyword', 'maxProductBonus', 'preferredState', 'countryMatch',
         'hasMobile', 'hasEmail', 'hasPhone', 'detailedRequirement', 'requirementLengthThreshold'].forEach(function(k) {
            var el = document.getElementById('w' + k.charAt(0).toUpperCase() + k.slice(1));
            if (el) el.value = w[k];
        });

        var p = Object.assign({}, DEFAULT_CONFIG.scorePenalties, m.scorePenalties || {});
        var pMap = { wrongCountry: 'pWrongCountry', wrongState: 'pWrongState', noContact: 'pNoContact' };
        for (var k2 in pMap) {
            var el2 = document.getElementById(pMap[k2]);
            if (el2) el2.value = p[k2];
        }

        var elPC = document.getElementById('preferredCountries');
        if (elPC) elPC.value = (m.preferredCountries || DEFAULT_CONFIG.preferredCountries).join(', ');
        var elPS = document.getElementById('preferredStates');
        if (elPS) elPS.value = (m.preferredStates || DEFAULT_CONFIG.preferredStates).join(', ');
    });
}

function loadKeywords() {
    browserAPI.storage.local.get(['keywords'], function(result) {
        var k = result.keywords || {};
        var el1 = document.getElementById('productKeywords'); if (el1) el1.value = (k.product || []).join('\n');
        var el2 = document.getElementById('negativeKeywords'); if (el2) el2.value = (k.negative || []).join('\n');
        var el3 = document.getElementById('requiredKeywords'); if (el3) el3.value = (k.required || []).join('\n');
        updateKeywordCount('product');
        updateKeywordCount('negative');
        updateKeywordCount('required');
    });
}

// ============================================================
// FILTERS FROM SUPABASE
// ============================================================
async function loadFiltersFromSupabase() {
    var container = document.getElementById('filtersList');
    var statusEl = document.getElementById('filtersStatus');
    if (!container) return;

    if (!supabaseEnabled) {
        container.innerHTML = '<div class="empty-state">📴 Supabase is OFF</div>';
        statusEl.textContent = '⚠️ Supabase disabled';
        return;
    }

    statusEl.textContent = '⏳ Loading filters...';

    try {
        var url = SUPABASE_URL + '/rest/v1/filters?is_active=eq.true&select=*&order=id.asc';
        var response = await fetch(url, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);
        var filters = await response.json();

        if (filters.length === 0) {
            container.innerHTML = '<div class="empty-state">📭 No active filters in Supabase</div>';
            statusEl.textContent = '⚠️ No active filters';
            return;
        }

        var html = '';
        for (var i = 0; i < filters.length; i++) {
            var f = filters[i];
            var cfg = f.filter_config || {};
            var kw = (cfg.product_names || []).join(', ');
            var neg = (cfg.negative_keywords || []).join(', ');

            html += '<div class="filter-card">' +
                '<div class="filter-header">' +
                    '<span class="filter-name">' + escapeHtml(f.filter_name || 'Unnamed') + '</span>' +
                    '<span class="filter-badge ' + (f.is_running ? 'running' : 'idle') + '">' +
                        (f.is_running ? '🟢 Running' : '⚪ Idle') +
                    '</span>' +
                '</div>' +
                '<div class="filter-row"><span class="filter-label">Client:</span><span>' + escapeHtml(f.client_id || 'default') + '</span></div>' +
                (kw ? '<div class="filter-row"><span class="filter-label">Products:</span><span>' + escapeHtml(kw) + '</span></div>' : '') +
                (neg ? '<div class="filter-row"><span class="filter-label">Negative:</span><span>' + escapeHtml(neg) + '</span></div>' : '') +
                '<div class="filter-stats">' +
                    '<span>📊 Scanned: <strong>' + (f.stats_scanned || 0) + '</strong></span>' +
                    '<span>✅ Matched: <strong>' + (f.stats_matched || 0) + '</strong></span>' +
                    '<span>📞 Clicked: <strong>' + (f.stats_clicked || 0) + '</strong></span>' +
                '</div>' +
            '</div>';
        }
        container.innerHTML = html;
        statusEl.textContent = '✅ ' + filters.length + ' active filter(s)';
    } catch (err) {
        container.innerHTML = '<div class="empty-state error">❌ Failed: ' + escapeHtml(err.message) + '</div>';
        statusEl.textContent = '❌ Error loading filters';
    }
}

// ============================================================
// REFRESH COUNTS (via service worker, RLS-safe)
// ============================================================
function refreshCounts() {
    var el1 = document.getElementById('countLeads');
    var el2 = document.getElementById('countHistory');
    if (el1) el1.textContent = '⏳';
    if (el2) el2.textContent = '⏳';

    browserAPI.runtime.sendMessage({ action: 'SUPABASE_GET_COUNTS' }, function(r) {
        if (browserAPI.runtime.lastError) {
            console.error('[Config] Runtime error:', browserAPI.runtime.lastError);
            if (el1) el1.textContent = '?';
            if (el2) el2.textContent = '?';
            return;
        }
        if (r && r.success) {
            if (el1) el1.textContent = r.leads;
            if (el2) el2.textContent = r.history;
            console.log('[Config] Counts updated:', r);
        } else {
            if (el1) el1.textContent = '?';
            if (el2) el2.textContent = '?';
            console.warn('[Config] Count fetch failed:', r);
        }
    });
}

async function refreshFilters() {
    if (!supabaseEnabled) { showToast('⚠️ Supabase is OFF', 'error'); return; }
    showToast('🔄 Refreshing filters...', 'success');
    await loadFiltersFromSupabase();
    browserAPI.runtime.sendMessage({ action: 'REFRESH_FILTERS' });
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// GET CONFIG / KEYWORDS
// ============================================================
function getConfig() {
    var activeMode = document.querySelector('.mode-btn.active');
    var c = Object.assign({}, DEFAULT_CONFIG);
    c.mode = activeMode ? activeMode.dataset.mode : 'AUTOMATIC';

    ['minScore', 'perMinute', 'perHour', 'perDay', 'perSession', 'cooldownMs',
     'scrollSpeed', 'scrollDelayMs', 'bottomWaitMs', 'loopIntervalMs', 'loadMoreWaitMs', 'maxStuckLoops',
     'autoReloadDelayMs', 'maxReloadsPerSession', 'popupTimeoutMs'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) c[id] = parseInt(el.value, 10) || 0;
    });

    ['autoScroll', 'autoReloadOnComplete', 'autoMinimize'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) c[id] = el.checked;
    });

    c.confirmationAnswer = document.getElementById('confirmationAnswer').value;
    c.purchaseAction = document.getElementById('purchaseAction').value;
    c.maxPerMinute = c.perMinute;
    c.maxPerHour = c.perHour;
    c.maxPerDay = c.perDay;
    c.maxPerSession = c.perSession;
    c.supabaseEnabled = supabaseEnabled;

    c.scoreWeights = {
        base: parseInt(document.getElementById('wBase').value, 10) || 0,
        perProductKeyword: parseInt(document.getElementById('wPerProductKeyword').value, 10) || 0,
        maxProductBonus: parseInt(document.getElementById('wMaxProductBonus').value, 10) || 0,
        preferredState: parseInt(document.getElementById('wPreferredState').value, 10) || 0,
        countryMatch: parseInt(document.getElementById('wCountryMatch').value, 10) || 0,
        hasMobile: parseInt(document.getElementById('wHasMobile').value, 10) || 0,
        hasEmail: parseInt(document.getElementById('wHasEmail').value, 10) || 0,
        hasPhone: parseInt(document.getElementById('wHasPhone').value, 10) || 0,
        detailedRequirement: parseInt(document.getElementById('wDetailedRequirement').value, 10) || 0,
        requirementLengthThreshold: parseInt(document.getElementById('wRequirementLengthThreshold').value, 10) || 100
    };

    c.scorePenalties = {
        wrongCountry: parseInt(document.getElementById('pWrongCountry').value, 10) || 0,
        wrongState: parseInt(document.getElementById('pWrongState').value, 10) || 0,
        noContact: parseInt(document.getElementById('pNoContact').value, 10) || 0
    };

    c.preferredCountries = document.getElementById('preferredCountries').value
        .split(',').map(function(x) { return x.trim().toUpperCase(); }).filter(function(x) { return x; });
    c.preferredStates = document.getElementById('preferredStates').value
        .split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(function(x) { return x; });

    return c;
}

function getKeywords() {
    return {
        product: document.getElementById('productKeywords').value.split('\n').map(function(k) { return k.trim(); }).filter(function(k) { return k.length > 0; }),
        negative: document.getElementById('negativeKeywords').value.split('\n').map(function(k) { return k.trim(); }).filter(function(k) { return k.length > 0; }),
        required: document.getElementById('requiredKeywords').value.split('\n').map(function(k) { return k.trim(); }).filter(function(k) { return k.length > 0; })
    };
}

// ============================================================
// SAVE FUNCTIONS
// ============================================================
function saveAll() {
    var c = getConfig();
    var kw = getKeywords();
    var errs = validateConfig(c);
    if (errs.length > 0) { showToast('❌ ' + errs.join(' • '), 'error'); return; }
    c.keywords = kw;
    c.userSetMode = true;
    browserAPI.storage.local.set(c, function() {
        browserAPI.runtime.sendMessage({ action: 'UPDATE_FULL_CONFIG', config: c });
        browserAPI.runtime.sendMessage({ action: 'UPDATE_KEYWORDS', keywords: kw });
        showToast('✅ All settings saved!', 'success');
    });
}

function saveScoring() {
    var c = getConfig();
    browserAPI.storage.local.set({
        scoreWeights: c.scoreWeights,
        scorePenalties: c.scorePenalties,
        preferredCountries: c.preferredCountries,
        preferredStates: c.preferredStates
    }, function() {
        browserAPI.runtime.sendMessage({ action: 'UPDATE_FULL_CONFIG', config: c });
        showToast('✅ Scoring saved!', 'success');
    });
}

function resetScoring() {
    if (!confirm('Reset scoring to defaults?')) return;
    browserAPI.storage.local.set({
        scoreWeights: DEFAULT_CONFIG.scoreWeights,
        scorePenalties: DEFAULT_CONFIG.scorePenalties,
        preferredCountries: DEFAULT_CONFIG.preferredCountries,
        preferredStates: DEFAULT_CONFIG.preferredStates
    }, function() {
        loadConfig();
        browserAPI.runtime.sendMessage({ action: 'UPDATE_FULL_CONFIG', config: getConfig() });
        showToast('✅ Scoring reset', 'success');
    });
}

function saveKeywords() {
    var k = getKeywords();
    browserAPI.storage.local.set({ keywords: k }, function() {
        browserAPI.runtime.sendMessage({ action: 'UPDATE_KEYWORDS', keywords: k });
        showToast('✅ Keywords saved!', 'success');
    });
}

function resetKeywords() {
    if (!confirm('Clear all keywords?')) return;
    var e = { product: [], negative: [], required: [] };
    browserAPI.storage.local.set({ keywords: e }, function() {
        loadKeywords();
        browserAPI.runtime.sendMessage({ action: 'UPDATE_KEYWORDS', keywords: e });
        showToast('✅ Keywords cleared', 'success');
    });
}

function resetAllToDefaults() {
    if (!confirm('Reset ALL settings to defaults?')) return;
    if (!confirm('Confirm again: reset everything?')) return;
    browserAPI.storage.local.set(DEFAULT_CONFIG, function() {
        loadConfig();
        browserAPI.runtime.sendMessage({ action: 'UPDATE_FULL_CONFIG', config: DEFAULT_CONFIG });
        showToast('✅ Reset to defaults', 'success');
    });
}

function validateConfig(c) {
    var e = [];
    if (c.minScore < 0 || c.minScore > 100) e.push('Score 0-100');
    if (c.perMinute > c.perHour) e.push('Min ≤ Hour');
    if (c.perHour > c.perDay) e.push('Hour ≤ Day');
    if (c.perSession > c.perDay) e.push('Session ≤ Day');
    if (c.scoreWeights.base < 0 || c.scoreWeights.base > 100) e.push('Base 0-100');
    return e;
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
    }, 3000);
}