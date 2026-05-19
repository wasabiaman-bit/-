const EXT_KEY = 'floating_pet';

const DEFAULTS = {
    enabled: true,
    imageDataUrl: '',
    size: 96,
    speed: 1.2,
    showSpeech: true,
    speechDurationMs: 4500,
    speechMode: 'always', // always | keywords | chance
    speechKeywords: 'hello,hi,hey,come,look',
    speechChancePercent: 55,
    speechCooldownMs: 2500,
    speechUseExcerpt: true,
    speechPhrases: '안녕!,여기 있어!,나 불렀어?,같이 놀자!'
};

const state = {
    settings: {
        global: { ...DEFAULTS },
        scopeOverrides: {},
    },
    activeScopeKey: 'home',
    active: { ...DEFAULTS },
    container: null,
    petEl: null,
    imgEl: null,
    bubbleEl: null,
    bubbleTimer: 0,
    rafId: 0,
    scopeWatcherId: 0,
    x: 120,
    y: 120,
    vx: 1,
    vy: 1,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    ui: {},
    lastSpeechAt: 0,
};

function getCtx() {
    return SillyTavern.getContext();
}

function loadSettings() {
    const { extensionSettings } = getCtx();
    const saved = extensionSettings?.[EXT_KEY] ?? {};
    const global = { ...DEFAULTS, ...(saved.global ?? saved) };
    const scopeOverrides = saved.scopeOverrides ?? {};
    state.settings = { global, scopeOverrides };
}

function persistSettings() {
    const ctx = getCtx();
    ctx.extensionSettings[EXT_KEY] = state.settings;
    ctx.saveSettingsDebounced();
}

function normalizeScopeKey(raw) {
    return String(raw || 'home').replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 120);
}

function getCurrentScopeKey() {
    const ctx = getCtx();
    if (ctx.groupId) return normalizeScopeKey(`group:${ctx.groupId}`);
    if (ctx.characterId !== undefined && ctx.characterId !== null && Number(ctx.characterId) >= 0) {
        return normalizeScopeKey(`char:${ctx.characterId}`);
    }
    if (ctx.chatId) return normalizeScopeKey(`chat:${ctx.chatId}`);
    return 'home';
}

function computeActiveSettings() {
    const override = state.settings.scopeOverrides[state.activeScopeKey] ?? {};
    state.active = { ...state.settings.global, ...override };
}

