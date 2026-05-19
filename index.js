(() => {
    const ROOT_ID = "spt_min_pet_root";

    function mount() {
        if (document.getElementById(ROOT_ID)) return;
        if (!document.body) return;

        const root = document.createElement("div");
        root.id = ROOT_ID;
        root.innerHTML = `
            <button id="spt_min_pet_btn" type="button" title="Pokemon Pet">
                POKE
            </button>
            <div id="spt_min_pet_panel" hidden>
                <div>Pokemon Pet Extension Loaded</div>
                <button id="spt_min_pet_toggle" type="button">Start</button>
            </div>
        `;
        document.body.appendChild(root);

        const btn = document.getElementById("spt_min_pet_btn");
        const panel = document.getElementById("spt_min_pet_panel");
        const toggle = document.getElementById("spt_min_pet_toggle");

        let running = false;

        btn?.addEventListener("click", () => {
            if (!panel) return;
            panel.hidden = !panel.hidden;
        });

        toggle?.addEventListener("click", () => {
            running = !running;
            toggle.textContent = running ? "Stop" : "Start";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
    } else {
        mount();
    }

    window.setInterval(mount, 2000);
})();
