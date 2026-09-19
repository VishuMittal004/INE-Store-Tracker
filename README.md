# INE Store Tracker

A full-stack application built to track products on the INE mock store, log their prices and stock availability over time, and alert users via SendGrid when significant price drops occur or out-of-stock items return.

## Tech Stack
- **Frontend:** React, Vite, Recharts (for history graphs)
- **Backend:** Node.js, Express, Playwright (for dynamic scraping)
- **Database:** Supabase (PostgreSQL)

---

## Local Setup

### 1. Database Setup
Create a new project on [Supabase](https://supabase.com). Go to the SQL Editor and run the schema found in `backend/database/schema.sql` to initialize your tables.

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies (this will also download the Playwright browsers):
   ```bash
   npm install
   npx playwright install chromium --with-deps
   ```
3. Create a `.env` file in the `backend` folder and populate it with your keys:
   ```env
   PORT=3000
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   CRON_SECRET=a_secure_random_string_for_cron
   SENDGRID_API_KEY=your_sendgrid_api_key
   ALERT_EMAIL=your_email_address_for_alerts
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local host URL in your browser (usually `http://localhost:5173`).

---

## Production Deployment (Vercel & Render)

### 1. Deploying the Backend to Render
The backend uses Playwright, which requires an environment that can run a headless Chromium browser. The easiest way to deploy this without Docker is using a standard Render Web Service.

1. Create an account on [Render](https://render.com) and link your GitHub.
2. We have included a `render.yaml` infrastructure-as-code file. Simply create a new **Blueprint Instance** in Render and select your repository.
3. Render will automatically detect the Web Service and Cron Job defined in `render.yaml`.
4. Go to the Environment tab of your newly created Web Service and add all the variables from your local `.env` file (`SUPABASE_URL`, `CRON_SECRET`, etc.).
5. The deployment will run `npm run build` which we configured to securely install Playwright dependencies.

*Note: The `render.yaml` sets up a Cron Job on Render that pings your API every 30 minutes to trigger the scraper.*

### 2. Deploying the Frontend to Vercel
1. Create an account on [Vercel](https://vercel.com) and link your GitHub.
2. Click **Add New Project** and select your repository.
3. Vercel will automatically detect that it's a Vite React app.
4. Set the **Root Directory** to `frontend`.
5. Under **Environment Variables**, add:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://your-render-backend-url.onrender.com` *(Replace this with the actual URL from Render)*
6. Click **Deploy**.

## Testing the Scraper manually
You can trigger the scraper at any time by making a POST request to your backend:
```bash
curl -X POST http://localhost:3000/api/cron/process -H "Authorization: Bearer your_cron_secret"
```
