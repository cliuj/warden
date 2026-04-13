const DEFAULT_PRESETS = [60, 120, 240];

const list = document.getElementById("list");
const form = document.getElementById("add-form");
const input = document.getElementById("host-input");

const presetList = document.getElementById("preset-list");
const presetForm = document.getElementById("preset-form");
const presetHours = document.getElementById("preset-hours");
const presetMinutes = document.getElementById("preset-minutes");

function fmtMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

async function getPresets() {
  const { presets } = await browser.storage.local.get("presets");
  if (!Array.isArray(presets)) {
    await browser.storage.local.set({ presets: DEFAULT_PRESETS });
    return [...DEFAULT_PRESETS];
  }
  return presets;
}

async function setPresets(next) {
  const sorted = [...new Set(next)].filter((n) => n > 0).sort((a, b) => a - b);
  await browser.storage.local.set({ presets: sorted });
}

function renderBlocklist(blocklist) {
  list.innerHTML = "";
  if (!blocklist.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sites blocked yet.";
    list.appendChild(li);
    return;
  }
  for (const host of blocklist) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = host;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      const { blocklist } = await browser.runtime.sendMessage({
        type: "removeFromBlocklist",
        host,
      });
      renderBlocklist(blocklist);
    });
    li.append(span, btn);
    list.appendChild(li);
  }
}

async function renderPresets() {
  const presets = await getPresets();
  presetList.innerHTML = "";
  if (!presets.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No presets.";
    presetList.appendChild(li);
    return;
  }
  for (const min of presets) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = fmtMinutes(min);
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      const current = await getPresets();
      await setPresets(current.filter((x) => x !== min));
      renderPresets();
    });
    li.append(span, btn);
    presetList.appendChild(li);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const host = input.value.trim();
  if (!host) return;
  const { blocklist } = await browser.runtime.sendMessage({
    type: "addToBlocklist",
    host,
  });
  input.value = "";
  renderBlocklist(blocklist);
});

presetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const h = parseInt(presetHours.value, 10) || 0;
  const m = parseInt(presetMinutes.value, 10) || 0;
  const total = h * 60 + m;
  if (total < 1) return;
  const presets = await getPresets();
  await setPresets([...presets, total]);
  presetHours.value = "";
  presetMinutes.value = "";
  renderPresets();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.blocklist) renderBlocklist(changes.blocklist.newValue || []);
  if (changes.presets) renderPresets();
});

(async () => {
  const { blocklist } = await browser.runtime.sendMessage({ type: "getStatus" });
  renderBlocklist(blocklist || []);
  renderPresets();
})();
