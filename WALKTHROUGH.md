# KOT - Whiteboard Application

## Overview
KOT is a collaborative whiteboard application featuring:
- **Infinite Canvas**: Pan and zoom capabilities.
- **Tools**: Shapes (Rect, Circle, Triangle), Text, Pencil (Freehand), Images.
- **Persistence**:
    - **Google Drive Integration**: Saves state to a specific Google Drive folder (optional).
    - **Local Storage Fallback**: Saves to `server/Data/whiteboard_state.json` if Drive is disconnected.
- **Safety**: Prevents data loss with "Unsaved Changes" warnings.

## Deployment

### Backend (Render)
- **Repo**: Connected to `KOT` on GitHub.
- **Build Command**: `pip install -r server/requirements.txt`
- **Start Command**: `gunicorn --chdir server app:app`
- **Environment Variables**:
    - `CREDENTIALS_JSON`: (Optional) Google Service Account/OAuth credentials.
    - `TOKEN_PICKLE_B64`: (Optional) Authenticated token for Drive.
    - *Note*: If these are missing, the server defaults to the local `Data/` folder.

### Frontend (Netlify)
- **Repo**: Connected to `KOT` on GitHub.
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Environment Variables**:
    - `VITE_API_URL`: `https://<your-render-app>.onrender.com/api`

## Local Development
1. **Backend**:
   ```bash
   cd server
   python app.py
   ```
   Runs on `http://localhost:5000`.

2. **Frontend**:
   ```bash
   npm run dev
   ```
   Runs on `http://localhost:5173`.

## Features Verification
- [x] **Draw & Move**: Shapes and text can be added and moved.
- [x] **Zoom & Pan**: Canvas navigation works smoothly.
- [x] **Auto-Save**: Changes are saved automatically after 2 seconds.
- [x] **Load**: State is restored on page refresh.
- [x] **Cloud Sync**: Indicator shows "Saved" (Green), "Saving" (Yellow), or "Error" (Red).

## Recent Changes
- Implemented **Local Storage Fallback** mechanism in `drive_service.py`.
- Added **Headless Detection** to prevent server hangs on Render.
- Hardened **Indentation and Error Handling** in backend services.
