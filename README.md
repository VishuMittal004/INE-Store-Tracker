# INE Store Tracker

A full-stack price-tracking application for the simulated INE Demo Store. The system lets a user search for products, start tracking a product, periodically scrape its current price, detect price drops, and surface alerts in the web application.

## Assignment Coverage

This repository documentation is structured to cover the assignment requirements:

- setup and local-run instructions
- scraping schedule and how the scheduler is started
- environment variables required by the project
- a separate design note covering scraping reliability, engineering trade-offs, and corrections made after the first AI-assisted implementation

---

## 1. What the Project Does

The application has three main parts:

1. **Scraper Engine — playwright / Node.js**  
   Opens product pages in Chromium, handles the cookie overlay, performs the required hover interaction, reveals the price, waits for the price to appear in the DOM, and parses the numeric value.

2. **Backend API — Express.js / SQLite**  
   Exposes REST endpoints for product tracking and alerts, persists tracked products and their latest prices, and runs the scheduled scraping job.

3. **Frontend — React / Vite / PWA**  
   Provides the user interface for searching products, viewing tracked products, and seeing price-drop notifications.

### High-level flow

```text
User
  |
  v
React / Vite Frontend
  |
  | HTTP requests
  v
Express Backend
  |
  +--------------------+
  |                    |
  v                    v
SQLite Database     node-cron
                       |
                       v
                 Scrape Job
                       |
                       v
               playwright / Chrome
                       |
                       v
                INE Demo Store
```

---

## 2. Prerequisites

Install the following before running the project:

- Node.js and npm
- A working Chromium/Chrome runtime supported by playwright
- Git, if cloning the repository

The backend uses playwright to launch a browser, so the environment running the backend must be able to start Chromium.

---

## 3. Project Structure

The important application directories are:

```text
/
├── backend/
│   ├── server.js
│   ├── .env
│   ├── database/
│   │   └── database.sqlite
│   └── src/
│       ├── scraper/
│       │   ├── browser.js
│       │   └── productScraper.js
│       ├── services/
│       │   └── scraperService.js
│       ├── routes/
│       │   ├── cronRoutes.js
│       │   ├── productRoutes.js
│       │   └── alertRoutes.js
│       └── controllers/
│           ├── productController.js
│           └── alertController.js
│
└── frontend/
    ├── index.html
    ├── public/
    │   └── manifest.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── App.css
        ├── index.css
        ├── components/
        │   ├── SearchProduct.jsx
        │   └── ProductDashboardModal.jsx
        └── services/
            └── api.js
```

---

## 4. Backend Setup

Open a terminal in the backend directory:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory.

### Environment variables

The current project documentation identifies these backend environment variables:

```env
PORT=5000
SENDGRID_API_KEY=your_sendgrid_api_key
```

### Variable reference

| Variable | Purpose | Example / Default |
|---|---|---|
| `PORT` | Port used by the Express server | `5000` |
| `SENDGRID_API_KEY` | API key for SendGrid-based functionality, where enabled | `your_sendgrid_api_key` |

### Important

Do **not** commit real API keys to Git.

Use a local `.env` file for secrets. In deployment, configure the same variables through the hosting provider's environment-variable settings.

The frontend API layer centralizes the backend URL in `src/services/api.js`, so when deploying the frontend, make sure its API base URL points to the deployed backend rather than `localhost`.

---

## 5. Start the Backend

From `backend/`:

```bash
npm start
```

or use the start script defined in the project's `package.json`.

The backend listens on:

```text
http://localhost:5000
```

unless `PORT` is changed.

---

## 6. Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will print the local frontend URL in the terminal.

Open that URL in a browser.

---

## 7. Scraping Schedule

The scraping scheduler is implemented with `node-cron`.

### Current schedule

Once the scheduler is started, the scraper job runs:

```text
Every 1 minute
```

The current implementation exposes an HTTP endpoint:

```text
POST /api/cron/start
```

This endpoint starts the cron loop. After it has been started, `node-cron` calls the scraping service every 60 seconds.

### What happens on each run

```text
Every 60 seconds
      |
      v
runScrapeJob()
      |
      v
Read all tracked products from SQLite
      |
      v
Launch one playwright browser
      |
      v
Scrape products sequentially
      |
      +---- price decreased ---> create alert
      |
      +---- otherwise ---------> no price-drop alert
      |
      v
Update latest price + timestamp
      |
      v
Close browser
```

The one-browser/sequential approach reduces the memory overhead that would come from launching a new Chromium process for every tracked product.

### Starting the scheduler

After the backend is running, trigger:

```text
POST http://localhost:5000/api/cron/start
```

Use Postman, curl, or another HTTP client.

Example:

