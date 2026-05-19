(() => {
    const ROOT_ID = "spt_min_pet_root";
    const PET_ID = "spt_pet_actor";
    const KEY = "pokemon_pet_min_settings_v1";
    const SIZE_MIN = 48;
    const SIZE_MAX = 280;

    const state = {
        enabled: true,
        autopilot: true,
        speed: 1.6,
        size: 120,
        imageData: "",
        x: 120,
        y: 120,
        vx: 1,
        vy: 1,
        draggingPet: false,
        draggingFab: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        actor: null,
        actorImg: null,
        rafId: null,
    };

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            Object.assign(state, saved);
        } catch {}
    }

    function save() {
        const data = {
            enabled: state.enabled,
            autopilot: state.autopilot,
            speed: state.speed,
            size: state.size,
            imageData: state.imageData,
            x: state.x,
            y: state.y,
        };
        localStorage.setItem(KEY, JSON.stringify(data));
    }

    function ensureActor() {
        if (state.actor) return;
        const actor = document.createElement("div");
        actor.id = PET_ID;
        actor.innerHTML = `<img id="spt_pet_actor_img" alt="pet" draggable="false" /><div id="spt_pet_actor_placeholder">PET</div>`;
        document.body.appendChild(actor);
        state.actor = actor;
        state.actorImg = actor.querySelector("#spt_pet_actor_img");
        actor.addEventListener("pointerdown", (evt) => {
            state.draggingPet = true;
            const rect = actor.getBoundingClientRect();
            state.dragOffsetX = evt.clientX - rect.left;
            state.dragOffsetY = evt.clientY - rect.top;
        });
        window.addEventListener("pointermove", (evt) => {
            if (state.draggingPet) {
                setPetPosition(evt.clientX - state.dragOffsetX, evt.clientY - state.dragOffsetY);
            }
            if (state.draggingFab) {
                const root = document.getElementById(ROOT_ID);
                if (!root) return;
                const x = clamp(evt.clientX - state.dragOffsetX, 0, Math.max(0, window.innerWidth - root.offsetWidth));
                const y = clamp(evt.clientY - state.dragOffsetY, 0, Math.max(0, window.innerHeight - root.offsetHeight));
                root.style.left = `${x}px`;
                root.style.top = `${y}px`;
                root.style.right = "auto";
                root.style.bottom = "auto";
            }
        });
        window.addEventListener("pointerup", () => {
            if (state.draggingPet || state.draggingFab) save();
            state.draggingPet = false;
            state.draggingFab = false;
        });
    }

    function setPetPosition(x, y) {
        if (!state.actor) return;
        const maxX = Math.max(0, window.innerWidth - state.size);
        const maxY = Math.max(0, window.innerHeight - state.size);
        state.x = clamp(x, 0, maxX);
        state.y = clamp(y, 0, maxY);
        state.actor.style.left = `${state.x}px`;
        state.actor.style.top = `${state.y}px`;
    }

    function applyPet() {
        ensureActor();
        state.actor.style.width = `${state.size}px`;
        state.actor.style.height = `${state.size}px`;
        state.actor.style.display = state.enabled ? "block" : "none";
        const placeholder = state.actor.querySelector("#spt_pet_actor_placeholder");
        if (state.imageData) {
            state.actorImg.src = state.imageData;
            state.actorImg.style.display = "block";
            placeholder.style.display = "none";
        } else {
            state.actorImg.style.display = "none";
            placeholder.style.display = "grid";
        }
        setPetPosition(state.x, state.y);
    }

    function tick() {
        if (state.enabled && state.autopilot && !state.draggingPet) {
            let nx = state.x + state.vx * state.speed;
            let ny = state.y + state.vy * state.speed;
            const maxX = Math.max(0, window.innerWidth - state.size);
            const maxY = Math.max(0, window.innerHeight - state.size);
            if (nx <= 0 || nx >= maxX) {
                state.vx *= -1;
                nx = clamp(nx, 0, maxX);
            }
            if (ny <= 0 || ny >= maxY) {
                state.vy *= -1;
                ny = clamp(ny, 0, maxY);
            }
            setPetPosition(nx, ny);
        }
        state.rafId = requestAnimationFrame(tick);
    }

    function bindUi(root) {
        const fab = root.querySelector("#spt_min_pet_btn");
        const panel = root.querySelector("#spt_min_pet_panel");
        const runBtn = root.querySelector("#spt_min_pet_toggle");
        const autoBtn = root.querySelector("#spt_min_pet_auto");
        const sizeRange = root.querySelector("#spt_min_pet_size");
        const sizePx = root.querySelector("#spt_min_pet_size_px");
        const speedRange = root.querySelector("#spt_min_pet_speed");
        const fileInput = root.querySelector("#spt_min_pet_file");
        const fileName = root.querySelector("#spt_min_pet_file_name");

        const renderUi = () => {
            runBtn.textContent = state.enabled ? "Stop" : "Start";
            autoBtn.textContent = `Auto: ${state.autopilot ? "ON" : "OFF"}`;
            sizeRange.value = String(state.size);
            sizePx.value = String(state.size);
            speedRange.value = String(state.speed);
            if (fileName) fileName.textContent = state.imageData ? "Image loaded" : "No image selected";
        };

        fab.addEventListener("click", () => {
            panel.hidden = !panel.hidden;
        });
        fab.addEventListener("pointerdown", (evt) => {
            const rect = root.getBoundingClientRect();
            state.draggingFab = true;
            state.dragOffsetX = evt.clientX - rect.left;
            state.dragOffsetY = evt.clientY - rect.top;
        });

        runBtn.addEventListener("click", () => {
            state.enabled = !state.enabled;
            applyPet();
            renderUi();
            save();
        });

        autoBtn.addEventListener("click", () => {
            state.autopilot = !state.autopilot;
            renderUi();
            save();
        });

        sizeRange.addEventListener("input", () => {
            state.size = clamp(Number(sizeRange.value), SIZE_MIN, SIZE_MAX);
            applyPet();
            renderUi();
            save();
        });

        const applyPx = () => {
            const v = Number(sizePx.value);
            if (Number.isNaN(v)) return;
            state.size = clamp(Math.round(v), SIZE_MIN, SIZE_MAX);
            applyPet();
            renderUi();
            save();
        };
        sizePx.addEventListener("change", applyPx);
        sizePx.addEventListener("blur", applyPx);

        speedRange.addEventListener("input", () => {
            state.speed = Number(speedRange.value);
            renderUi();
            save();
        });

        fileInput.addEventListener("change", async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            if (!(file.type === "image/png" || file.type === "image/gif")) return;
            const dataUrl = await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(file);
            });
            state.imageData = dataUrl;
            applyPet();
            if (fileName) fileName.textContent = file.name;
            save();
        });

        renderUi();
    }

    function mount() {
        if (document.getElementById(ROOT_ID) || !document.body) return;
        const root = document.createElement("div");
        root.id = ROOT_ID;
        root.innerHTML = `
            <button id="spt_min_pet_btn" type="button" title="Pokemon Pet">POKE</button>
            <div id="spt_min_pet_panel" hidden>
                <div class="spt-title">Pokemon Pet</div>
                <div class="spt-row">
                    <button id="spt_min_pet_toggle" type="button">Start</button>
                    <button id="spt_min_pet_auto" type="button">Auto: ON</button>
                </div>
                <div class="spt-row">
                    <label>Size</label>
                    <input id="spt_min_pet_size" type="range" min="48" max="280" step="1" />
                    <input id="spt_min_pet_size_px" type="number" min="48" max="280" step="1" />
                </div>
                <div class="spt-row">
                    <label>Speed</label>
                    <input id="spt_min_pet_speed" type="range" min="0.4" max="5" step="0.1" />
                </div>
                <div class="spt-row">
                    <label for="spt_min_pet_file" class="spt-upload-btn">Choose GIF/PNG</label>
                    <input id="spt_min_pet_file" type="file" accept=".gif,.png,image/gif,image/png" />
                </div>
                <div id="spt_min_pet_file_name" class="spt-file-name">No image selected</div>
            </div>
        `;
        document.body.appendChild(root);
        bindUi(root);
    }

    load();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            mount();
            applyPet();
            if (!state.rafId) tick();
        });
    } else {
        mount();
        applyPet();
        if (!state.rafId) tick();
    }

    setInterval(() => {
        mount();
        applyPet();
    }, 2000);
})();
