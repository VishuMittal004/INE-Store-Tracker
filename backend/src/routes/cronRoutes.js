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

        // --- THE FIX ---
        // Render's free tier violently throttles CPU to near zero if a web request finishes.
        // If we launch Playwright in the background AFTER returning a response, the server crashes (503).
        // By keeping the request OPEN and streaming the response, Render gives us 100% CPU.
        // We only stream tiny text chunks, completely preventing cron-job.org's "Output too large" error!
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.write('Scrape job initialized...\n');

        try {
            await killZombies();
            
            for (const p of products) {
                res.write(`Processing product ${p.id}...\n`);
                
                try {
                    await runScrapeJob(p.id);
                } catch (err) {
                    console.error("Error scraping product:", err);
                    res.write(`Error on product ${p.id}\n`);
                }

                // 15-second gap is enough to avoid rate limits without dragging out the total execution time
                await new Promise(resolve => setTimeout(resolve, 15000));
            }
        } finally {
            isScrapingRunning = false;
            clearTimeout(watchdog);
            await killZombies();
        }

        res.write('Job successfully completed.\n');
        res.end();
    } catch (e) {
        isScrapingRunning = false;
        if (!res.headersSent) {
            res.status(500).send('ERROR');
        } else {
            res.end('\nCRITICAL ERROR OCCURRED');
        }
    }
});

module.exports = router;
