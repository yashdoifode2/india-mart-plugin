// config/config.js
// Full CRUD for filters + keywords management
// Developed by CodeNagpur.in
// Version 6.0.0

console.log('⚙️ BuyLead Assistant Config v6.0.0');

var browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
var SUPABASE_URL = 'https://zvhuromubukylsxrsfiz.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aHVyb211YnVreWxzeHJzZml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODI4MDYsImV4cCI6MjEwMzY1ODgwNn0.29J2uGHxFhPtEqRZvnXjaYpL-x4I0uEc2TT8u9d5PVw';

var SB_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

var supabaseEnabled = true;
var editingFilterId = null;

var DEFAULT_CONFIG = {
    mode: 'AUTOMATIC',
    minScore: 60,
    maxPerMinute: 5, maxPerHour: 20, maxPerDay: 50, maxPerSession: 30, cooldownMs: 2000,
    strictCountryMode: false,
    allowedCountries: ['IN'],
    strictCountryRejectUnknown: true,
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

// ============================================================
// TOAST
// ============================================================
function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() {
        toast.style.animation = 'toastOut 0.3s ease';
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3200);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
    loadKeywords();
    loadSupabaseSetting();
    loadFilters();
    refreshCounts();
    setupTabs();
    setupModeButtons();
    setupEventListeners();
    setupKeywordCounters();
    setupModal();
});

function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            var target = document.getElementById('tab-' + this.dataset.tab);
            if (target) target.classList.add('active');
            if (this.dataset.tab === 'data') refreshCounts();
            if (this.dataset.tab === 'filters') loadFilters();
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
    if (!infoBox) return;
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