```bash
curl -X POST http://localhost:5000/api/cron/start
```

---

## 8. Scraping Reliability

The product pages contain dynamic behaviour, so the scraper does more than simply request HTML and read a price.

### Cookie overlay handling

The scraper waits for the cookie-consent overlay:

```text
#cookie-consent-overlay
```

and accepts the cookies when the banner is present.

This matters because an overlay can block the underlying controls and cause otherwise-correct selectors to fail.

### Hover interaction

The price is not immediately available through a normal click sequence. The scraper identifies the `.price-block`, calculates its coordinates, and moves the mouse toward it before attempting to reveal the price.

This mirrors the interaction expected by the target page more closely than an instantaneous programmatic click.

### Dynamic DOM waiting

Instead of depending only on a fixed sleep, the scraper actively waits for the price to become available.

The implementation uses a DOM condition to wait until the price element contains the expected currency marker (`₹`).

This makes the scraper less dependent on one machine's timing.

### Price parsing

After extraction, the scraper:

1. reads the price text
2. removes the currency symbol
3. removes formatting/thousands separators
4. converts the remaining value into a numeric price

The normalized price can then be compared safely with the previous stored value.

---

## 9. Database

The backend uses SQLite.

### `products`

Stores information such as:

- product URL
- product/SKU identifier
- product name
- latest known price
- timestamp associated with the price update

### `alerts`

Stores:

- price-drop notification text
- read/unread state

SQLite was selected because the assignment is a compact tracking application and a file-based SQL database keeps local setup simple.

---

## 10. API Responsibilities

### Products

The product routes support the main tracking operations:

```text
GET    /api/products
POST   /api/products
DELETE /api/products
```

The search functionality is exposed through the product search endpoint used by the frontend.

### Alerts

The alert routes support operations such as:

```text
GET   /api/alerts
POST  /api/alerts
```

They are used to retrieve unread notifications and update their read/dismissed state.

### Cron

```text
POST /api/cron/start
```

starts the scheduled scraping loop.

---

## 11. Frontend Behaviour

The React frontend:

- searches for products
- allows a product to be tracked
- displays tracked products
- shows price-drop notifications
- allows alerts to be dismissed

The frontend API calls are centralized in:

```text
frontend/src/services/api.js
```

This keeps HTTP communication separate from UI components.

The application is also configured as a PWA, allowing supported mobile browsers to install it as a home-screen application.

---

## 12. End-to-End Example

Suppose the user searches for **Ironwood Kettle**.

```text
1. User searches for "Ironwood Kettle"
2. React calls the backend search endpoint
3. Backend returns matching products
4. User selects "Track Price"
5. Product URL and identifying information are stored in SQLite
6. The cron scheduler runs
7. playwright opens the product page
8. Cookie consent is handled
9. Mouse moves over the price block
10. Reveal-price interaction is triggered
11. DOM is polled until the actual price is present
12. Price is parsed into a number
13. New price is compared with the stored price
14. If the price decreased, an alert is created
15. The latest price and timestamp are saved
16. The frontend displays the alert
```

---

## 13. Deployment Notes

### Backend

The backend can be deployed on a server platform that supports Node.js and can run playwright/Chromium.

Because headless Chromium is memory-intensive, the browser is launched with resource-oriented flags such as:

```text
--disable-dev-shm-usage
--disable-gpu
--no-sandbox
```

The scraper also uses one browser instance for the job rather than starting a separate browser for every product.

### Frontend

The React/Vite frontend can be built with:

```bash
npm run build
```

The generated static frontend can then be deployed to a static hosting service.

Make sure the API layer points to the production backend URL.

---

## 14. Troubleshooting

### Browser fails to launch

Check that the deployment environment can run playwright/Chromium and that the required system resources are available.

### Scraper cannot reveal the price

Check:

- cookie handling
- `.price-block` selector
- reveal button selector
- DOM condition used for waiting
- whether the target page behaviour has changed

### Frontend cannot reach backend

Check:

- backend is running
- backend port
- CORS configuration
- frontend API base URL
- deployed backend URL, rather than `localhost`

### Scheduler is not running

Remember that the current implementation starts the cron loop through:

```text
POST /api/cron/start
```

Starting the backend process and starting the scheduler are separate operations in the current design.

---

## 15. Design Rationale

The application intentionally favours reliability and clear separation of concerns:

- playwright handles browser-level interaction.
- `scraperService.js` orchestrates scraping and database updates.
- Express routes/controllers handle HTTP operations.
- SQLite provides persistent local storage.
- React manages the user interface.
- `api.js` centralizes frontend/backend communication.

For the reliability rationale, trade-offs, and the AI-assisted development corrections, see:

**`DESIGN_NOTE.md`**
