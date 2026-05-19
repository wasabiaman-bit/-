// SillyTavern extension: Floating Pokemon Pet
// Features:
// 1) Autonomous movement on home/chat pages
// 2) User drag movement
// 3) User-provided GIF/PNG image (stored in extension settings)

import { extension_settings, saveSettingsDebounced } from "../../../extensions.js";

const EXT_NAME = "pokemon-pet-extension";

const DEFAULTS = {
    enabled: true,
    imageData: "",
    imageName: "",
    size: 120,
    speed: 1.6,
    autopilot: true,
    x: 120,
    y: 120,
};
const PET_SIZE_MIN = 48;
const PET_SIZE_MAX = 280;

let rootEl = null;
let petEl = null;
let imgEl = null;
let animationFrame = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let velocityX = 1;
let velocityY = 1;
let uiMounted = false;
let mountIntervalId = null;
let mountObserver = null;
let floatingUiMounted = false;
let fabDragging = false;
let fabDragOffsetX = 0;
let fabDragOffsetY = 0;

function getSettingsHtml() {
    return `
<div class="inline-drawer spt-pet-drawer" id="spt_pet_drawer">
    <div class="inline-drawer-toggle inline-drawer-header spt-pet-drawer-head">
        <b>Pokemon Pet Overlay</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
        <div class="spt-pet-card">
            <div class="spt-pet-topbar">
                <span id="spt_pet_status_badge" class="spt-pet-status-badge">Stopped</span>
                <span id="spt_pet_filename" class="spt-pet-filename">No image selected</span>
            </div>
            <div class="spt-pet-button-row">
                <button id="spt_pet_toggle_run" class="menu_button spt-pet-btn-primary">Start</button>
                <button id="spt_pet_toggle_auto" class="menu_button">Auto: ON</button>
                <button id="spt_pet_reset_position" class="menu_button">Reset Position</button>
            </div>
            <div class="spt-pet-settings-row">
                <label for="spt_pet_enabled">Enable pet</label>
                <input id="spt_pet_enabled" type="checkbox" />
            </div>
            <div class="spt-pet-settings-row">
                <label for="spt_pet_autopilot">Autonomous move</label>
                <input id="spt_pet_autopilot" type="checkbox" />
            </div>
            <div class="spt-pet-settings-row">
                <label for="spt_pet_size">Size</label>
                <input id="spt_pet_size" type="range" min="48" max="280" step="1" />
                <input id="spt_pet_size_px" class="text_pole spt-pet-px-input" type="number" min="48" max="280" step="1" />
                <span id="spt_pet_size_value" class="spt-pet-value">120px</span>
            </div>
            <div class="spt-pet-settings-row">
                <label for="spt_pet_speed">Speed</label>
                <input id="spt_pet_speed" type="range" min="0.4" max="5" step="0.1" />
                <span id="spt_pet_speed_value" class="spt-pet-value">1.6</span>
            </div>
            <div class="spt-pet-settings-row spt-pet-file-row">
                <label for="spt_pet_file" class="menu_button spt-pet-upload-btn">Choose GIF/PNG</label>
                <input id="spt_pet_file" type="file" accept=".gif,.png,image/gif,image/png" />
            </div>
            <div class="spt-pet-preview-wrap">
                <div class="spt-pet-preview-title">Web Preview</div>
                <div class="spt-pet-preview-box">
                    <img id="spt_pet_preview_img" class="spt-pet-preview-img" alt="pet preview" />
                    <div id="spt_pet_preview_placeholder" class="spt-pet-preview-placeholder">Upload GIF/PNG to preview</div>
                </div>
            </div>
        </div>
    </div>
</div>`;
}

function ensureSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...DEFAULTS };
    }
    for (const [key, val] of Object.entries(DEFAULTS)) {
        if (extension_settings[EXT_NAME][key] === undefined) {
            extension_settings[EXT_NAME][key] = val;
        }
    }
}

