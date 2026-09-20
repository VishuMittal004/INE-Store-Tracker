# Design Note — INE Store Tracker

## 1. Purpose

This design note explains the engineering choices behind the INE Store Tracker, with particular focus on scraping reliability, operational trade-offs, and the changes made after the first AI-assisted implementation.

The final system is deliberately simple in its data model and deployment footprint, while using a real browser for the parts of the target site that depend on user interaction and dynamic DOM behaviour.

---

## 2. Scraping Reliability

The biggest reliability problem is that the price is not treated as a static value that can simply be read from the initial HTML.

The scraper therefore models the page as a sequence of states:

```text
Page loaded
    |
    v
Cookie overlay handled
    |
    v
Price block located
    |
    v
Mouse interaction performed
    |
    v
Reveal control becomes usable
    |
    v
Price appears in DOM
    |
    v
Price parsed and normalized
```

### 2.1 Cookie handling

A cookie-consent overlay can sit on top of the page and prevent the scraper from interacting with the actual product controls.

The scraper therefore waits for the consent element and accepts it when it is present.

**Why this improves reliability:**  
A scraper that assumes the page is immediately interactive can fail even when all its selectors are correct.

---

### 2.2 Human-like mouse movement

The target page expects a hover interaction around the price block before the price can be revealed.

Instead of immediately forcing a click, the scraper:

1. locates `.price-block`
2. obtains its position
3. moves the playwright mouse toward that position
4. allows the page's hover behaviour to activate
5. interacts with the reveal control

**Why this improves reliability:**  
The scraper follows the interaction model used by the page rather than assuming that the hidden price is available through a normal click.

**Trade-off:**  
Mouse movement adds complexity and a little execution time, but it is more dependable for this specific page behaviour.

---

### 2.3 Condition-based waiting instead of arbitrary delays

A common scraping mistake is:

```text
open page
wait 2000 ms
click
wait 1000 ms
read price
```

Fixed delays are fragile because page load time can change with network speed, server response time, CPU load, or browser startup time.

The final implementation instead waits for a meaningful condition: the price element contains the expected price state, including the `₹` marker.

Conceptually:

```text
wait until:
    price element exists
    AND
    price text contains expected currency state
```

**Why this improves reliability:**  
The scraper waits for the page state it actually needs instead of guessing how many milliseconds the page will require.

**Trade-off:**  
Condition-based waits make the scraper slightly more complex and require selectors/conditions that remain valid when the page changes.

---

### 2.4 One browser instance per scraping job

The service launches one playwright browser and reuses it while processing the tracked products sequentially.

```text
runScrapeJob()
    |
    +--> launch browser once
    |
    +--> scrape product A
    +--> scrape product B
    +--> scrape product C
    |
    +--> close browser
```

**Why this choice was made:**  
Chromium consumes significantly more memory than a normal HTTP request. Reusing one browser avoids the overhead of repeatedly starting separate browser processes.

**Trade-off:**  
Products are scraped sequentially rather than fully in parallel. A slow product can therefore delay the remaining products, but the memory footprint is more controlled and the implementation is easier to reason about.

---

### 2.5 Failure containment

The scraper service is separated from the API layer.

This gives the project a useful boundary:

```text
HTTP/API layer
      |
      v
scraperService
      |
      v
productScraper
      |
      v
playwright
```

This separation makes it easier to debug whether a failure came from:

- an API request
- database access
- orchestration logic
- browser startup
- page interaction
- price parsing

---

## 3. Scheduling Design

The scheduler currently uses `node-cron` with a one-minute interval.

The current backend exposes:

```text
POST /api/cron/start
```

which starts the cron loop. Once started, it invokes the scraping service every 60 seconds.

### Why one minute?

A one-minute interval makes the demo behaviour easy to observe and clearly demonstrates autonomous monitoring.

### Trade-off

A shorter interval gives fresher prices but also increases:

- browser launches
- network traffic
- CPU usage
- memory pressure
- load on the target site

A production system would normally choose a schedule based on the required freshness, site constraints, and infrastructure budget rather than blindly polling every minute.

---

## 4. Data Consistency Strategy

For every tracked product, the scraping service compares:

```text
new scraped price
        vs.
last stored price
```

A price-drop alert is created only when:

