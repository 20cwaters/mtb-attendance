# MTB Attendance - Mountain Biking Team Attendance App

A full-stack web app for managing mountain biking team attendance. Coaches organize students into groups, take attendance during practice, leave notes, and export reports to Google Sheets.

## Prerequisites

- **Node.js** 18+ (tested with 24.x)
- A **Google Cloud** project with the Sheets API enabled
- A **Google Spreadsheet** shared with a service account

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "New Project" and name it (e.g., `mtb-attendance`)
3. Select the project

### 2. Enable Google Sheets API

1. Go to **APIs & Services > Library**
2. Search for "Google Sheets API"
3. Click **Enable**

### 3. Create a Service Account

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > Service Account**
3. Name it (e.g., `mtb-sheets-service`)
4. Click **Done** (no need to grant extra roles)
5. Click on the service account email
6. Go to **Keys > Add Key > Create new key > JSON**
7. Download the JSON key file — you'll need the contents for `.env`

### 4. Share the Spreadsheet

1. Create a new Google Spreadsheet (or use an existing one)
2. Copy the **Spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Share the spreadsheet with the service account email (found in the JSON key as `client_email`) as an **Editor**

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd Attendance
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 2. Configure environment

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3001
SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@...iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

Paste the entire JSON key file contents as a single line for `GOOGLE_SERVICE_ACCOUNT_KEY`.

### 3. Seed initial coach

Before you can log in, add at least one coach to the `coaches` sheet. You can do this manually in the Google Spreadsheet:

| id | name | email | pin | role |
|----|------|-------|-----|------|
| (any UUID) | Your Name | your@email.com | 1234 | head_coach |

Generate a UUID at https://www.uuidgenerator.net/ or use any unique string.

### 4. Run the dev server

```bash
npm run dev
```

This starts both the Express API (port 3001) and the Vite dev server (port 5173). Open http://localhost:5173.

## Deploy to Render

### 1. Create a Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New > Web Service**
3. Connect your Git repository

### 2. Configure the service

| Setting | Value |
|---------|-------|
| **Build Command** | `npm run render:build` |
| **Start Command** | `npm run render:start` |
| **Node Version** | 18+ (set via environment variable `NODE_VERSION=20`) |

### 3. Set environment variables

In the Render dashboard, add these environment variables:

| Key | Value |
|-----|-------|
| `PORT` | `10000` (Render's default) |
| `SPREADSHEET_ID` | Your Google Spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full JSON key file contents (single line) |
| `NODE_VERSION` | `20` |

### 4. Deploy

Render will automatically build and deploy. The app serves the React frontend as static files from the Express server, so a single service handles everything.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Google Sheets (via Sheets API v4)
- **Auth**: PIN-based coach login