function ensureDom() {
    if (state.container) return;

    const container = document.createElement('div');
    container.id = 'floating-pet-layer';

    const pet = document.createElement('div');
    pet.className = 'floating-pet';

    const img = document.createElement('img');
    img.alt = 'Floating pet';

    const bubble = document.createElement('div');
    bubble.className = 'floating-pet-bubble hidden';

    pet.appendChild(img);
    pet.appendChild(bubble);
    container.appendChild(pet);
    document.body.appendChild(container);

    state.container = container;
    state.petEl = pet;
    state.imgEl = img;
    state.bubbleEl = bubble;

    pet.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

function applyVisualSettings() {
    if (!state.petEl || !state.imgEl) return;

    const { enabled, imageDataUrl, size } = state.active;
    state.container.style.display = enabled ? 'block' : 'none';
    state.petEl.style.width = `${size}px`;
    state.petEl.style.height = `${size}px`;
    state.imgEl.src = imageDataUrl || transparentPixel();
}

function transparentPixel() {
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
}

function tick() {
    if (!state.active.enabled || state.dragging) {
        state.rafId = requestAnimationFrame(tick);
        return;
    }

    const petSize = state.active.size;
    const w = window.innerWidth;
    const h = window.innerHeight;

    state.x += state.vx * state.active.speed;
    state.y += state.vy * state.active.speed;

    if (state.x <= 0 || state.x + petSize >= w) {
        state.vx *= -1;
        state.x = Math.max(0, Math.min(state.x, w - petSize));
    }
    if (state.y <= 0 || state.y + petSize >= h) {
        state.vy *= -1;
        state.y = Math.max(0, Math.min(state.y, h - petSize));
    }

    updatePetPosition();
    state.rafId = requestAnimationFrame(tick);
}

function updatePetPosition() {
    state.petEl.style.transform = `translate(${state.x}px, ${state.y}px)`;
}

function randomizeVelocity() {
    const angle = Math.random() * Math.PI * 2;
    state.vx = Math.cos(angle);
    state.vy = Math.sin(angle);
}

function onPointerDown(event) {
    if (!state.active.enabled) return;
    state.dragging = true;
    const rect = state.petEl.getBoundingClientRect();
    state.dragOffsetX = event.clientX - rect.left;
    state.dragOffsetY = event.clientY - rect.top;
    state.petEl.classList.add('dragging');
    event.preventDefault();
}

function onPointerMove(event) {
    if (!state.dragging) return;

    const maxX = window.innerWidth - state.active.size;
    const maxY = window.innerHeight - state.active.size;
    state.x = Math.max(0, Math.min(event.clientX - state.dragOffsetX, maxX));
    state.y = Math.max(0, Math.min(event.clientY - state.dragOffsetY, maxY));
    updatePetPosition();
}

function onPointerUp() {
    if (!state.dragging) return;
    state.dragging = false;
    state.petEl.classList.remove('dragging');
    randomizeVelocity();
}

function parseCsvList(text) {
    return String(text || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function shouldSpeakFromText(text) {
    if (!state.active.showSpeech) return false;

    const now = Date.now();
    if (now - state.lastSpeechAt < Number(state.active.speechCooldownMs || 0)) return false;

    const mode = String(state.active.speechMode || 'always');
    const lower = String(text || '').toLowerCase();

    if (mode === 'always') return true;

    if (mode === 'keywords') {
        const keywords = parseCsvList(state.active.speechKeywords).map(v => v.toLowerCase());
        return keywords.some(k => lower.includes(k));
    }

    if (mode === 'chance') {
        const p = Math.max(0, Math.min(100, Number(state.active.speechChancePercent) || 0));
        return Math.random() * 100 < p;
    }

    return false;
}

function chooseSpeechText(sourceText) {
    if (state.active.speechUseExcerpt && sourceText) {
        return String(sourceText).trim().slice(0, 120);
    }

    const phrases = parseCsvList(state.active.speechPhrases);
    if (phrases.length) {
        const idx = Math.floor(Math.random() * phrases.length);
        return phrases[idx].slice(0, 120);
    }

    return '...';
}

function showSpeech(rawText) {
    if (!state.bubbleEl) return;
    if (!shouldSpeakFromText(rawText)) return;

    const text = chooseSpeechText(rawText);
    if (!text) return;

    state.bubbleEl.textContent = text;
    state.bubbleEl.classList.remove('hidden');
    state.lastSpeechAt = Date.now();

    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(() => {
        state.bubbleEl.classList.add('hidden');
    }, Number(state.active.speechDurationMs));
}

function bindChatEvents() {
    const { eventSource, event_types, chat } = getCtx();

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (_type, data) => {
        const text = data?.mes || data?.message || chat?.[chat.length - 1]?.mes || '';
        showSpeech(text);
    });
}

function saveScopeOverrideFromActive() {
    state.settings.scopeOverrides[state.activeScopeKey] = {
        enabled: state.active.enabled,
        imageDataUrl: state.active.imageDataUrl,
        size: state.active.size,
        speed: state.active.speed,
        showSpeech: state.active.showSpeech,
        speechDurationMs: state.active.speechDurationMs,
        speechMode: state.active.speechMode,
        speechKeywords: state.active.speechKeywords,
        speechChancePercent: state.active.speechChancePercent,
        speechCooldownMs: state.active.speechCooldownMs,
        speechUseExcerpt: state.active.speechUseExcerpt,
        speechPhrases: state.active.speechPhrases,
    };
    persistSettings();
}

function clearScopeOverride() {
    delete state.settings.scopeOverrides[state.activeScopeKey];
    persistSettings();
    computeActiveSettings();
    applyVisualSettings();
    syncUiFromActive();
}

function updateScopeAndMaybeRefreshUi() {
    const nextScope = getCurrentScopeKey();
    if (nextScope === state.activeScopeKey) return;

    state.activeScopeKey = nextScope;
    computeActiveSettings();
    applyVisualSettings();
    syncUiFromActive();
    setScopeLabel();
}

function buildSettingsUi() {
    const root = document.createElement('div');
    root.className = 'floating-pet-settings inline-drawer';
    root.innerHTML = `
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Floating Pet</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="floating-pet-scope-row">
                <div>Current scope: <code id="fp_scope_label"></code></div>
                <button id="fp_scope_save" type="button">Save to this scope</button>
                <button id="fp_scope_reset" type="button">Reset this scope</button>
            </div>

            <label class="checkbox_label" style="display:block;margin-top:8px;">
                <input id="fp_enabled" type="checkbox" /> Enable floating pet
            </label>

            <label for="fp_image">Pet image</label>
            <input id="fp_image" type="file" accept="image/*" />

            <label for="fp_size">Size</label>
            <input id="fp_size" type="range" min="48" max="220" step="1" />
            <span id="fp_size_value"></span>

            <label for="fp_speed">Speed</label>
            <input id="fp_speed" type="range" min="0.2" max="4" step="0.1" />
            <span id="fp_speed_value"></span>

            <label class="checkbox_label" style="display:block;margin-top:8px;">
                <input id="fp_speech" type="checkbox" /> Show speech bubble
            </label>

            <label for="fp_speech_mode">Speech trigger mode</label>
            <select id="fp_speech_mode">
                <option value="always">Always</option>
                <option value="keywords">Keywords</option>
                <option value="chance">Chance</option>
            </select>

            <label for="fp_speech_keywords">Keywords (comma separated)</label>
            <input id="fp_speech_keywords" type="text" />

            <label for="fp_speech_chance">Chance (%)</label>
            <input id="fp_speech_chance" type="number" min="0" max="100" step="1" />

            <label for="fp_speech_cooldown">Cooldown (ms)</label>
            <input id="fp_speech_cooldown" type="number" min="0" max="30000" step="100" />

            <label class="checkbox_label" style="display:block;margin-top:8px;">
                <input id="fp_speech_excerpt" type="checkbox" /> Use message excerpt as bubble text
            </label>

            <label for="fp_speech_phrases">Fallback phrases (comma separated)</label>
            <input id="fp_speech_phrases" type="text" />

            <label for="fp_speech_ms">Speech duration (ms)</label>
            <input id="fp_speech_ms" type="number" min="500" max="20000" step="100" />
        </div>
    `;

    const parent = document.querySelector('#extensions_settings2');
    if (parent) parent.appendChild(root);

    state.ui = {
        root,
        scopeLabel: root.querySelector('#fp_scope_label'),
        scopeSave: root.querySelector('#fp_scope_save'),
        scopeReset: root.querySelector('#fp_scope_reset'),
        enabled: root.querySelector('#fp_enabled'),
        image: root.querySelector('#fp_image'),
        size: root.querySelector('#fp_size'),
        sizeVal: root.querySelector('#fp_size_value'),
        speed: root.querySelector('#fp_speed'),
        speedVal: root.querySelector('#fp_speed_value'),
        speech: root.querySelector('#fp_speech'),
        speechMode: root.querySelector('#fp_speech_mode'),
        speechKeywords: root.querySelector('#fp_speech_keywords'),
        speechChance: root.querySelector('#fp_speech_chance'),
        speechCooldown: root.querySelector('#fp_speech_cooldown'),
        speechExcerpt: root.querySelector('#fp_speech_excerpt'),
        speechPhrases: root.querySelector('#fp_speech_phrases'),
        speechMs: root.querySelector('#fp_speech_ms'),
    };

    wireUiHandlers();
    setScopeLabel();
    syncUiFromActive();
}

function setScopeLabel() {
    if (!state.ui.scopeLabel) return;
    state.ui.scopeLabel.textContent = state.activeScopeKey;
}

function syncUiFromActive() {
    const ui = state.ui;
    if (!ui.root) return;

    ui.enabled.checked = state.active.enabled;
    ui.size.value = String(state.active.size);
    ui.sizeVal.textContent = `${state.active.size}px`;
    ui.speed.value = String(state.active.speed);
    ui.speedVal.textContent = `${Number(state.active.speed).toFixed(1)}`;
    ui.speech.checked = state.active.showSpeech;
    ui.speechMode.value = state.active.speechMode;
    ui.speechKeywords.value = state.active.speechKeywords;
    ui.speechChance.value = String(state.active.speechChancePercent);
    ui.speechCooldown.value = String(state.active.speechCooldownMs);
    ui.speechExcerpt.checked = Boolean(state.active.speechUseExcerpt);
    ui.speechPhrases.value = state.active.speechPhrases;
    ui.speechMs.value = String(state.active.speechDurationMs);
}

function wireUiHandlers() {
    const ui = state.ui;

    ui.scopeSave.addEventListener('click', () => {
        saveScopeOverrideFromActive();
    });

    ui.scopeReset.addEventListener('click', () => {
        clearScopeOverride();
    });

    ui.enabled.addEventListener('change', () => {
        state.active.enabled = ui.enabled.checked;
        applyVisualSettings();
    });

    ui.image.addEventListener('change', async () => {
        const file = ui.image.files?.[0];
        if (!file) return;
        state.active.imageDataUrl = await fileToDataUrl(file);
        applyVisualSettings();
    });

    ui.size.addEventListener('input', () => {
        state.active.size = Number(ui.size.value);
        ui.sizeVal.textContent = `${state.active.size}px`;
        applyVisualSettings();
    });

    ui.speed.addEventListener('input', () => {
        state.active.speed = Number(ui.speed.value);
        ui.speedVal.textContent = `${state.active.speed.toFixed(1)}`;
    });

    ui.speech.addEventListener('change', () => {
        state.active.showSpeech = ui.speech.checked;
    });

    ui.speechMode.addEventListener('change', () => {
        state.active.speechMode = ui.speechMode.value;
    });

    ui.speechKeywords.addEventListener('change', () => {
        state.active.speechKeywords = ui.speechKeywords.value;
    });

    ui.speechChance.addEventListener('change', () => {
        const n = Math.max(0, Math.min(100, Number(ui.speechChance.value) || 0));
        state.active.speechChancePercent = n;
        ui.speechChance.value = String(n);
    });

    ui.speechCooldown.addEventListener('change', () => {
        const n = Math.max(0, Math.min(30000, Number(ui.speechCooldown.value) || 0));
        state.active.speechCooldownMs = n;
        ui.speechCooldown.value = String(n);
    });

    ui.speechExcerpt.addEventListener('change', () => {
        state.active.speechUseExcerpt = ui.speechExcerpt.checked;
    });

    ui.speechPhrases.addEventListener('change', () => {
        state.active.speechPhrases = ui.speechPhrases.value;
    });

    ui.speechMs.addEventListener('change', () => {
        const val = Math.max(500, Math.min(20000, Number(ui.speechMs.value) || DEFAULTS.speechDurationMs));
        state.active.speechDurationMs = val;
        ui.speechMs.value = String(val);
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function startScopeWatcher() {
    clearInterval(state.scopeWatcherId);
    state.scopeWatcherId = setInterval(updateScopeAndMaybeRefreshUi, 900);
}

export function onActivate() {
    loadSettings();
    state.activeScopeKey = getCurrentScopeKey();
    computeActiveSettings();

    ensureDom();
    applyVisualSettings();
    randomizeVelocity();
    updatePetPosition();
    buildSettingsUi();
    bindChatEvents();
    startScopeWatcher();

    cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
}
