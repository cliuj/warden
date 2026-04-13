const list = document.getElementById("list");
const form = document.getElementById("add-form");
const input = document.getElementById("host-input");

function render(blocklist) {
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
      render(blocklist);
    });
    li.append(span, btn);
    list.appendChild(li);
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
  render(blocklist);
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blocklist) render(changes.blocklist.newValue || []);
});

(async () => {
  const { blocklist } = await browser.runtime.sendMessage({ type: "getStatus" });
  render(blocklist || []);
})();
