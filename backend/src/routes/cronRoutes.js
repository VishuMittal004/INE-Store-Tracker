const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { runScrapeJob } = require('../services/scraperService');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function authenticateCron(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send('UNAUTHORIZED');
    }
    next();
}

async function killZombies() {
    try {
        await exec('pkill -f chrome || true');
        await exec('pkill -f chromium || true');
    } catch(e) { }
}

let isScrapingRunning = false;

router.post('/trigger', authenticateCron, async (req, res) => {
    try {
        if (isScrapingRunning) {
            console.log("Cron triggered, but a scrape job is already running. Ignoring.");
            return res.status(200).send('JOB_RUNNING_SKIPPED');
        }

        const { data: products, error } = await supabase.from('tracked_products').select('id');
        if (error) throw error;
        
        isScrapingRunning = true;

        const watchdog = setTimeout(() => {
            console.error("WATCHDOG TIMEOUT: Scrape job stuck (likely zombie browser). Auto-restarting server...");
            process.exit(1);
        }, 55 * 60 * 1000);

        // --- THE NEW FIX ---
        // We immediately return a 200 OK so cron-job.org doesn't time out at 30 seconds.
        res.status(200).send('Scraping job started in the background.');

        // Run the actual scraping in the background sequentially
        (async () => {
            try {
                await killZombies();
                
                for (const p of products) {
                    try {
                        await runScrapeJob(p.id);
                    } catch (err) {
                        console.error("Error scraping product:", err);
                    }
                    // Small cooldown to prevent rate limits
                    await new Promise(resolve => setTimeout(resolve, 15000));
                }
            } finally {
                isScrapingRunning = false;
                clearTimeout(watchdog);
                await killZombies();
            }
        })();

    } catch (e) {
        isScrapingRunning = false;
        res.status(500).send('ERROR');
    }
});

module.exports = router;
