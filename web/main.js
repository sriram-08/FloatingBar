// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let reminders = [];
let toastQueue = [];
let toastTimer = null;
let toastDismissTimer = null;
let notifiedIds = new Set();
const ALERT_BEFORE_MS = 5 * 60 * 1000; 
const TOAST_DURATION_MS = 5 * 60 * 1000; 

const categoryEmojis = {
    "Personal": "👤",
    "BuildHubCode": "🌐",
    "ABC Corp": "🏢",
    "XYZ Industrial": "🏭"
};

// ─────────────────────────────────────────────
//  INIT & LOCAL KEYBOARD INTERCEPTOR
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    buildFormFields('desktop-form-fields');
    loadReminders();
    startClock();
    startReminderWatcher();
    updateCounts();

    // Inside window keyboard fallback handler
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.lowerCase === 'h') {
            e.preventDefault();
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.toggle_visibility();
            }
        }
    });
});

// ─────────────────────────────────────────────
//  FORM BUILDER
// ─────────────────────────────────────────────
function buildFormFields(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div>
            <label class="block text-[11px] text-zinc-400 mb-1">Event Title *</label>
            <input id="${containerId}-title" type="text" placeholder="What needs to happen?"
                   class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors">
        </div>
        <div>
            <label class="block text-[11px] text-zinc-400 mb-1">Date & Time *</label>
            <input id="${containerId}-datetime" type="datetime-local"
                   class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors">
        </div>
        <div>
            <label class="block text-[11px] text-zinc-400 mb-1">Description</label>
            <textarea id="${containerId}-desc" rows="3" placeholder="Optional details..."
                      class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"></textarea>
        </div>
        <div>
            <label class="block text-[11px] text-zinc-400 mb-1">Category</label>
            <select id="${containerId}-category"
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors">
                <option value="Personal">Personal</option>
                <option value="BuildHubCode">BuildHubCode</option>
                <option value="ABC Corp">ABC Corp</option>
                <option value="XYZ Industrial">XYZ Industrial</option>
            </select>
        </div>
        <button onclick="commitReminder('${containerId}')"
                class="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs py-2.5 rounded-lg shadow-md transition-colors mt-1">
            Save Reminder
        </button>
    `;
}

// ─────────────────────────────────────────────
//  EXPAND / COLLAPSE (Fade In / Fade Out Transitions)
// ─────────────────────────────────────────────
function expandDashboard() {
    const collapsedBar = document.getElementById('collapsed-bar');
    const expandedDash = document.getElementById('expanded-dashboard');

    collapsedBar.classList.add('hidden-state');
    expandedDash.classList.remove('hidden-state');

    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.resize_window(960, 540);
    }
}

function collapseDashboard() {
    const collapsedBar = document.getElementById('collapsed-bar');
    const expandedDash = document.getElementById('expanded-dashboard');
    document.getElementById('settings-menu').classList.add('hidden');

    expandedDash.classList.add('hidden-state');
    collapsedBar.classList.remove('hidden-state');

    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.resize_window(580, 72);
    }
}

// ─────────────────────────────────────────────
//  SETTINGS / DOCK
// ─────────────────────────────────────────────
function toggleSettingsDropdown() {
    document.getElementById('settings-menu').classList.toggle('hidden');
}

function moveDock(edge) {
    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.change_position(edge);
    }
    document.getElementById('settings-menu').classList.add('hidden');
}

// ─────────────────────────────────────────────
//  MOBILE ADD PANEL
// ─────────────────────────────────────────────
function toggleMobileAdd() {
    const panel = document.getElementById('mobile-add-panel');
    if (panel.classList.contains('hidden')) {
        buildFormFields('mobile-form-container');
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

// ─────────────────────────────────────────────
//  COMMIT REMINDER
// ─────────────────────────────────────────────
function commitReminder(prefix) {
    const titleEl    = document.getElementById(`${prefix}-title`);
    const datetimeEl = document.getElementById(`${prefix}-datetime`);
    const descEl     = document.getElementById(`${prefix}-desc`);
    const catEl      = document.getElementById(`${prefix}-category`);

    if (!titleEl || !datetimeEl) return;

    const title    = titleEl.value.trim();
    const datetime = datetimeEl.value;
    const desc     = descEl ? descEl.value.trim() : '';
    const category = catEl ? catEl.value : 'Personal';

    if (!title || !datetime) {
        showInlineError(prefix, "Fields are required.");
        return;
    }

    const id = Date.now().toString();
    const reminder = { id, title, timestamp: datetime, description: desc, category, done: false };

    reminders.push(reminder);
    saveReminders();
    appendReminderToUI(reminder);
    updateCounts();

    titleEl.value = '';
    datetimeEl.value = '';
    if (descEl) descEl.value = '';

    document.getElementById('mobile-add-panel').classList.add('hidden');

    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.save_reminder_to_cloud(JSON.stringify(reminder));
    }
}

function showInlineError(prefix, msg) {
    const btn = document.querySelector(`#${prefix} button`);
    const err = document.createElement('p');
    err.className = 'text-[11px] text-red-400 mt-1';
    err.textContent = msg;
    if (btn && btn.parentNode) {
        btn.parentNode.insertBefore(err, btn);
        setTimeout(() => err.remove(), 3000);
    }
}