function setupModal() {
    var modal = document.getElementById('filterModal');
    var closeBtn = document.getElementById('filterModalClose');
    var cancelBtn = document.getElementById('filterModalCancel');
    var saveBtn = document.getElementById('filterModalSave');

    function closeModal() {
        modal.style.display = 'none';
        editingFilterId = null;
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener('click', saveFilter);
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // General
    document.getElementById('saveAllBtn').addEventListener('click', saveAll);
    document.getElementById('resetAllBtn').addEventListener('click', resetAllToDefaults);
    document.getElementById('saveKeywordsBtn').addEventListener('click', saveLocalKeywords);
    document.getElementById('resetKeywordsBtn').addEventListener('click', resetLocalKeywords);
    document.getElementById('saveScoringBtn').addEventListener('click', saveScoring);
    document.getElementById('resetScoringBtn').addEventListener('click', resetScoring);
    document.getElementById('backBtn').addEventListener('click', function() { window.close(); });
    document.getElementById('debugLink').addEventListener('click', function() {
        browserAPI.tabs.create({ url: browserAPI.runtime.getURL('debug/index.html') });
    });

    // Supabase toggle
    document.getElementById('configSupabaseToggle').addEventListener('change', function() {
        var enabled = this.checked;
        supabaseEnabled = enabled;
        browserAPI.storage.local.set({ supabaseEnabled: enabled }, function() {
            updateConfigSupabaseUI(enabled);
            browserAPI.runtime.sendMessage({ action: 'TOGGLE_SUPABASE', enabled: enabled });
            showToast(enabled ? '☁️ Supabase ON' : '📴 Supabase OFF', 'success');
        });
    });

    // Filters
    document.getElementById('refreshFiltersBtn').addEventListener('click', function() {
        loadFilters(true);
    });
    document.getElementById('addFilterBtn').addEventListener('click', function() {
        openFilterModal(null);
    });
    document.getElementById('bulkSyncBtn').addEventListener('click', bulkSyncKeywords);

    // Strict country
    ['strictCountryMode', 'allowedCountries', 'strictCountryRejectUnknown'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateStrictCountryPreview);
            el.addEventListener('input', updateStrictCountryPreview);
        }
    });

    // Counts
    document.getElementById('refreshCountsBtn').addEventListener('click', function() {
        var btn = this;
        var orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Refreshing...';
        refreshCounts();
        setTimeout(function() {
            btn.disabled = false;
            btn.textContent = orig;
        }, 1000);
    });

    // Data management buttons (data-action)
    var dataActions = {
        'clearDupCache': function() {
            if (!confirm('Clear the duplicate cache?')) return;
            browserAPI.runtime.sendMessage({ action: 'CLEAR_DUPLICATE_CACHE' }, function(r) {
                showToast(r && r.success ? '✅ Duplicate cache cleared' : '⚠️ ' + (r ? r.error : 'Failed'), r && r.success ? 'success' : 'error');
            });
        },
        'clearAllLocal': function() {
            if (!confirm('Delete ALL local data? (config & keywords kept)')) return;
            if (!confirm('Confirm again?')) return;
            browserAPI.runtime.sendMessage({ action: 'CLEAR_ALL_LOCAL_DATA' }, function() {
                showToast('🗑️ Local data cleared', 'success');
            });
        },
        'resetStats': function() {
            if (!confirm('Reset filter stats in Supabase?')) return;
            browserAPI.runtime.sendMessage({ action: 'SUPABASE_RESET_STATS' }, function(r) {
                showToast(r && r.success ? '✅ Stats reset' : '❌ ' + (r ? r.error : 'Failed'), r && r.success ? 'success' : 'error');
                refreshCounts();
            });
        },
        'clearHistory': function() {
            if (!confirm('⚠️ Delete ALL lead history from Supabase?')) return;
            if (!confirm('Confirm again?')) return;
            browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_HISTORY' }, function(r) {
                showToast(r && r.success ? '✅ History deleted' : '❌ ' + (r ? r.error : 'Failed'), r && r.success ? 'success' : 'error');
                refreshCounts();
            });
        },
        'clearLeads': function() {
            if (!confirm('☢️ Delete ALL LEADS from Supabase?\nThis cascades to history.')) return;
            var txt = prompt('Type "DELETE ALL" to confirm:');
            if (txt !== 'DELETE ALL') { showToast('❌ Cancelled', 'error'); return; }
            browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_LEADS' }, function(r) {
                showToast(r && r.success ? '🗑️ Leads deleted' : '❌ ' + (r ? r.error : 'Failed'), r && r.success ? 'success' : 'error');
                refreshCounts();
            });
        },
        'clearBefore': function() {
            var dateStr = prompt('Delete leads before (YYYY-MM-DD):');
            if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { showToast('❌ Invalid date', 'error'); return; }
            if (!confirm('Delete leads before ' + dateStr + '?')) return;
            browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_BEFORE', date: dateStr + 'T00:00:00Z' }, function(r) {
                showToast(r && r.success ? '✅ Deleted' : '❌ ' + (r ? r.error : 'Failed'), r && r.success ? 'success' : 'error');
                refreshCounts();
            });
        },
        'clearFilters': function() {
            if (!confirm('⚠️ Delete ALL filters from Supabase?\nThis removes all your filter configurations.')) return;
            var txt = prompt('Type "DELETE FILTERS" to confirm:');
            if (txt !== 'DELETE FILTERS') { showToast('❌ Cancelled', 'error'); return; }
            browserAPI.runtime.sendMessage({ action: 'SUPABASE_CLEAR_FILTERS' }, function(r) {
                showToast(r && r.success ? '🗑️ Filters deleted' : '❌ ' + (r ? r.error : 'Failed'), r && r.success ? 'success' : 'error');
                loadFilters();
                refreshCounts();
            });
        }
    };

    document.querySelectorAll('[data-action]').forEach(function(el) {
        var action = el.getAttribute('data-action');
        if (dataActions[action]) {
            el.addEventListener('click', dataActions[action]);
        }
    });
}

// ============================================================
// LOAD CONFIG
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
        Object.keys(pMap).forEach(function(k) {
            var el = document.getElementById(pMap[k]);
            if (el) el.value = p[k];
        });

        var elPC = document.getElementById('preferredCountries');
        if (elPC) elPC.value = (m.preferredCountries || DEFAULT_CONFIG.preferredCountries).join(', ');
        var elPS = document.getElementById('preferredStates');
        if (elPS) elPS.value = (m.preferredStates || DEFAULT_CONFIG.preferredStates).join(', ');

        var elSCM = document.getElementById('strictCountryMode');
        if (elSCM) elSCM.checked = m.strictCountryMode === true;
        var elAC = document.getElementById('allowedCountries');
        if (elAC) elAC.value = (m.allowedCountries || DEFAULT_CONFIG.allowedCountries).join(', ');
        var elSCRU = document.getElementById('strictCountryRejectUnknown');
        if (elSCRU) elSCRU.checked = m.strictCountryRejectUnknown !== false;
        updateStrictCountryPreview();
    });
}