function cfg() {
    return extension_settings[EXT_NAME];
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function setPetPosition(x, y) {
    if (!petEl) return;
    const size = Number(cfg().size) || DEFAULTS.size;
    const maxX = window.innerWidth - size;
    const maxY = window.innerHeight - size;
    const nx = clamp(x, 0, Math.max(0, maxX));
    const ny = clamp(y, 0, Math.max(0, maxY));

    cfg().x = nx;
    cfg().y = ny;
    petEl.style.left = `${nx}px`;
    petEl.style.top = `${ny}px`;
}

function bounceVelocity() {
    velocityX = Math.random() > 0.5 ? 1 : -1;
    velocityY = Math.random() > 0.5 ? 1 : -1;
}

function tick() {
    if (!rootEl || !petEl) return;
    const settings = cfg();
    const size = Number(settings.size) || DEFAULTS.size;
    const speed = Number(settings.speed) || DEFAULTS.speed;

    if (settings.enabled && settings.autopilot && !isDragging) {
        let nx = settings.x + velocityX * speed;
        let ny = settings.y + velocityY * speed;
        const maxX = Math.max(0, window.innerWidth - size);
        const maxY = Math.max(0, window.innerHeight - size);

        if (nx <= 0 || nx >= maxX) {
            velocityX *= -1;
            nx = clamp(nx, 0, maxX);
        }
        if (ny <= 0 || ny >= maxY) {
            velocityY *= -1;
            ny = clamp(ny, 0, maxY);
        }

        setPetPosition(nx, ny);
    }

    animationFrame = window.requestAnimationFrame(tick);
}

function destroyPet() {
    if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    if (rootEl) {
        rootEl.remove();
        rootEl = null;
        petEl = null;
        imgEl = null;
    }
}

function applyPetVisual() {
    if (!petEl || !imgEl) return;
    const settings = cfg();
    const size = Number(settings.size) || DEFAULTS.size;

    petEl.style.width = `${size}px`;
    petEl.style.height = `${size}px`;

    if (settings.imageData) {
        imgEl.src = settings.imageData;
        imgEl.style.display = "block";
        petEl.classList.remove("spt-pet-placeholder");
    } else {
        imgEl.style.display = "none";
        petEl.classList.add("spt-pet-placeholder");
    }
}

function onPointerDown(evt) {
    if (!petEl) return;
    isDragging = true;
    petEl.setPointerCapture(evt.pointerId);
    const rect = petEl.getBoundingClientRect();
    dragOffsetX = evt.clientX - rect.left;
    dragOffsetY = evt.clientY - rect.top;
}

function onPointerMove(evt) {
    if (!isDragging) return;
    const nx = evt.clientX - dragOffsetX;
    const ny = evt.clientY - dragOffsetY;
    setPetPosition(nx, ny);
}

function onPointerUp(evt) {
    if (!petEl) return;
    isDragging = false;
    petEl.releasePointerCapture(evt.pointerId);
    saveSettingsDebounced();
}

function createPetIfNeeded() {
    if (rootEl) return;
    rootEl = document.createElement("div");
    rootEl.id = "spt-floating-pet-root";
    rootEl.innerHTML = `
      <div id="spt-floating-pet" class="spt-floating-pet">
        <img id="spt-floating-pet-image" alt="pet" draggable="false" />
      </div>
    `;
    document.body.appendChild(rootEl);

    petEl = document.getElementById("spt-floating-pet");
    imgEl = document.getElementById("spt-floating-pet-image");
    petEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("resize", () => setPetPosition(cfg().x, cfg().y));

    bounceVelocity();
    applyPetVisual();
    setPetPosition(cfg().x, cfg().y);
    animationFrame = window.requestAnimationFrame(tick);
}

function refreshVisibility() {
    if (!rootEl) return;
    rootEl.style.display = cfg().enabled ? "block" : "none";
}

function updateUiState() {
    const enabledEl = document.getElementById("spt_pet_enabled");
    const autopilotEl = document.getElementById("spt_pet_autopilot");
    const sizeEl = document.getElementById("spt_pet_size");
    const speedEl = document.getElementById("spt_pet_speed");
    const filenameEl = document.getElementById("spt_pet_filename");
    const sizeValueEl = document.getElementById("spt_pet_size_value");
    const sizePxEl = document.getElementById("spt_pet_size_px");
    const speedValueEl = document.getElementById("spt_pet_speed_value");
    const runBtnEl = document.getElementById("spt_pet_toggle_run");
    const autoBtnEl = document.getElementById("spt_pet_toggle_auto");
    const badgeEl = document.getElementById("spt_pet_status_badge");
    const previewImgEl = document.getElementById("spt_pet_preview_img");
    const previewPlaceholderEl = document.getElementById("spt_pet_preview_placeholder");
    const fabStatusEl = document.getElementById("spt_pet_fab_status");
    const quickRunEl = document.getElementById("spt_pet_quick_run");
    const quickAutoEl = document.getElementById("spt_pet_quick_auto");
    const quickSizeEl = document.getElementById("spt_pet_quick_size");
    const quickSizePxEl = document.getElementById("spt_pet_quick_size_px");
    const quickSpeedEl = document.getElementById("spt_pet_quick_speed");

    if (!enabledEl || !autopilotEl || !sizeEl || !speedEl || !filenameEl) return;

    enabledEl.checked = cfg().enabled;
    autopilotEl.checked = cfg().autopilot;
    sizeEl.value = String(cfg().size);
    if (sizePxEl) sizePxEl.value = String(cfg().size);
    speedEl.value = String(cfg().speed);
    filenameEl.textContent = cfg().imageName || "No image selected";

    if (sizeValueEl) sizeValueEl.textContent = `${cfg().size}px`;
    if (speedValueEl) speedValueEl.textContent = Number(cfg().speed).toFixed(1);
    if (runBtnEl) runBtnEl.textContent = cfg().enabled ? "Stop" : "Start";
    if (autoBtnEl) autoBtnEl.textContent = `Auto: ${cfg().autopilot ? "ON" : "OFF"}`;
    if (badgeEl) {
        badgeEl.textContent = cfg().enabled ? "Running" : "Stopped";
        badgeEl.classList.toggle("is-off", !cfg().enabled);
    }
    if (previewImgEl && previewPlaceholderEl) {
        if (cfg().imageData) {
            previewImgEl.src = cfg().imageData;
            previewImgEl.style.width = `${cfg().size}px`;
            previewImgEl.style.height = `${cfg().size}px`;
            previewImgEl.style.display = "block";
            previewPlaceholderEl.style.display = "none";
        } else {
            previewImgEl.style.display = "none";
            previewPlaceholderEl.style.display = "block";
        }
    }
    if (fabStatusEl) fabStatusEl.textContent = cfg().enabled ? "ON" : "OFF";
    if (quickRunEl) quickRunEl.textContent = cfg().enabled ? "Stop" : "Start";
    if (quickAutoEl) quickAutoEl.textContent = `Auto: ${cfg().autopilot ? "ON" : "OFF"}`;
    if (quickSizeEl) quickSizeEl.value = String(cfg().size);
    if (quickSizePxEl) quickSizePxEl.value = String(cfg().size);
    if (quickSpeedEl) quickSpeedEl.value = String(cfg().speed);
}

function bindSettingsUI() {
    const enabledEl = document.getElementById("spt_pet_enabled");
    const autopilotEl = document.getElementById("spt_pet_autopilot");
    const sizeEl = document.getElementById("spt_pet_size");
    const speedEl = document.getElementById("spt_pet_speed");
    const sizePxEl = document.getElementById("spt_pet_size_px");
    const fileEl = document.getElementById("spt_pet_file");
    const resetEl = document.getElementById("spt_pet_reset_position");
    const filenameEl = document.getElementById("spt_pet_filename");
    const runBtnEl = document.getElementById("spt_pet_toggle_run");
    const autoBtnEl = document.getElementById("spt_pet_toggle_auto");

    if (!enabledEl || !autopilotEl || !sizeEl || !sizePxEl || !speedEl || !fileEl || !resetEl || !filenameEl || !runBtnEl || !autoBtnEl) {
        console.warn(`[${EXT_NAME}] settings UI elements are missing.`);
        return;
    }

    updateUiState();

    enabledEl.addEventListener("change", () => {
        cfg().enabled = enabledEl.checked;
        refreshVisibility();
        updateUiState();
        saveSettingsDebounced();
    });

    autopilotEl.addEventListener("change", () => {
        cfg().autopilot = autopilotEl.checked;
        updateUiState();
        saveSettingsDebounced();
    });

    sizeEl.addEventListener("input", () => {
        cfg().size = clamp(Number(sizeEl.value), PET_SIZE_MIN, PET_SIZE_MAX);
        applyPetVisual();
        setPetPosition(cfg().x, cfg().y);
        updateUiState();
        saveSettingsDebounced();
    });

    const onSizePxChanged = () => {
        const parsed = Number(sizePxEl.value);
        if (Number.isNaN(parsed)) return;
        cfg().size = clamp(Math.round(parsed), PET_SIZE_MIN, PET_SIZE_MAX);
        applyPetVisual();
        setPetPosition(cfg().x, cfg().y);
        updateUiState();
        saveSettingsDebounced();
    };
    sizePxEl.addEventListener("change", onSizePxChanged);
    sizePxEl.addEventListener("blur", onSizePxChanged);

    speedEl.addEventListener("input", () => {
        cfg().speed = Number(speedEl.value);
        updateUiState();
        saveSettingsDebounced();
    });

    fileEl.addEventListener("change", async () => {
        const file = fileEl.files?.[0];
        if (!file) return;
        const isAllowed = file.type === "image/png" || file.type === "image/gif";
        if (!isAllowed) {
            toastr.error("Only PNG or GIF files are supported.");
            fileEl.value = "";
            return;
        }

        const dataUrl = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(file);
        });

        cfg().imageData = dataUrl;
        cfg().imageName = file.name;
        filenameEl.textContent = file.name;
        applyPetVisual();
        updateUiState();
        saveSettingsDebounced();
    });

    resetEl.addEventListener("click", () => {
        cfg().x = DEFAULTS.x;
        cfg().y = DEFAULTS.y;
        bounceVelocity();
        setPetPosition(cfg().x, cfg().y);
        saveSettingsDebounced();
    });

    runBtnEl.addEventListener("click", () => {
        cfg().enabled = !cfg().enabled;
        refreshVisibility();
        updateUiState();
        saveSettingsDebounced();
    });

    autoBtnEl.addEventListener("click", () => {
        cfg().autopilot = !cfg().autopilot;
        autopilotEl.checked = cfg().autopilot;
        updateUiState();
        saveSettingsDebounced();
    });
}

