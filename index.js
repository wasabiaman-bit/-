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
        imageType: "",
        x: 120,
        y: 120,
        vx: 1,
        vy: 1,
        gifSpeedMultiplier: 1.2,
        shadowOpacity: 0.35,
        draggingPet: false,
        draggingFab: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        actor: null,
        actorImg: null,
        rafId: null,
        bubbleEl: null,
        lastChatSignature: "",
        bubbleTimer: null,
        idleMoodTimer: null,
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
            imageType: state.imageType,
            x: state.x,
            y: state.y,
            gifSpeedMultiplier: state.gifSpeedMultiplier,
            shadowOpacity: state.shadowOpacity,
        };
        localStorage.setItem(KEY, JSON.stringify(data));
    }

    function ensureActor() {
        if (state.actor) return;
        const actor = document.createElement("div");
        actor.id = PET_ID;
        actor.innerHTML = `<img id="spt_pet_actor_img" alt="pet" draggable="false" /><div id="spt_pet_actor_placeholder">PET</div><div id="spt_pet_bubble" hidden>🙂</div>`;
        document.body.appendChild(actor);
        state.actor = actor;
        state.actorImg = actor.querySelector("#spt_pet_actor_img");
        state.bubbleEl = actor.querySelector("#spt_pet_bubble");

        actor.addEventListener("pointerdown", (evt) => {
            state.draggingPet = true;
            showBubble('💦');
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

    function showBubble(emoji) {
        if (!state.bubbleEl) return;
        state.bubbleEl.textContent = emoji;
        state.bubbleEl.hidden = false;
        if (state.bubbleTimer) window.clearTimeout(state.bubbleTimer);
        state.bubbleTimer = window.setTimeout(() => {
            if (state.bubbleEl) state.bubbleEl.hidden = true;
        }, 4200);
    }

    function moodFromText(text, role) {
        const t = (text || "").toLowerCase();
        if (!t) return role === "user" ? "🙂" : "😶";
        if (/(ㅋㅋ|ㅎㅎ|haha|lol|좋아|행복|고마워|thanks|love|최고|재밌|신나)/.test(t)) return role === "user" ? "😄" : "🥰";
        if (/(슬퍼|우울|sad|cry|힘들|아파|미안|sorry|외로)/.test(t)) return role === "user" ? "🥺" : "😢";
        if (/(화나|짜증|angry|hate|빡쳐|분노|열받)/.test(t)) return role === "user" ? "😠" : "😾";
        if (/(배고|먹|밥|치킨|라면|food|hungry)/.test(t)) return "😋";
        if (/(놀라|헉|wow|omg|대박|진짜\?|what|충격)/.test(t)) return role === "user" ? "😲" : "😮";
        if (/(sleep|졸려|자자|굿나잇|피곤|졸음)/.test(t)) return "😪";
        if (/(고마|감사)/.test(t)) return "🙏";
        if (/(싸우|전투|battle|fight|결투)/.test(t)) return "⚡";
        if (/(무서|공포|scary|horror)/.test(t)) return "😱";
        if (/(궁금|왜|어째서|question|how|help)/.test(t)) return "🤔";
        if (/(귀여|cute|사랑스러)/.test(t)) return "😍";
        return role === "user" ? "🙂" : "🐾";
    }

    function randomIdleMood() {
        const pool = ["😴", "🥱", "🍖", "🍓", "💤", "🐾", "🎈", "😶", "😼", "✨", "🤤", "🫧"];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function setupIdleMood() {
        if (state.idleMoodTimer) return;
        state.idleMoodTimer = window.setInterval(() => {
            if (!state.enabled) return;
            if (Math.random() < 0.8) return;
            showBubble(randomIdleMood());
        }, 14000);
    }

    function inferRole(el) {
        if (!el) return "unknown";
        const cls = (el.className || "").toString().toLowerCase();
        if (cls.includes("is_user") || cls.includes("user") || cls.includes("you")) return "user";
        if (cls.includes("assistant") || cls.includes("ai") || cls.includes("char") || cls.includes("bot")) return "assistant";
        const dataUser = el.getAttribute("data-is-user");
        if (dataUser === "true" || dataUser === "1") return "user";
        if (dataUser === "false" || dataUser === "0") return "assistant";
        return "assistant";
    }

    function latestChatMessage() {
        const selectors = [
            "#chat .mes:last-child",
            ".mes:last-child",
            ".chat .message:last-child",
            "#chat .message:last-child",
        ];
        for (const sel of selectors) {
            const mesEl = document.querySelector(sel);
            if (!mesEl) continue;
            const textEl =
                mesEl.querySelector(".mes_text") ||
                mesEl.querySelector(".message_text") ||
                mesEl.querySelector(".text");
            const text = (textEl?.textContent || mesEl.textContent || "").trim();
            if (!text) continue;
            const role = inferRole(mesEl);
            const signature = `${role}:${text.slice(0, 120)}`;
            return { text, role, signature };
        }
        return null;
    }

    function setupChatMoodObserver() {
        const run = () => {
            const msg = latestChatMessage();
            if (!msg) return;
            if (msg.signature === state.lastChatSignature) return;
            state.lastChatSignature = msg.signature;
            showBubble(moodFromText(msg.text, msg.role));
        };
        const obs = new MutationObserver(run);
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        window.setInterval(run, 2800);
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
        state.actor.style.filter = `drop-shadow(0 8px 14px rgba(0, 0, 0, ${clamp(state.shadowOpacity, 0, 1)}))`;
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
            const isGif = state.imageType === "image/gif";
            const effectiveSpeed = state.speed * (isGif ? state.gifSpeedMultiplier : 1);
            let nx = state.x + state.vx * effectiveSpeed;
            let ny = state.y + state.vy * effectiveSpeed;
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
        const gifSpeed = root.querySelector("#spt_min_pet_gif_speed");
        const shadow = root.querySelector("#spt_min_pet_shadow");
        const fileInput = root.querySelector("#spt_min_pet_file");
        const fileName = root.querySelector("#spt_min_pet_file_name");
        const tabBasic = root.querySelector("#spt_tab_basic");
        const tabAdvanced = root.querySelector("#spt_tab_advanced");
        const paneBasic = root.querySelector("#spt_pane_basic");
        const paneAdvanced = root.querySelector("#spt_pane_advanced");

        const renderUi = () => {
            runBtn.textContent = state.enabled ? "Stop" : "Start";
            autoBtn.textContent = `Auto: ${state.autopilot ? "ON" : "OFF"}`;
            sizeRange.value = String(state.size);
            sizePx.value = String(state.size);
            speedRange.value = String(state.speed);
            gifSpeed.value = String(state.gifSpeedMultiplier);
            shadow.value = String(state.shadowOpacity);
            if (fileName) fileName.textContent = state.imageData ? "Image loaded" : "No image selected";
        };

        const setTab = (name) => {
            const basic = name === "basic";
            paneBasic.hidden = !basic;
            paneAdvanced.hidden = basic;
            tabBasic.classList.toggle("is-active", basic);
            tabAdvanced.classList.toggle("is-active", !basic);
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
        gifSpeed.addEventListener("input", () => {
            state.gifSpeedMultiplier = Number(gifSpeed.value);
            renderUi();
            save();
        });
        shadow.addEventListener("input", () => {
            state.shadowOpacity = Number(shadow.value);
            applyPet();
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
            state.imageType = file.type;
            applyPet();
            if (fileName) fileName.textContent = file.name;
            save();
        });
        tabBasic.addEventListener("click", () => setTab("basic"));
        tabAdvanced.addEventListener("click", () => setTab("advanced"));

        setTab("basic");
        renderUi();
    }

    function mount() {
        if (document.getElementById(ROOT_ID) || !document.body) return;
        const root = document.createElement("div");
        root.id = ROOT_ID;
        root.innerHTML = `
            <button id="spt_min_pet_btn" type="button" title="Pokemon Pet"></button>
            <div id="spt_min_pet_panel" hidden>
                <div class="spt-title">Pokemon Pet</div>
                <div class="spt-tabs">
                    <button id="spt_tab_basic" type="button" class="spt-tab is-active">Basic</button>
                    <button id="spt_tab_advanced" type="button" class="spt-tab">Advanced</button>
                </div>
                <div id="spt_pane_basic">
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
                        <input id="spt_min_pet_file" type="file" accept=".gif,.png,image/gif,image/png" />
                        <label for="spt_min_pet_file" class="spt-upload-btn">Choose GIF/PNG</label>
                    </div>
                    <div id="spt_min_pet_file_name" class="spt-file-name">No image selected</div>
                </div>
                <div id="spt_pane_advanced" hidden>
                    <div class="spt-row">
                        <label>Speed</label>
                        <input id="spt_min_pet_speed" type="range" min="0.4" max="5" step="0.1" />
                    </div>
                    <div class="spt-row">
                        <label>GIF</label>
                        <input id="spt_min_pet_gif_speed" type="range" min="0.4" max="3" step="0.1" />
                    </div>
                    <div class="spt-row">
                        <label>Shadow</label>
                        <input id="spt_min_pet_shadow" type="range" min="0" max="1" step="0.05" />
                    </div>
                </div>
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
            setupChatMoodObserver();
            setupIdleMood();
        });
    } else {
        mount();
        applyPet();
        if (!state.rafId) tick();
        setupChatMoodObserver();
        setupIdleMood();
    }

    setInterval(() => {
        mount();
        applyPet();
    }, 2000);
})();


