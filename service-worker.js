// service-worker.js
// Background service worker - direct Supabase data management
// Developed by CodeNagpur.in
// Version 4.9.0

console.log('🔧 BuyLead Assistant Service Worker v4.9.0');
console.log('📦 Developed by CodeNagpur.in');

const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
let cachedStatus = null;
let filterMonitorInterval = null;

const SUPABASE_URL = 'https://zvhuromubukylsxrsfiz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aHVyb211YnVreWxzeHJzZml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODI4MDYsImV4cCI6MjEwMzY1ODgwNn0.29J2uGHxFhPtEqRZvnXjaYpL-x4I0uEc2TT8u9d5PVw';

// ============================================================
// SUPABASE HELPERS
// ============================================================
function sbHeaders(extra) {
    var h = {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
    };
    if (extra) {
        for (var k in extra) {
            if (extra.hasOwnProperty(k)) h[k] = extra[k];
        }
    }
    return h;
}

// ============================================================
// INSTALLATION
// ============================================================
browserAPI.runtime.onInstalled.addListener(function() {
    console.log('[SW] BuyLead Assistant v4.9.0 installed');

    browserAPI.storage.local.get(['initialized'], function(result) {
        if (!result.initialized) {
            browserAPI.storage.local.set({
                initialized: true,
                mode: 'AUTOMATIC',
                userSetMode: false,
                supabaseEnabled: true,
                minScore: 60,
                maxPerMinute: 5,
                maxPerHour: 20,
                maxPerDay: 50,
                maxPerSession: 30,
                cooldownMs: 2000,
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
                autoScroll: true,
                autoReloadOnComplete: true,
                autoMinimize: true,
                popupTimeoutMs: 10000,
                confirmationAnswer: 'yes',
                purchaseAction: 'close',
                logs: [],
                keywords: { product: [], negative: [], required: [], location: [] }
            });
            console.log('[SW] ✅ Defaults initialized');
        }
    });

    startFilterMonitoring();
});

// ============================================================
// STARTUP
// ============================================================
browserAPI.runtime.onStartup.addListener(function() {
    console.log('[SW] Extension started');
    startFilterMonitoring();
});

// ============================================================
// FILTER MONITORING
// ============================================================
function startFilterMonitoring() {
    if (filterMonitorInterval) clearInterval(filterMonitorInterval);
    filterMonitorInterval = setInterval(function() {
        checkActiveFilters();
    }, 30000);
    setTimeout(checkActiveFilters, 2000);
}

async function checkActiveFilters() {
    try {
        const settings = await new Promise(function(resolve) {
            browserAPI.storage.local.get(['supabaseEnabled'], function(result) {
                resolve(result);
            });
        });

        if (settings.supabaseEnabled === false) {
            await browserAPI.storage.local.set({
                hasActiveFilters: false,
                activeFilterCount: 0,
                lastFilterCheck: Date.now()
            });
            return;
        }

        const url = SUPABASE_URL + '/rest/v1/filters?is_active=eq.true&select=id,is_running,stats_scanned,stats_matched,stats_clicked';
        const response = await fetch(url, { headers: sbHeaders() });
        if (!response.ok) return;

        const filters = await response.json();
        const hasActiveFilters = filters.length > 0;

        await browserAPI.storage.local.set({
            hasActiveFilters: hasActiveFilters,
            activeFilterCount: filters.length,
            lastFilterCheck: Date.now()
        });

        try {
            browserAPI.runtime.sendMessage({
                action: 'FILTER_STATUS_UPDATE',
                hasActiveFilters: hasActiveFilters,
                filterCount: filters.length,
                filters: filters
            });
        } catch (e) {}
    } catch (err) {
        console.warn('[SW] checkActiveFilters failed:', err);
    }
}

// ============================================================
// SUPABASE DATA OPERATIONS
// ============================================================

/**
 * Delete ALL leads (cascades to history via FK)
 */
