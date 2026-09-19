// src/supabase-service.js
// Complete Supabase integration with data management
// Developed by CodeNagpur.in
// Version 4.8.0

const SUPABASE_URL = 'https://zvhuromubukylsxrsfiz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aHVyb211YnVreWxzeHJzZml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODI4MDYsImV4cCI6MjEwMzY1ODgwNn0.29J2uGHxFhPtEqRZvnXjaYpL-x4I0uEc2TT8u9d5PVw';

class SupabaseService {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_KEY;
        this.headers = {
            'apikey': this.key,
            'Authorization': 'Bearer ' + this.key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
        this.logger = null;
        this._filters = [];
        this._filtersLoaded = false;
        this._filtersLastFetch = 0;
        this._filtersTTL = 30000; // 30 seconds
        this._clientId = 'default';
        this._statsBuffer = { scanned: 0, matched: 0, clicked: 0 };
        this._statsFlushTimer = null;
    }

    setLogger(logger) {
        this.logger = logger;
    }

    _log(level, msg, data) {
        if (this.logger && this.logger[level]) {
            this.logger[level](msg, data);
        }
    }

    // ============================================================
    // FILTERS - Fetch and cache
    // ============================================================
    async loadFilters(forceRefresh) {
        const now = Date.now();
        if (!forceRefresh && this._filtersLoaded && (now - this._filtersLastFetch) < this._filtersTTL) {
            return this._filters;
        }

        try {
            const url = this.url + '/rest/v1/filters?is_active=eq.true&select=*&order=id.asc';
            const response = await fetch(url, { headers: this.headers });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();
            this._filters = Array.isArray(data) ? data : [];
            this._filtersLoaded = true;
            this._filtersLastFetch = now;

            this._log('info', '📥 Filters loaded from Supabase', { count: this._filters.length });

            if (this._filters.length > 0 && this._filters[0].client_id) {
                this._clientId = this._filters[0].client_id;
            }

            return this._filters;
        } catch (err) {
            this._log('error', '❌ Failed to load filters', { error: err.message });
            return this._filters;
        }
    }

    getFilters() {
        return this._filters;
    }

