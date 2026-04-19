# Google Calendar Setup

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library**
4. Search for **Google Calendar API** and enable it

## 2. Create OAuth 2.0 credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the **Client ID** → `GOOGLE_CLIENT_ID`
5. Copy the **Client Secret** → `GOOGLE_CLIENT_SECRET`

## 3. Get a refresh token (one-time)

1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (⚙️) → check **"Use your own OAuth credentials"**
3. Enter your Client ID and Client Secret
4. In the left panel, find **Google Calendar API v3** and select:
   - `https://www.googleapis.com/auth/calendar`
5. Click **Authorize APIs** → sign in with the target Google account
6. Click **Exchange authorization code for tokens**
7. Copy the **Refresh token** → `GOOGLE_REFRESH_TOKEN`

## 4. Get your Calendar ID

1. Go to https://calendar.google.com
2. Settings (⚙️) → click your calendar name on the left
3. Scroll down to **Integrate calendar**
4. Copy the **Calendar ID** (looks like `yourname@gmail.com` or a long hash string)
5. → `GOOGLE_CALENDAR_ID`

## 5. Add to .env.local

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_CALENDAR_ID=your_calendar_id_here
```
