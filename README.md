# warden

Personal Firefox extension for focused work. Set a timebox (e.g. 4h), Warden
runs 25/5 Pomodoro cycles inside it, blocking a user-curated site list during
focus phases and unblocking everything during breaks. When the timebox ends,
everything unblocks until the next session.

## Install (temporary)

1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Select `manifest.json` from this directory.

## Use

- Click the toolbar icon → set hours/minutes → **Start session**.
- Add sites to the blocklist: right-click a page → *Warden: block this site*,
  or press **Ctrl+Shift+B** on the tab you want to block, or type the hostname
  in the options page (toolbar popup → *Blocklist*).
- Mid-session reset: toolbar popup → **Reset session**.

Sessions resume across browser restarts. Hostname entries also match
subdomains (`youtube.com` covers `www.youtube.com`, `m.youtube.com`, etc.).