    // ============================================================
    // FILTER STATUS
    // ============================================================
    async updateFilterStatus(isRunning) {
        try {
            const url = this.url + '/rest/v1/filters?is_active=eq.true';
            const body = {
                is_running: isRunning,
                last_poll_time: new Date().toISOString()
            };

            const response = await fetch(url, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            this._log('debug', '📡 Filter status updated', { isRunning });
            return true;
        } catch (err) {
            this._log('warn', 'Failed to update filter status', { error: err.message });
            return false;
        }
    }

    // ============================================================
    // LEADS - Check if exists
    // ============================================================
    async leadExists(uniqueQueryId) {
        try {
            const url = this.url + '/rest/v1/leads?unique_query_id=eq.' + encodeURIComponent(uniqueQueryId) + '&select=id,status,is_contacted';
            const response = await fetch(url, { headers: this.headers });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();
            return data.length > 0 ? data[0] : null;
        } catch (err) {
            this._log('warn', 'Failed to check lead existence', { error: err.message, uniqueQueryId: uniqueQueryId });
            return null;
        }
    }

    // ============================================================
    // LEADS - Insert
    // ============================================================
    async insertLead(lead) {
        try {
            const url = this.url + '/rest/v1/leads';
            const body = {
                unique_query_id: lead.uniqueQueryId,
                query_type: lead.queryType || 'BUY_LEAD',
                query_time: lead.queryTime || new Date().toISOString(),
                sender_name: lead.senderName || null,
                sender_mobile: lead.senderMobile || null,
                sender_mobile_alt: lead.senderMobileAlt || null,
                sender_phone: lead.senderPhone || null,
                sender_phone_alt: lead.senderPhoneAlt || null,
                sender_email: lead.senderEmail || null,
                sender_email_alt: lead.senderEmailAlt || null,
                sender_company: lead.senderCompany || null,
                sender_address: lead.senderAddress || null,
                sender_city: lead.senderCity || null,
                sender_state: lead.senderState || null,
                sender_pincode: lead.senderPincode || null,
                sender_country_iso: lead.senderCountryIso || null,
                subject: lead.subject || null,
                query_product_name: lead.queryProductName || null,
                query_message: lead.queryMessage || null,
                query_mcat_name: lead.queryMcatName || null,
                call_duration: lead.callDuration || null,
                receiver_mobile: lead.receiverMobile || null,
                is_matched: lead.isMatched || false,
                is_contacted: false,
                status: 'new'
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error('HTTP ' + response.status + ': ' + errorText);
            }

            const data = await response.json();
            this._log('info', '💾 Lead inserted', { uniqueQueryId: lead.uniqueQueryId, id: data[0]?.id });
            return data[0] || null;
        } catch (err) {
            this._log('error', '❌ Failed to insert lead', { error: err.message, uniqueQueryId: lead.uniqueQueryId });
            return null;
        }
    }

    // ============================================================
    // LEADS - Update
    // ============================================================
    async updateLead(uniqueQueryId, updates) {
        try {
            const url = this.url + '/rest/v1/leads?unique_query_id=eq.' + encodeURIComponent(uniqueQueryId);
            const body = Object.assign({}, updates, { updated_at: new Date().toISOString() });

            const response = await fetch(url, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            this._log('debug', '✏️ Lead updated', { uniqueQueryId: uniqueQueryId, updates: updates });
            return true;
        } catch (err) {
            this._log('error', '❌ Failed to update lead', { error: err.message, uniqueQueryId: uniqueQueryId });
            return false;
        }
    }

    async markLeadMatched(uniqueQueryId) {
        return this.updateLead(uniqueQueryId, { is_matched: true, status: 'matched' });
    }

    async markLeadContacted(uniqueQueryId) {
        return this.updateLead(uniqueQueryId, {
            is_contacted: true,
            status: 'contacted',
            updated_at: new Date().toISOString()
        });
    }

    // ============================================================
    // LEAD HISTORY
    // ============================================================
    async insertLeadHistory(leadId, action, details, contactedAt) {
        try {
            const url = this.url + '/rest/v1/lead_history';
            const body = {
                lead_id: leadId,
                action: action,
                action_details: typeof details === 'string' ? details : JSON.stringify(details || {}),
                contacted_at: contactedAt || null
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            this._log('debug', '📝 History added', { leadId: leadId, action: action });
            return true;
        } catch (err) {
            this._log('warn', 'Failed to add history', { error: err.message });
            return false;
        }
    }

    // ============================================================
    // STATS - Buffered updates
    // ============================================================
    async updateFilterStats(scanned, matched, clicked) {
        this._statsBuffer.scanned = scanned;
        this._statsBuffer.matched = matched;
        this._statsBuffer.clicked = clicked;

        if (this._statsFlushTimer) return;

        const self = this;
        this._statsFlushTimer = setTimeout(function() {
            self._statsFlushTimer = null;
            self._flushStats();
        }, 10000);
    }

    async _flushStats() {
        try {
            const url = this.url + '/rest/v1/filters?is_active=eq.true';
            const body = {
                stats_scanned: this._statsBuffer.scanned,
                stats_matched: this._statsBuffer.matched,
                stats_clicked: this._statsBuffer.clicked,
                updated_at: new Date().toISOString()
            };

            const response = await fetch(url, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify(body)
            });

            if (response.ok) {
                this._log('debug', '📊 Stats flushed to DB', this._statsBuffer);
            }
        } catch (err) {
            this._log('warn', 'Stats flush failed', { error: err.message });
        }
    }

    // ============================================================
    // BATCH - Fetch recent leads (for dedup cache)
    // ============================================================
    async getRecentLeads(limit) {
        limit = limit || 100;
        try {
            const url = this.url + '/rest/v1/leads?select=unique_query_id,status,is_contacted&order=created_at.desc&limit=' + limit;
            const response = await fetch(url, { headers: this.headers });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();
            return data || [];
        } catch (err) {
            this._log('warn', 'Failed to fetch recent leads', { error: err.message });
            return [];
        }
    }

    // ============================================================
    // DATA MANAGEMENT - CLEAR OPERATIONS
    // ============================================================

    /**
     * Delete ALL leads from the leads table.
     * ⚠️ Cascade will also delete lead_history rows referencing them.
     */
    async clearAllLeads() {
        try {
            // Use a filter that matches every row
            const url = this.url + '/rest/v1/leads?id=gte.0';
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'apikey': this.key,
                    'Authorization': 'Bearer ' + this.key,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error('HTTP ' + response.status + ': ' + errorText);
            }

            this._log('warn', '🗑️ All leads deleted');
            return { success: true, message: 'All leads deleted' };
        } catch (err) {
            this._log('error', '❌ Failed to clear leads', { error: err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Delete ALL lead history rows.
     * Leads themselves are NOT deleted.
     */
    async clearAllHistory() {
        try {
            const url = this.url + '/rest/v1/lead_history?id=gte.0';
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'apikey': this.key,
                    'Authorization': 'Bearer ' + this.key,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error('HTTP ' + response.status + ': ' + errorText);
            }

            this._log('warn', '🗑️ All history deleted');
            return { success: true, message: 'All history deleted' };
        } catch (err) {
            this._log('error', '❌ Failed to clear history', { error: err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Reset filter stats counters to zero.
     */
    async resetFilterStats() {
        try {
            const url = this.url + '/rest/v1/filters?is_active=eq.true';
            const body = {
                stats_scanned: 0,
                stats_matched: 0,
                stats_clicked: 0,
                is_running: false,
                updated_at: new Date().toISOString()
            };

            const response = await fetch(url, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            this._log('warn', '🔄 Filter stats reset');
            return { success: true, message: 'Stats reset' };
        } catch (err) {
            this._log('error', 'Failed to reset stats', { error: err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Delete leads created BEFORE the given ISO date.
     */
    async clearLeadsBefore(dateISO) {
        try {
            const url = this.url + '/rest/v1/leads?created_at=lt.' + encodeURIComponent(dateISO);
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'apikey': this.key,
                    'Authorization': 'Bearer ' + this.key,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error('HTTP ' + response.status + ': ' + errorText);
            }

            this._log('warn', '🗑️ Old leads deleted before ' + dateISO);
            return { success: true, message: 'Old leads deleted' };
        } catch (err) {
            this._log('error', 'Failed to delete old leads', { error: err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Get table counts (leads, history, filters).
     */
    async getTableCounts() {
        try {
            const countHeaders = {
                'apikey': this.key,
                'Authorization': 'Bearer ' + this.key,
                'Range': '0-0',
                'Prefer': 'count=exact'
            };

            const [leadsResp, historyResp, filtersResp] = await Promise.all([
                fetch(this.url + '/rest/v1/leads?select=id', { headers: countHeaders }),
                fetch(this.url + '/rest/v1/lead_history?select=id', { headers: countHeaders }),
                fetch(this.url + '/rest/v1/filters?select=id', { headers: countHeaders })
            ]);

            return {
                success: true,
                leads: this._extractCount(leadsResp),
                history: this._extractCount(historyResp),
                filters: this._extractCount(filtersResp)
            };
        } catch (err) {
            this._log('warn', 'Failed to get table counts', { error: err.message });
            return { success: false, error: err.message };
        }
    }

    _extractCount(response) {
        try {
            const range = response.headers.get('content-range');
            if (range) {
                const parts = range.split('/');
                if (parts[1] && parts[1] !== '*') {
                    return parseInt(parts[1], 10);
                }
            }
            return '?';
        } catch (e) {
            return '?';
        }
    }

    // ============================================================
    // HEALTH CHECK
    // ============================================================
    async healthCheck() {
        try {
            const response = await fetch(this.url + '/rest/v1/filters?select=id&limit=1', {
                headers: this.headers
            });
            return response.ok;
        } catch (err) {
            return false;
        }
    }

    /**
     * Refresh filters cache manually
     */
    async refresh() {
        this._filtersLastFetch = 0;
        this._filtersLoaded = false;
        return await this.loadFilters(true);
    }
}

window.SupabaseService = SupabaseService;