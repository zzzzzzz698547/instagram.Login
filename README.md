# Customer Records Demo

This repo contains a safe customer contact form with an admin dashboard.

## Run locally

```bash
npm install
npm start
```

Open:
- `http://localhost:3000/` for the public form
- `http://localhost:3000/admin` for the admin dashboard

## Render settings

- Service type: `Web Service`
- Root Directory: leave blank
- Build Command: `npm install`
- Start Command: `npm start`
- Or import `render.yaml` directly from the repo root

Default admin login:
- Username: `admin`
- Password: `123456`

## Optional Telegram start notification

If you want a `server start` notification, set these environment variables:

- `TG_BOT_TOKEN`
- `TG_CHAT_ID`

Local PowerShell example:

```powershell
$env:TG_BOT_TOKEN="your_telegram_bot_token"
$env:TG_CHAT_ID="your_telegram_chat_id"
npm start
```

Render example:

- Add `TG_BOT_TOKEN` and `TG_CHAT_ID` in the service environment variables
- Redeploy after saving the variables