```text
new price < previous price
```

After the comparison, the latest price and its timestamp are stored.

This makes the database the persistent source of truth for the latest known price.

---

## 5. Technology Trade-offs

### playwright instead of a simple HTTP client

**Chosen:** playwright / Chromium

**Reason:** The page requires browser interaction, including hover-driven behaviour and dynamic DOM changes.

**Trade-off:** Much heavier than fetching HTML with `fetch`/Axios alone.

---

### Sequential scraping instead of parallel scraping

**Chosen:** Sequential processing in one browser.

**Reason:** Lower memory pressure and simpler execution flow.

**Trade-off:** Total scrape duration grows with the number of tracked products.

---

### React/Vite frontend instead of a server-rendered UI

**Chosen:** React with Vite.

**Reason:** Clear separation between the frontend and REST backend, easy local development, and a natural fit for interactive product/alert state.

**Trade-off:** The application has an additional frontend build/runtime layer compared with a single server-rendered application.

---

## 6. What the AI-Assisted First Attempt Got Wrong

The first implementation pattern was too optimistic about how predictable the target page would be.

The important corrections were:

### Problem 1 — Assuming a direct click was enough

The initial approach treated the reveal control like a normal button.

**Why it failed:**  
The target interaction depended on the price area's hover behaviour before the control became usable.

**Correction:**  
The final scraper explicitly moves the mouse over the price block before clicking the reveal control.

---

### Problem 2 — Relying on fixed sleep durations

The first approach used timing assumptions such as:

```text
wait a fixed number of milliseconds
then click/read
```

**Why it failed:**  
A fixed delay does not guarantee that the required DOM state has actually appeared.

**Correction:**  
The final implementation uses selector-based interaction and a `waitForFunction`-style DOM condition so that the scraper waits for the actual price state.

---

### Problem 3 — Ignoring page-level blockers

The initial scraping flow could attempt interaction before the cookie-consent overlay had been handled.

**Why it failed:**  
An overlay can intercept mouse events and make a valid selector appear unusable.

**Correction:**  
The scraper detects the cookie-consent overlay and accepts it before continuing with product interaction.

---

### Problem 4 — Treating every product as a separate browser session

A naive browser-automation implementation can launch a new browser for each product.

**Why it was undesirable:**  
Chromium startup and memory usage are expensive, especially on constrained hosting environments.

**Correction:**  
`runScrapeJob()` launches one browser, reuses it for the tracked products, and closes it after the job completes.

---

## 7. AI Tool Usage and Human Validation

AI coding tools were useful for accelerating:

- initial scraper structure
- API scaffolding
- selector-based browser interaction
- debugging
- documentation
- frontend/backend integration

However, generated code was not treated as automatically correct.

The final workflow was:

```text
AI-generated implementation
        |
        v
Run against real page
        |
        v
Observe failure / unexpected behaviour
        |
        v
Identify actual page requirement
        |
        v
Change implementation
        |
        v
Test again
        |
        v
Keep only validated behaviour
```

The key lesson is that browser automation is especially sensitive to assumptions about timing and interaction. Code that looks correct syntactically can still be wrong when executed against the real page.

---

## 8. Remaining Trade-offs / Limitations

The current implementation is designed for the assignment/demo rather than as a fully distributed production scraper.

Known trade-offs include:

1. **Chromium is resource-heavy.**  
   Browser automation costs more memory and CPU than direct HTTP scraping.

2. **The scraper depends on DOM selectors.**  
   A redesign of the demo store's HTML/CSS can require selector updates.

3. **One-minute polling is aggressive for a generic production system.**  
   It is useful for demonstrating the assignment but would need to be tuned for real-world use.

4. **Sequential processing limits throughput.**  
   It reduces memory pressure, but many tracked products would increase the duration of each run.

---

## 9. Final Design Summary

The final architecture prioritizes dependable page interaction over the absolute smallest amount of code.

The most important reliability decisions are:

```text
Handle blockers
    +
Use the page's real interaction sequence
    +
Wait for DOM state rather than guessing timing
    +
Reuse one browser per scraping job
    +
Keep scraping logic separate from API logic
```

That combination makes the scraper substantially less fragile than a simple "open → sleep → click → parse" implementation while keeping the system small enough to understand and run locally.