async function sbClearAllLeads() {
    console.log('[SW] sbClearAllLeads called');
    try {
        var url = SUPABASE_URL + '/rest/v1/leads?id=gte.0';
        var response = await fetch(url, {
            method: 'DELETE',
            headers: sbHeaders({ 'Prefer': 'return=minimal' })
        });
        console.log('[SW] DELETE leads status:', response.status);
        if (!response.ok) {
            var text = await response.text();
            console.error('[SW] DELETE leads error:', text);
            throw new Error('HTTP ' + response.status + ': ' + text.substring(0, 200));
        }
        console.log('[SW] 🗑️ All leads deleted');
        return { success: true, message: 'All leads deleted' };
    } catch (err) {
        console.error('[SW] Clear leads failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Delete ALL lead_history rows
 */
async function sbClearAllHistory() {
    console.log('[SW] sbClearAllHistory called');
    try {
        var url = SUPABASE_URL + '/rest/v1/lead_history?id=gte.0';
        var response = await fetch(url, {
            method: 'DELETE',
            headers: sbHeaders({ 'Prefer': 'return=minimal' })
        });
        console.log('[SW] DELETE history status:', response.status);
        if (!response.ok) {
            var text = await response.text();
            console.error('[SW] DELETE history error:', text);
            throw new Error('HTTP ' + response.status + ': ' + text.substring(0, 200));
        }
        console.log('[SW] 🗑️ All history deleted');
        return { success: true, message: 'All history deleted' };
    } catch (err) {
        console.error('[SW] Clear history failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Delete ALL filters
 */
async function sbClearAllFilters() {
    console.log('[SW] sbClearAllFilters called');
    try {
        var url = SUPABASE_URL + '/rest/v1/filters?id=gte.0';
        var response = await fetch(url, {
            method: 'DELETE',
            headers: sbHeaders({ 'Prefer': 'return=minimal' })
        });
        console.log('[SW] DELETE filters status:', response.status);
        if (!response.ok) {
            var text = await response.text();
            console.error('[SW] DELETE filters error:', text);
            throw new Error('HTTP ' + response.status + ': ' + text.substring(0, 200));
        }
        console.log('[SW] 🗑️ All filters deleted');
        return { success: true, message: 'All filters deleted' };
    } catch (err) {
        console.error('[SW] Clear filters failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Reset filter stats to zero
 */
async function sbResetFilterStats() {
    console.log('[SW] sbResetFilterStats called');
    try {
        var url = SUPABASE_URL + '/rest/v1/filters?is_active=eq.true';
        var body = {
            stats_scanned: 0,
            stats_matched: 0,
            stats_clicked: 0,
            is_running: false,
            updated_at: new Date().toISOString()
        };
        var response = await fetch(url, {
            method: 'PATCH',
            headers: sbHeaders(),
            body: JSON.stringify(body)
        });
        console.log('[SW] PATCH status:', response.status);
        if (!response.ok) {
            var text = await response.text();
            console.error('[SW] PATCH error:', text);
            throw new Error('HTTP ' + response.status + ': ' + text.substring(0, 200));
        }
        console.log('[SW] 🔄 Filter stats reset');
        return { success: true, message: 'Stats reset' };
    } catch (err) {
        console.error('[SW] Reset stats failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Delete leads created before a date
 */
async function sbClearLeadsBefore(dateISO) {
    console.log('[SW] sbClearLeadsBefore called:', dateISO);
    try {
        var url = SUPABASE_URL + '/rest/v1/leads?created_at=lt.' + encodeURIComponent(dateISO);
        var response = await fetch(url, {
            method: 'DELETE',
            headers: sbHeaders({ 'Prefer': 'return=minimal' })
        });
        console.log('[SW] DELETE status:', response.status);
        if (!response.ok) {
            var text = await response.text();
            throw new Error('HTTP ' + response.status + ': ' + text.substring(0, 200));
        }
        console.log('[SW] 🗑️ Old leads deleted');
        return { success: true, message: 'Old leads deleted' };
    } catch (err) {
        console.error('[SW] Clear before failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Get table counts - RLS-safe (fetch and count rows)
 */
async function sbGetTableCounts() {
    console.log('[SW] sbGetTableCounts called');
    try {
        // Fetch all IDs and count them (RLS-safe)
        var leadsResp = await fetch(SUPABASE_URL + '/rest/v1/leads?select=id', {
            headers: sbHeaders()
        });
        var historyResp = await fetch(SUPABASE_URL + '/rest/v1/lead_history?select=id', {
            headers: sbHeaders()
        });
        var filtersResp = await fetch(SUPABASE_URL + '/rest/v1/filters?select=id', {
            headers: sbHeaders()
        });

        if (!leadsResp.ok) {
            var errL = await leadsResp.text();
            throw new Error('leads HTTP ' + leadsResp.status + ': ' + errL.substring(0, 150));
        }
        if (!historyResp.ok) {
            var errH = await historyResp.text();
            throw new Error('history HTTP ' + historyResp.status + ': ' + errH.substring(0, 150));
        }

        var leads = await leadsResp.json();
        var history = await historyResp.json();
        var filters = filtersResp.ok ? await filtersResp.json() : [];

        var result = {
            success: true,
            leads: Array.isArray(leads) ? leads.length : 0,
            history: Array.isArray(history) ? history.length : 0,
            filters: Array.isArray(filters) ? filters.length : 0
        };

        console.log('[SW] ✅ Counts:', result);
        return result;
    } catch (err) {
        console.error('[SW] ❌ Count fetch failed:', err);
        return { success: false, error: err.message };
    }
}

// ============================================================
// MESSAGE HANDLING
// ============================================================
browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('[SW] Message:', request.action);

    // === LOGS ===
    if (request.action === 'GET_LOGS') {
        browserAPI.storage.local.get('logs', function(result) {
            sendResponse(result.logs || []);
        });
        return true;
    }

    if (request.action === 'CLEAR_LOGS') {
        browserAPI.storage.local.set({ logs: [] }, function() {
            sendResponse({ success: true });
        });
        return true;
    }

    // === STATUS ===
    if (request.action === 'UPDATE_STATUS') {
        cachedStatus = request.status;
        sendResponse({ received: true });
        return true;
    }

    if (request.action === 'GET_CACHED_STATUS') {
        sendResponse({ success: true, status: cachedStatus });
        return true;
    }

    if (request.action === 'CHECK_FILTERS') {
        checkActiveFilters().then(function() {
            browserAPI.storage.local.get(['hasActiveFilters', 'activeFilterCount'], function(result) {
                sendResponse({
                    success: true,
                    hasActiveFilters: result.hasActiveFilters || false,
                    filterCount: result.activeFilterCount || 0
                });
            });
        });
        return true;
    }

    // ============================================================
    // SUPABASE DIRECT OPERATIONS (no content script needed)
    // ============================================================
    if (request.action === 'SUPABASE_CLEAR_LEADS') {
        sbClearAllLeads().then(sendResponse);
        return true;
    }
    if (request.action === 'SUPABASE_CLEAR_HISTORY') {
        sbClearAllHistory().then(sendResponse);
        return true;
    }
    if (request.action === 'SUPABASE_CLEAR_FILTERS') {
        sbClearAllFilters().then(sendResponse);
        return true;
    }
    if (request.action === 'SUPABASE_RESET_STATS') {
        sbResetFilterStats().then(sendResponse);
        return true;
    }
    if (request.action === 'SUPABASE_CLEAR_BEFORE') {
        sbClearLeadsBefore(request.date).then(sendResponse);
        return true;
    }
    if (request.action === 'SUPABASE_GET_COUNTS') {
        sbGetTableCounts().then(sendResponse);
        return true;
    }

    // === TOGGLE_SUPABASE ===
    if (request.action === 'TOGGLE_SUPABASE') {
        browserAPI.storage.local.set({ supabaseEnabled: request.enabled }, function() {
            browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    browserAPI.tabs.sendMessage(tabs[0].id, request, function(response) {
                        if (browserAPI.runtime.lastError) {
                            sendResponse({ success: true, enabled: request.enabled, forwarded: false });
                        } else {
                            sendResponse(response || { success: true });
                        }
                    });
                } else {
                    sendResponse({ success: true, enabled: request.enabled, forwarded: false });
                }
            });
            if (request.enabled) setTimeout(checkActiveFilters, 500);
        });
        return true;
    }

    // === SET_MODE with user tracking ===
    if (request.action === 'SET_MODE') {
        browserAPI.storage.local.set({
            mode: request.mode,
            userSetMode: true
        }, function() {
            browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    browserAPI.tabs.sendMessage(tabs[0].id, request, function(response) {
                        if (browserAPI.runtime.lastError) {
                            sendResponse({ success: true, mode: request.mode, forwarded: false });
                        } else {
                            sendResponse(response || { success: true });
                        }
                    });
                } else {
                    sendResponse({ success: true, mode: request.mode, forwarded: false });
                }
            });
        });
        return true;
    }

    if (request.action === 'GET_MODE') {
        browserAPI.storage.local.get(['mode', 'userSetMode', 'supabaseEnabled'], function(result) {
            sendResponse({
                success: true,
                mode: result.mode || 'AUTOMATIC',
                userSetMode: result.userSetMode || false,
                supabaseEnabled: result.supabaseEnabled !== false
            });
        });
        return true;
    }

    // === CLEAR_DUPLICATE_CACHE - forward to content script ===
    if (request.action === 'CLEAR_DUPLICATE_CACHE') {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                browserAPI.tabs.sendMessage(tabs[0].id, request, function(r) {
                    if (browserAPI.runtime.lastError) {
                        // Fallback: clear local storage dup keys
                        browserAPI.storage.local.get(null, function(all) {
                            var toRemove = [];
                            for (var k in all) {
                                if (k.indexOf('clicked_') === 0) toRemove.push(k);
                            }
                            if (toRemove.length > 0) {
                                browserAPI.storage.local.remove(toRemove, function() {
                                    sendResponse({ success: true, message: 'Cleared local storage dup keys' });
                                });
                            } else {
                                sendResponse({ success: true, message: 'No dup keys found' });
                            }
                        });
                    } else {
                        sendResponse(r || { success: true });
                    }
                });
            } else {
                sendResponse({ success: false, error: 'No active tab' });
            }
        });
        return true;
    }

    // === FORWARD to content script ===
    var forwardActions = [
        'GET_STATUS', 'SET_LIMITS', 'SET_MIN_SCORE',
        'EMERGENCY_STOP', 'RESUME', 'UPDATE_KEYWORDS',
        'UPDATE_CONFIG', 'UPDATE_FULL_CONFIG', 'REFRESH_FILTERS',
        'RESET_PANEL_POSITION', 'SET_AUTO_MINIMIZE', 'SET_CONFIRMATION_ANSWER',
        'SET_PURCHASE_ACTION', 'SET_AUTO_SCROLL', 'CLEAR_ALL_LOCAL_DATA',
        'GET_CONFIG', 'GET_KEYWORDS_DEBUG', 'RESET_DUPLICATES'
    ];

    if (forwardActions.indexOf(request.action) !== -1) {
        browserAPI.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                browserAPI.tabs.sendMessage(tabs[0].id, request, function(response) {
                    if (browserAPI.runtime.lastError) {
                        if (request.action === 'GET_STATUS' && cachedStatus) {
                            sendResponse(Object.assign({ success: true }, cachedStatus));
                        } else {
                            sendResponse({ success: false, error: 'Content script not available' });
                        }
                    } else {
                        sendResponse(response);
                    }
                });
            } else {
                if (request.action === 'GET_STATUS' && cachedStatus) {
                    sendResponse(Object.assign({ success: true }, cachedStatus));
                } else {
                    sendResponse({ success: false, error: 'No active tab' });
                }
            }
        });
        return true;
    }

    sendResponse({ success: false, error: 'Unknown action' });
    return true;
});

// ============================================================
// KEEP ALIVE
// ============================================================
browserAPI.runtime.onConnect.addListener(function(port) {
    if (port.name === 'keepAlive') {
        port.onDisconnect.addListener(function() {});
        port.postMessage({ type: 'keepAlive' });
    }
});

setInterval(function() {
    try {
        browserAPI.runtime.getPlatformInfo(function() {});
    } catch (err) {}
}, 25000);

// ============================================================
// TAB UPDATE LISTENER
// ============================================================
browserAPI.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' &&
        tab.url &&
        tab.url.indexOf('seller.indiamart.com/bltxn') !== -1) {
        console.log('[SW] IndiaMART page loaded');
        checkActiveFilters();

        browserAPI.storage.local.get(['mode', 'userSetMode', 'supabaseEnabled'], function(result) {
            var mode = result.mode || 'AUTOMATIC';
            var supabaseEnabled = result.supabaseEnabled !== false;
            if (!result.userSetMode) {
                mode = 'AUTOMATIC';
                browserAPI.storage.local.set({ mode: 'AUTOMATIC' });
            }
            setTimeout(function() {
                browserAPI.tabs.sendMessage(tabId, { action: 'SET_MODE', mode: mode }).catch(function() {});
                browserAPI.tabs.sendMessage(tabId, { action: 'TOGGLE_SUPABASE', enabled: supabaseEnabled }).catch(function() {});
            }, 2500);
        });
    }
});

console.log('[SW] BuyLead Assistant v4.9.0 loaded');