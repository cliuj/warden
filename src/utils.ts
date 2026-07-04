export function normalizeHost(input: string) {
  let s: string = (input || "").trim();
  if (!s) {
    return "";
  }
  if (!/^[a-z]+:\/\//i.test(s)){
    s = "http://" + s;
  }
  try {
    return new URL(s).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_) {
    return input.trim().toLowerCase().replace(/^www\./, "");
  }
}