// ─────────────────────────────────────────────
//  RENDER REMINDER CARD
// ─────────────────────────────────────────────
function appendReminderToUI(item) {
    const container = document.getElementById('reminders-list');
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.classList.add('hidden');

    const formatted = item.timestamp.replace('T', ' ');
    const card = document.createElement('div');
    card.className = "bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl flex items-start space-x-3 shadow-sm reminder-card transition-all duration-200";
    card.dataset.id   = item.id || '';
    card.dataset.category = item.category || 'Personal';
    card.dataset.done = item.done ? 'true' : 'false';

    card.innerHTML = `
        <input type="checkbox" ${item.done ? 'checked' : ''} class="mt-1 accent-emerald-500 flex-shrink-0" onchange="toggleDone(this)">
        <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
                <h4 class="text-xs font-medium text-zinc-200 truncate card-title ${item.done ? 'line-through opacity-40' : ''}">${escHtml(item.title)}</h4>
                <span class="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 flex-shrink-0">${escHtml(item.category)}</span>
            </div>
            ${item.description ? `<p class="text-[11px] text-zinc-400 mt-0.5">${escHtml(item.description)}</p>` : ''}
            <div class="flex items-center space-x-3 mt-2 text-[10px] text-zinc-500 font-mono">
                <span>⏱️ ${formatted}</span>
            </div>
        </div>
        <button onclick="deleteReminder(this)" class="text-zinc-700 hover:text-red-400 text-xs flex-shrink-0 transition-colors mt-0.5">✕</button>
    `;

    if (item.done) card.classList.add('opacity-40');
    container.prepend(card);
}

function toggleDone(checkbox) {
    const card = checkbox.closest('.reminder-card');
    const id = card.dataset.id;
    const title = card.querySelector('.card-title');
    const target = reminders.find(r => r.id === id);

    if (checkbox.checked) {
        card.classList.add('opacity-40');
        if (title) title.classList.add('line-through');
        card.dataset.done = 'true';
        if (target) target.done = true;
    } else {
        card.classList.remove('opacity-40');
        if (title) title.classList.remove('line-through');
        card.dataset.done = 'false';
        if (target) target.done = false;
    }
    saveReminders();
    updateCounts();
}

function deleteReminder(btn) {
    const card = btn.closest('.reminder-card');
    const id   = card.dataset.id;
    card.style.opacity = '0';
    setTimeout(() => {
        card.remove();
        reminders = reminders.filter(r => r.id !== id);
        saveReminders();
        updateCounts();
        checkEmptyState();
    }, 200);
}

function checkEmptyState() {
    const list = document.getElementById('reminders-list');
    const empty = document.getElementById('empty-state');
    if (list && empty) {
        const hasCards = list.querySelectorAll('.reminder-card').length > 0;
        empty.classList.toggle('hidden', hasCards);
    }
}