async function mountSettingsUI() {
    if (uiMounted || document.getElementById("spt_pet_drawer")) {
        uiMounted = true;
        return;
    }
    const host = document.querySelector("#extensions_settings2") || document.querySelector("#extensions_settings");
    if (!host) return;
    host.insertAdjacentHTML("beforeend", getSettingsHtml());
    bindSettingsUI();
    uiMounted = true;
    if (mountIntervalId) {
        window.clearInterval(mountIntervalId);
        mountIntervalId = null;
    }
    if (mountObserver) {
        mountObserver.disconnect();
        mountObserver = null;
    }
}

async function waitAndMountSettingsUI() {
    for (let i = 0; i < 30; i++) {
        await mountSettingsUI();
        if (uiMounted) return;
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    console.warn(`[${EXT_NAME}] settings host was not found.`);
}

function setupUiAutoMount() {
    if (uiMounted) return;

    mountIntervalId = window.setInterval(() => {
        if (!uiMounted) {
            mountSettingsUI().catch((err) => console.error(`[${EXT_NAME}] interval mount failed`, err));
        }
    }, 1500);

    mountObserver = new MutationObserver(() => {
        if (!uiMounted) {
            mountSettingsUI().catch((err) => console.error(`[${EXT_NAME}] observer mount failed`, err));
        }
    });
    mountObserver.observe(document.body, { childList: true, subtree: true });
}

function createFloatingUI() {
    if (floatingUiMounted || document.getElementById("spt_pet_fab")) return;
    if (!document.body) return;
    const wrapper = document.createElement("div");
    wrapper.id = "spt_pet_fab_wrap";
    wrapper.innerHTML = `
        <button id="spt_pet_fab" type="button" title="Pokemon Pet Controls">
            <span class="spt-pet-fab-dot"></span>
            <span id="spt_pet_fab_status">ON</span>
        </button>
        <div id="spt_pet_quick_panel" class="spt-pet-quick-panel">
            <div class="spt-pet-quick-head">Pokemon Pet</div>
            <div class="spt-pet-button-row">
                <button id="spt_pet_quick_run" class="menu_button spt-pet-btn-primary">Start</button>
                <button id="spt_pet_quick_auto" class="menu_button">Auto: ON</button>
                <button id="spt_pet_quick_reset" class="menu_button">Reset</button>
            </div>
            <div class="spt-pet-settings-row">
                <label for="spt_pet_quick_size">Size</label>
                <input id="spt_pet_quick_size" type="range" min="48" max="280" step="1" />
                <input id="spt_pet_quick_size_px" class="text_pole spt-pet-px-input" type="number" min="48" max="280" step="1" />
            </div>
            <div class="spt-pet-settings-row">
                <label for="spt_pet_quick_speed">Speed</label>
                <input id="spt_pet_quick_speed" type="range" min="0.4" max="5" step="0.1" />
            </div>
            <div class="spt-pet-settings-row spt-pet-file-row">
                <label for="spt_pet_quick_file" class="menu_button spt-pet-upload-btn">Choose GIF/PNG</label>
                <input id="spt_pet_quick_file" type="file" accept=".gif,.png,image/gif,image/png" />
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);

    const fabEl = document.getElementById("spt_pet_fab");
    const panelEl = document.getElementById("spt_pet_quick_panel");
    const quickRunEl = document.getElementById("spt_pet_quick_run");
    const quickAutoEl = document.getElementById("spt_pet_quick_auto");
    const quickResetEl = document.getElementById("spt_pet_quick_reset");
    const quickSizeEl = document.getElementById("spt_pet_quick_size");
    const quickSizePxEl = document.getElementById("spt_pet_quick_size_px");
    const quickSpeedEl = document.getElementById("spt_pet_quick_speed");
    const quickFileEl = document.getElementById("spt_pet_quick_file");

    fabEl?.addEventListener("click", () => panelEl?.classList.toggle("is-open"));
    fabEl?.addEventListener("pointerdown", (evt) => {
        const rect = wrapper.getBoundingClientRect();
        fabDragging = true;
        fabDragOffsetX = evt.clientX - rect.left;
        fabDragOffsetY = evt.clientY - rect.top;
        wrapper.setPointerCapture?.(evt.pointerId);
    });
    window.addEventListener("pointermove", (evt) => {
        if (!fabDragging) return;
        const x = clamp(evt.clientX - fabDragOffsetX, 0, Math.max(0, window.innerWidth - wrapper.offsetWidth));
        const y = clamp(evt.clientY - fabDragOffsetY, 0, Math.max(0, window.innerHeight - wrapper.offsetHeight));
        wrapper.style.left = `${x}px`;
        wrapper.style.top = `${y}px`;
        wrapper.style.right = "auto";
        wrapper.style.bottom = "auto";
    });
    window.addEventListener("pointerup", () => {
        fabDragging = false;
    });
    quickRunEl?.addEventListener("click", () => {
        cfg().enabled = !cfg().enabled;
        refreshVisibility();
        updateUiState();
        saveSettingsDebounced();
    });
    quickAutoEl?.addEventListener("click", () => {
        cfg().autopilot = !cfg().autopilot;
        updateUiState();
        saveSettingsDebounced();
    });
    quickResetEl?.addEventListener("click", () => {
        cfg().x = DEFAULTS.x;
        cfg().y = DEFAULTS.y;
        setPetPosition(cfg().x, cfg().y);
        saveSettingsDebounced();
    });
    quickSizeEl?.addEventListener("input", () => {
        cfg().size = clamp(Number(quickSizeEl.value), PET_SIZE_MIN, PET_SIZE_MAX);
        applyPetVisual();
        setPetPosition(cfg().x, cfg().y);
        updateUiState();
        saveSettingsDebounced();
    });
    const quickSizeCommit = () => {
        if (!quickSizePxEl) return;
        const parsed = Number(quickSizePxEl.value);
        if (Number.isNaN(parsed)) return;
        cfg().size = clamp(Math.round(parsed), PET_SIZE_MIN, PET_SIZE_MAX);
        applyPetVisual();
        setPetPosition(cfg().x, cfg().y);
        updateUiState();
        saveSettingsDebounced();
    };
    quickSizePxEl?.addEventListener("change", quickSizeCommit);
    quickSizePxEl?.addEventListener("blur", quickSizeCommit);
    quickSpeedEl?.addEventListener("input", () => {
        cfg().speed = Number(quickSpeedEl.value);
        updateUiState();
        saveSettingsDebounced();
    });
    quickFileEl?.addEventListener("change", async () => {
        const file = quickFileEl.files?.[0];
        if (!file) return;
        const isAllowed = file.type === "image/png" || file.type === "image/gif";
        if (!isAllowed) return;
        const dataUrl = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(file);
        });
        cfg().imageData = dataUrl;
        cfg().imageName = file.name;
        applyPetVisual();
        updateUiState();
        saveSettingsDebounced();
    });

    floatingUiMounted = true;
    updateUiState();
}

async function init() {
    ensureSettings();
    createFloatingUI();
    await waitAndMountSettingsUI();
    setupUiAutoMount();
    createPetIfNeeded();
    createFloatingUI();
    refreshVisibility();
}

init().catch((err) => {
    console.error(`[${EXT_NAME}] failed to initialize`, err);
});

window.addEventListener("DOMContentLoaded", () => {
    createFloatingUI();
});

window.setInterval(() => {
    if (!document.getElementById("spt_pet_fab")) {
        createFloatingUI();
    }
}, 2000);

window.addEventListener("beforeunload", () => {
    destroyPet();
});
