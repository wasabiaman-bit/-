// SillyTavern extension: Floating Pokemon Pet
// Features:
// 1) Autonomous movement on home/chat pages
// 2) User drag movement
// 3) User-provided GIF/PNG image (stored in extension settings)

import { extension_settings, saveSettingsDebounced } from "../../../extensions.js";
import { getContext, renderExtensionTemplateAsync } from "../../../script.js";

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
    const context = getContext();
    const html = await renderExtensionTemplateAsync(`third-party/${EXT_NAME}`, "settings");
    context.settingsHtml = context.settingsHtml || "";
    $("#extensions_settings2").append(html);
    bindSettingsUI();
}

async function init() {
    ensureSettings();
    await mountSettingsUI();
    createPetIfNeeded();
    refreshVisibility();
}

init().catch((err) => {
    console.error(`[${EXT_NAME}] failed to initialize`, err);
});

window.addEventListener("beforeunload", () => {
    destroyPet();
});