// ─────────────────────────────────────────────
//  DYNAMIC MULTI-CATEGORY UPDATE COMPOSER
// ─────────────────────────────────────────────
function updateCounts() {
    const cards = document.querySelectorAll('.reminder-card');
    const done = document.querySelectorAll('.reminder-card input[type="checkbox"]:checked');
    const activeCount = cards.length - done.length;

    const activeEl = document.getElementById('active-count');
    if (activeEl) activeEl.textContent = `${activeCount} Active`;

    const badge = document.getElementById('reminder-count-badge');
    if (badge) {
        if (activeCount > 0) {
            badge.textContent = `${activeCount}`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // Capture Unique Active Streams
    const activeCategories = new Set();
    reminders.forEach(r => {
        if (!r.done) activeCategories.add(r.category);
    });

    // Fallback default pill if everything is clean
    if (activeCategories.size === 0) activeCategories.add("Personal");

    const pillWrapper = document.getElementById('categories-pill-wrapper');
    if (pillWrapper) {
        pillWrapper.innerHTML = '';
        activeCategories.forEach(cat => {
            const emoji = categoryEmojis[cat] || "📌";
            const pill = document.createElement('div');
            pill.className = "flex items-center space-x-1.5 bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-1 rounded-full animate-fade-in";
            pill.innerHTML = `
                <span class="text-zinc-300 text-[10px] tracking-wide font-semibold whitespace-nowrap">${emoji} ${cat}</span>
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-ring"></span>
            `;
            pillWrapper.appendChild(pill);
        });
    }
}

// ─────────────────────────────────────────────
//  PERSISTENCE
// ─────────────────────────────────────────────
function saveReminders() {
    try { localStorage.setItem('bh_reminders', JSON.stringify(reminders)); } catch(e) {}
}

function loadReminders() {
    try {
        const raw = localStorage.getItem('bh_reminders');
        if (raw) {
            reminders = JSON.parse(raw);
            document.getElementById('reminders-list').innerHTML = '';
            reminders.forEach(r => appendReminderToUI(r));
            updateCounts();
            checkEmptyState();
        }
    } catch(e) {}
}

// ─────────────────────────────────────────────
//  CLOCK
// ─────────────────────────────────────────────
function startClock() {
    const el = document.getElementById('header-clock');
    function tick() {
        if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 30000);
}

// ─────────────────────────────────────────────
//  WATCHER
// ─────────────────────────────────────────────
function startReminderWatcher() {
    setInterval(checkUpcomingReminders, 15000);
}

function checkUpcomingReminders() {
    const now = Date.now();
    reminders.forEach(r => {
        if (r.done || notifiedIds.has(r.id)) return;
        const due = new Date(r.timestamp).getTime();
        const diff = due - now;

        if (diff >= 0 && diff <= ALERT_BEFORE_MS) {
            notifiedIds.add(r.id);
            queueToast(r);
            showBarAlert(r);
        }
    });
}

function queueToast(reminder) {
    toastQueue.push(reminder);
    if (toastQueue.length === 1) showNextToast();
}

function showNextToast() {
    if (toastQueue.length === 0) return;
    displayToast(toastQueue[0]);
}

function displayToast(reminder) {
    const toast    = document.getElementById('reminder-toast');
    const titleEl  = document.getElementById('toast-title');
    const descEl   = document.getElementById('toast-desc');
    const timeEl   = document.getElementById('toast-time');
    const progress = document.getElementById('toast-progress');

    titleEl.textContent = reminder.title;
    descEl.textContent  = reminder.description || '';
    timeEl.textContent  = `Due: ${reminder.timestamp.replace('T', ' ')}`;

    progress.style.animation = 'none';
    progress.offsetHeight; 
    progress.style.animation = `shrink ${TOAST_DURATION_MS / 1000}s linear forwards`;

    toast.classList.remove('hidden', 'toast-hide');

    clearTimeout(toastDismissTimer);
    toastDismissTimer = setTimeout(dismissToast, TOAST_DURATION_MS);
}

function dismissToast() {
    const toast = document.getElementById('reminder-toast');
    toast.classList.add('toast-hide');
    setTimeout(() => {
        toast.classList.add('hidden');
        toastQueue.shift();
        if (toastQueue.length > 0) showNextToast();
    }, 300);
}

function showBarAlert(reminder) {
    const alertEl   = document.getElementById('bar-alert');
    const alertText = document.getElementById('bar-alert-text');
    if (alertEl && alertText) {
        alertText.textContent = `⏰ ${reminder.title}`;
        alertEl.style.display = 'flex';
        alertEl.classList.remove('hidden');
        setTimeout(() => { alertEl.style.display = 'none'; }, TOAST_DURATION_MS);
    }
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}