function updateStrictCountryPreview() {
    var el = document.getElementById('strictCountryPreview');
    if (!el) return;
    var enabled = document.getElementById('strictCountryMode').checked;
    var raw = document.getElementById('allowedCountries').value || '';
    var list = raw.split(',').map(function(c) { return c.toUpperCase().trim(); }).filter(function(c) { return c; });
    var rejectUnknown = document.getElementById('strictCountryRejectUnknown').checked;

    if (!enabled) {
        el.innerHTML = '🌍 <strong>Strict mode OFF</strong> — all countries accepted';
        el.style.background = '#1e1810'; el.style.borderLeftColor = '#f5a623'; el.style.color = '#f5a623';
    } else if (list.length === 0) {
        el.innerHTML = '⚠️ <strong>Strict mode ON but no countries configured</strong> — ALL leads blocked';
        el.style.background = '#1e1012'; el.style.borderLeftColor = '#ef7076'; el.style.color = '#ffb0b0';
    } else {
        el.innerHTML = '🌍 <strong>STRICT MODE ON</strong> — Only: <strong style="color:#02A699;">' + list.join(', ') + '</strong>' +
            (rejectUnknown ? '<br><em style="font-size:10px;">Unknown countries also rejected</em>' : '');
        el.style.background = '#0f1f1e'; el.style.borderLeftColor = '#02A699'; el.style.color = '#02A699';
    }
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
// FILTERS CRUD
// ============================================================
async function loadFilters(forceRefresh) {
    var container = document.getElementById('filtersList');
    var countEl = document.getElementById('filtersCount');
    if (!container) return;

    if (!supabaseEnabled) {
        container.innerHTML = '<div class="empty-state">📴 Supabase is OFF — filters not available</div>';
        if (countEl) countEl.textContent = '0';
        return;
    }

    container.innerHTML = '<div class="empty-state">⏳ Loading filters...</div>';

    try {
        var res = await fetch(SUPABASE_URL + '/rest/v1/filters?select=*&order=id.asc', {
            headers: SB_HEADERS
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).substring(0, 200));

        var filters = await res.json();
        if (countEl) countEl.textContent = filters.length;

        if (filters.length === 0) {
            container.innerHTML = '<div class="empty-state">📭 No filters yet. Click "➕ Add New Filter" to create one.</div>';
            return;
        }

        container.innerHTML = filters.map(renderFilterCard).join('');
        bindFilterActions();
    } catch (err) {
        container.innerHTML = '<div class="empty-state error">❌ Failed: ' + escapeHtml(err.message) + '</div>';
        if (countEl) countEl.textContent = '0';
    }
}

function renderFilterCard(f) {
    var config = f.filter_config || {};
    var pk = Array.isArray(f.product_keywords) ? f.product_keywords : (config.product_names || []);
    var nk = Array.isArray(f.negative_keywords) ? f.negative_keywords : (config.negative_keywords || []);
    var rk = Array.isArray(f.required_keywords) ? f.required_keywords : (config.required_keywords || []);
    var lk = Array.isArray(f.location_keywords) ? f.location_keywords : [];

    // Fallback: derive keywords from filter_config for display
    if (pk.length === 0 && Array.isArray(config.product_names)) pk = config.product_names;
    if (nk.length === 0 && Array.isArray(config.negative_keywords)) nk = config.negative_keywords;
    if (rk.length === 0 && Array.isArray(config.required_keywords)) rk = config.required_keywords;
    if (lk.length === 0) {
        lk = []
            .concat(Array.isArray(config.countries) ? config.countries : [])
            .concat(Array.isArray(config.states) ? config.states : []);
    }

    var isActive = f.is_active !== false;
    var isRunning = f.is_running === true;

    function pillList(arr, emptyMsg) {
        if (!arr || arr.length === 0) {
            return '<span style="color:#555;font-style:italic;">' + emptyMsg + '</span>';
        }
        return arr.slice(0, 30).map(function(k) {
            return '<span class="kw-pill">' + escapeHtml(String(k)) + '</span>';
        }).join('') + (arr.length > 30 ? ' <span style="color:#666;">+' + (arr.length - 30) + ' more</span>' : '');
    }

    return '' +
        '<div class="filter-card ' + (isActive ? '' : 'inactive') + '" data-filter-id="' + f.id + '">' +
            '<div class="filter-header">' +
                '<div class="filter-header-left">' +
                    '<div class="filter-name">' +
                        escapeHtml(f.filter_name || 'Unnamed Filter') +
                        '<span class="filter-badge ' + (isActive ? 'active' : 'inactive') + '">' +
                            (isActive ? '✓ Active' : '✗ Inactive') +
                        '</span>' +
                        (isRunning ? '<span class="filter-badge running">🟢 Running</span>' : '') +
                    '</div>' +
                    '<div class="filter-meta">ID: ' + f.id + ' • Client: ' + escapeHtml(f.client_id || 'default') + '</div>' +
                '</div>' +
            '</div>' +

            '<div class="filter-kw-section">' +
                '<div class="filter-kw-row"><span class="filter-kw-label">📦 PRODUCT</span><span class="filter-kw-value">' + pillList(pk, '(empty — matches any product)') + '</span></div>' +
                '<div class="filter-kw-row"><span class="filter-kw-label">🚫 NEGATIVE</span><span class="filter-kw-value">' + pillList(nk, '(none)') + '</span></div>' +
                '<div class="filter-kw-row"><span class="filter-kw-label">✅ REQUIRED</span><span class="filter-kw-value">' + pillList(rk, '(none)') + '</span></div>' +
                '<div class="filter-kw-row"><span class="filter-kw-label">🌍 LOCATION</span><span class="filter-kw-value">' + pillList(lk, '(none)') + '</span></div>' +
            '</div>' +

            '<div class="filter-stats">' +
                '<span>📊 Scanned: <strong>' + (f.stats_scanned || 0) + '</strong></span>' +
                '<span>✅ Matched: <strong>' + (f.stats_matched || 0) + '</strong></span>' +
                '<span>📞 Clicked: <strong>' + (f.stats_clicked || 0) + '</strong></span>' +
                '<span>📦 P-KW: <strong>' + pk.length + '</strong></span>' +
                '<span>🌍 L-KW: <strong>' + lk.length + '</strong></span>' +
            '</div>' +

            '<div class="filter-actions">' +
                '<button class="btn-tiny btn-edit" data-action="edit" data-id="' + f.id + '">✏️ Edit</button>' +
                '<button class="btn-tiny btn-toggle" data-action="toggle" data-id="' + f.id + '" data-active="' + isActive + '">' + (isActive ? '⏸ Disable' : '▶ Enable') + '</button>' +
                '<button class="btn-tiny btn-delete" data-action="delete" data-id="' + f.id + '">🗑️ Delete</button>' +
            '</div>' +
        '</div>';
}

function bindFilterActions() {
    document.querySelectorAll('[data-action][data-id]').forEach(function(btn) {
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');

        if (action === 'edit') {
            btn.addEventListener('click', function() { editFilter(id); });
        } else if (action === 'toggle') {
            btn.addEventListener('click', function() {
                var active = btn.getAttribute('data-active') === 'true';
                toggleFilter(id, !active);
            });
        } else if (action === 'delete') {
            btn.addEventListener('click', function() { deleteFilter(id); });
        }
    });
}

async function editFilter(id) {
    try {
        var res = await fetch(SUPABASE_URL + '/rest/v1/filters?id=eq.' + id + '&select=*', {
            headers: SB_HEADERS
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var arr = await res.json();
        if (arr.length === 0) throw new Error('Filter not found');
        openFilterModal(arr[0]);
    } catch (err) {
        showToast('❌ Failed to load filter: ' + err.message, 'error');
    }
}

function openFilterModal(filter) {
    editingFilterId = filter ? filter.id : null;

    var modal = document.getElementById('filterModal');
    var title = document.getElementById('filterModalTitle');
    var config = filter && filter.filter_config ? filter.filter_config : {};

    if (filter) {
        title.textContent = 'Edit Filter #' + filter.id;
        document.getElementById('editFilterId').value = filter.id;
        document.getElementById('editFilterName').value = filter.filter_name || '';
        document.getElementById('editClientId').value = filter.client_id || 'default';
        document.getElementById('editIsActive').checked = filter.is_active !== false;

        // Prefer new columns, fallback to filter_config
        var pk = (Array.isArray(filter.product_keywords) && filter.product_keywords.length > 0)
            ? filter.product_keywords
            : (Array.isArray(config.product_names) ? config.product_names : []);
        var nk = (Array.isArray(filter.negative_keywords) && filter.negative_keywords.length > 0)
            ? filter.negative_keywords
            : (Array.isArray(config.negative_keywords) ? config.negative_keywords : []);
        var rk = (Array.isArray(filter.required_keywords) && filter.required_keywords.length > 0)
            ? filter.required_keywords
            : (Array.isArray(config.required_keywords) ? config.required_keywords : []);
        var lk = (Array.isArray(filter.location_keywords) && filter.location_keywords.length > 0)
            ? filter.location_keywords
            : []
                .concat(Array.isArray(config.countries) ? config.countries : [])
                .concat(Array.isArray(config.states) ? config.states : []);

        document.getElementById('editProductKeywords').value = pk.join('\n');
        document.getElementById('editNegativeKeywords').value = nk.join('\n');
        document.getElementById('editRequiredKeywords').value = rk.join('\n');
        document.getElementById('editLocationKeywords').value = lk.join('\n');
    } else {
        title.textContent = 'Add New Filter';
        document.getElementById('editFilterId').value = '';
        document.getElementById('editFilterName').value = '';
        document.getElementById('editClientId').value = 'default';
        document.getElementById('editIsActive').checked = true;
        document.getElementById('editProductKeywords').value = '';
        document.getElementById('editNegativeKeywords').value = '';
        document.getElementById('editRequiredKeywords').value = '';
        document.getElementById('editLocationKeywords').value = '';
    }

    modal.style.display = 'flex';
}

async function saveFilter() {
    var name = document.getElementById('editFilterName').value.trim();
    var clientId = document.getElementById('editClientId').value.trim() || 'default';
    var isActive = document.getElementById('editIsActive').checked;
    var productKw = parseTextarea('editProductKeywords');
    var negativeKw = parseTextarea('editNegativeKeywords');
    var requiredKw = parseTextarea('editRequiredKeywords');
    var locationKw = parseTextarea('editLocationKeywords');

    if (!name) {
        showToast('❌ Filter name is required', 'error');
        return;
    }

    var saveBtn = document.getElementById('filterModalSave');
    var orig = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';

    try {
        // Split location keywords into countries + states
        var countries = locationKw.filter(function(l) {
            return /^(in|us|uk|gb|ae|sa|ru|cn|au|ca|de|fr|jp|br|mx|it|es|kr|nl|za|sg|th|vn|id|my|ph|tr|eg|il|pk|bd|lk|np|india|usa|uk|uae)$/i.test(l)
                || l.length === 2;
        });
        var states = locationKw.filter(function(l) { return countries.indexOf(l) === -1; });

        // Build filter_config (legacy compatible)
        var filterConfig = {
            product_names: productKw,
            negative_keywords: negativeKw,
            required_keywords: requiredKw,
            countries: countries,
            states: states
        };

        // Build full row
        var row = {
            filter_name: name,
            client_id: clientId,
            is_active: isActive,
            filter_config: filterConfig,
            product_keywords: productKw,
            negative_keywords: negativeKw,
            required_keywords: requiredKw,
            location_keywords: locationKw,
            updated_at: new Date().toISOString()
        };

        var url, method;
        if (editingFilterId) {
            url = SUPABASE_URL + '/rest/v1/filters?id=eq.' + editingFilterId;
            method = 'PATCH';
        } else {
            url = SUPABASE_URL + '/rest/v1/filters';
            method = 'POST';
        }

        var res = await fetch(url, {
            method: method,
            headers: SB_HEADERS,
            body: JSON.stringify(row)
        });

        if (!res.ok) {
            var errText = await res.text();
            throw new Error('HTTP ' + res.status + ': ' + errText.substring(0, 200));
        }

        document.getElementById('filterModal').style.display = 'none';
        editingFilterId = null;

        showToast(editingFilterId ? '✅ Filter updated' : '✅ Filter created', 'success');

        // Refresh UI
        await loadFilters(true);
        refreshCounts();

        // Notify content script
        browserAPI.runtime.sendMessage({ action: 'REFRESH_FILTERS' });

    } catch (err) {
        showToast('❌ Save failed: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = orig;
    }
}

async function toggleFilter(id, isActive) {
    try {
        var res = await fetch(SUPABASE_URL + '/rest/v1/filters?id=eq.' + id, {
            method: 'PATCH',
            headers: SB_HEADERS,
            body: JSON.stringify({ is_active: isActive, updated_at: new Date().toISOString() })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        showToast(isActive ? '▶ Filter enabled' : '⏸ Filter disabled', 'success');
        await loadFilters(true);
        browserAPI.runtime.sendMessage({ action: 'REFRESH_FILTERS' });
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
    }
}

async function deleteFilter(id) {
    if (!confirm('⚠️ Delete filter #' + id + ' permanently?')) return;
    if (!confirm('This cannot be undone. Continue?')) return;

    try {
        var res = await fetch(SUPABASE_URL + '/rest/v1/filters?id=eq.' + id, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            }
        });
        if (!res.ok) {
            var errText = await res.text();
            throw new Error('HTTP ' + res.status + ': ' + errText.substring(0, 200));
        }
        showToast('🗑️ Filter deleted', 'success');
        await loadFilters(true);
        refreshCounts();
        browserAPI.runtime.sendMessage({ action: 'REFRESH_FILTERS' });
    } catch (err) {
        showToast('❌ Delete failed: ' + err.message, 'error');
    }
}

async function bulkSyncKeywords() {
    if (!confirm('Sync keywords from filter_config to the new keyword columns for ALL filters?')) return;

    try {
        var res = await fetch(SUPABASE_URL + '/rest/v1/filters?select=*', {
            headers: SB_HEADERS
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var filters = await res.json();

        var success = 0, failed = 0;

        for (var i = 0; i < filters.length; i++) {
            var f = filters[i];
            var config = f.filter_config || {};

            var pk = Array.isArray(config.product_names) ? config.product_names : [];
            var nk = Array.isArray(config.negative_keywords) ? config.negative_keywords : [];
            var rk = Array.isArray(config.required_keywords) ? config.required_keywords : [];
            var lk = []
                .concat(Array.isArray(config.countries) ? config.countries : [])
                .concat(Array.isArray(config.states) ? config.states : []);

            try {
                var ures = await fetch(SUPABASE_URL + '/rest/v1/filters?id=eq.' + f.id, {
                    method: 'PATCH',
                    headers: SB_HEADERS,
                    body: JSON.stringify({
                        product_keywords: pk,
                        negative_keywords: nk,
                        required_keywords: rk,
                        location_keywords: lk,
                        updated_at: new Date().toISOString()
                    })
                });
                if (ures.ok) success++;
                else failed++;
            } catch (e) { failed++; }
        }

        showToast('✅ Sync complete: ' + success + ' updated, ' + failed + ' failed', 'success');
        await loadFilters(true);
    } catch (err) {
        showToast('❌ Sync failed: ' + err.message, 'error');
    }
}

function parseTextarea(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    return el.value.split('\n').map(function(k) { return k.trim(); }).filter(function(k) { return k.length > 0; });
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// COUNTS
// ============================================================
async function refreshCounts() {
    var el1 = document.getElementById('countLeads');
    var el2 = document.getElementById('countHistory');
    var el3 = document.getElementById('countFilters');
    if (el1) el1.textContent = '⏳';
    if (el2) el2.textContent = '⏳';
    if (el3) el3.textContent = '⏳';

    try {
        var [leadsResp, histResp, filtResp] = await Promise.all([
            fetch(SUPABASE_URL + '/rest/v1/leads?select=id', { headers: SB_HEADERS }),
            fetch(SUPABASE_URL + '/rest/v1/lead_history?select=id', { headers: SB_HEADERS }),
            fetch(SUPABASE_URL + '/rest/v1/filters?select=id', { headers: SB_HEADERS })
        ]);

        var leads = leadsResp.ok ? await leadsResp.json() : [];
        var hist = histResp.ok ? await histResp.json() : [];
        var filts = filtResp.ok ? await filtResp.json() : [];

        if (el1) el1.textContent = Array.isArray(leads) ? leads.length : '?';
        if (el2) el2.textContent = Array.isArray(hist) ? hist.length : '?';
        if (el3) el3.textContent = Array.isArray(filts) ? filts.length : '?';
    } catch (err) {
        if (el1) el1.textContent = '?';
        if (el2) el2.textContent = '?';
        if (el3) el3.textContent = '?';
    }
}

// ============================================================
// SAVE / RESET
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

    c.strictCountryMode = document.getElementById('strictCountryMode').checked;
    c.allowedCountries = document.getElementById('allowedCountries').value
        .split(',').map(function(x) { return x.toUpperCase().trim(); }).filter(function(x) { return x; });
    c.strictCountryRejectUnknown = document.getElementById('strictCountryRejectUnknown').checked;

    return c;
}

function getLocalKeywords() {
    return {
        product: parseTextarea('productKeywords'),
        negative: parseTextarea('negativeKeywords'),
        required: parseTextarea('requiredKeywords')
    };
}

function saveAll() {
    var c = getConfig();
    var kw = getLocalKeywords();
    if (c.strictCountryMode && c.allowedCountries.length === 0) {
        showToast('❌ Add at least one country before enabling strict mode', 'error');
        return;
    }
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
        preferredStates: c.preferredStates,
        strictCountryMode: c.strictCountryMode,
        allowedCountries: c.allowedCountries,
        strictCountryRejectUnknown: c.strictCountryRejectUnknown
    }, function() {
        browserAPI.runtime.sendMessage({ action: 'UPDATE_FULL_CONFIG', config: c });
        showToast('✅ Scoring & country saved!', 'success');
    });
}

function resetScoring() {
    if (!confirm('Reset scoring + country to defaults?')) return;
    browserAPI.storage.local.set({
        scoreWeights: DEFAULT_CONFIG.scoreWeights,
        scorePenalties: DEFAULT_CONFIG.scorePenalties,
        preferredCountries: DEFAULT_CONFIG.preferredCountries,
        preferredStates: DEFAULT_CONFIG.preferredStates,
        strictCountryMode: DEFAULT_CONFIG.strictCountryMode,
        allowedCountries: DEFAULT_CONFIG.allowedCountries,
        strictCountryRejectUnknown: DEFAULT_CONFIG.strictCountryRejectUnknown
    }, function() {
        loadConfig();
        browserAPI.runtime.sendMessage({ action: 'UPDATE_FULL_CONFIG', config: getConfig() });
        showToast('✅ Reset', 'success');
    });
}

function saveLocalKeywords() {
    var k = getLocalKeywords();
    browserAPI.storage.local.set({ keywords: k }, function() {
        browserAPI.runtime.sendMessage({ action: 'UPDATE_KEYWORDS', keywords: k });
        showToast('✅ Local keywords saved!', 'success');
    });
}

function resetLocalKeywords() {
    if (!confirm('Clear all local keywords?')) return;
    var e = { product: [], negative: [], required: [] };
    browserAPI.storage.local.set({ keywords: e }, function() {
        loadKeywords();
        browserAPI.runtime.sendMessage({ action: 'UPDATE_KEYWORDS', keywords: e });
        showToast('✅ Cleared', 'success');
    });
}

function resetAllToDefaults() {
    if (!confirm('Reset ALL settings to defaults?')) return;
    if (!confirm('Confirm again?')) return;
    browserAPI.storage.local.set(DEFAULT_CONFIG, function() {
        loadConfig();
        browserAPI.runtime.sendMessage({ action: 'UPDATE_FULL_CONFIG', config: DEFAULT_CONFIG });
        showToast('✅ Reset to defaults', 'success');
    });
}