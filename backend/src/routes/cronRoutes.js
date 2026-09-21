const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { runScrapeJob } = require('../services/scraperService');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to authenticate cron requests using a secret header
function authenticateCron(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send('UNAUTHORIZED');
    }
    next();
}

let isScrapingRunning = false;

router.post('/trigger', authenticateCron, async (req, res) => {
    try {
        if (isScrapingRunning) {
            console.log("Cron triggered, but a scrape job is already running. Ignoring.");
            return res.status(409).send('JOB_RUNNING');
        }

        // Find products that need scraping based on their frequency
        // For simplicity right now, let's just trigger scraping for all tracked products
        const { data: products, error } = await supabase.from('tracked_products').select('id');

        if (error) throw error;
        
        console.log("SCRAPER VERSION: 2026-09-20-FIX-1");
        
        isScrapingRunning = true;

        // --- WATCHDOG SYSTEM ---
        // If Playwright spawns a Zombie Chromium process that hangs silently, 
        // the loop will get stuck forever. If this takes longer than 25 minutes, 
        // we forcefully crash the server. Render will instantly auto-restart it, 
        // completely clearing RAM and zombie processes without any manual intervention!
        const watchdog = setTimeout(() => {
            console.error("WATCHDOG TIMEOUT: Scrape job stuck (likely zombie browser). Auto-restarting server...");
            process.exit(1);
        }, 25 * 60 * 1000);

        // Start jobs sequentially in the background so we don't run out of RAM on the free tier!
        // (Free tier services require quick HTTP responses, so we don't await this block)
        (async () => {
            try {
                for (const p of products) {
                    try {
                        await runScrapeJob(p.id);
                        // Keep a 1-minute gap between products to avoid sending requests too quickly.
                        await new Promise(resolve => setTimeout(resolve, 60000));
                    } catch (err) {
                        console.error("Error scraping product:", err);
                    }
                }
            } finally {
                isScrapingRunning = false;
                clearTimeout(watchdog);
            }
        })();

        res.status(200).send('OK');
    } catch (e) {
        res.status(500).send('ERROR');
    }
});

module.exports = router;
