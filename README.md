# Eryon Agent Runtime

Eryon is now an **interactive and active** browser-based agent runtime (not just static UI).

## What it can actively do

- Accept text and voice prompts and convert them into executable actions.
- Maintain a live **action queue** and execute tasks in an autonomous loop.
- Fetch email/WhatsApp messages from configured webhook APIs.
- Extract tasks from inbox text and autoplan actions from those tasks.
- Draft and (optionally) send email/WhatsApp replies through configured send APIs.
- Run multi-step workflows and convert steps into executable actions.
- Open websites, launch YouTube searches, and run shopping searches.
- Generate homework answer drafts and save output as Word-compatible `.doc`.
- Engage an emergency kill switch to cancel queue and stop all automation.

## Run

Open `index.html` in a modern Chromium browser.

## Enable real on-your-behalf actions

To let Eryon perform real message fetch/send work, configure these endpoints in the UI:

- `Email fetch API URL` (GET)
- `Email send API URL` (POST)
- `WhatsApp fetch API URL` (GET)
- `WhatsApp send API URL` (POST)

Expected send payload:

```json
{
  "message": "...",
  "source": "eryon"
}
```

## Practical limitation

Direct OS-wide clicking and fully autonomous control across arbitrary third-party websites requires native/OS automation permissions and dedicated connectors. This runtime provides the active orchestration layer and integration points to plug those capabilities in safely.
