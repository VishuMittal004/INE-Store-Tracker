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

router.post('/trigger', authenticateCron, async (req, res) => {
    try {
        // Find products that need scraping based on their frequency
        // For simplicity right now, let's just trigger scraping for all tracked products
        const { data: products, error } = await supabase.from('tracked_products').select('id');

        if (error) throw error;

        // Start jobs sequentially in the background so we don't run out of RAM on the free tier!
        // (Free tier services require quick HTTP responses, so we don't await this block)
        (async () => {
            for (const p of products) {
                try {
                    await runScrapeJob(p.id);
                    // Add a 1 minute (60s) delay between products to prevent the mock store's anti-bot from rate-limiting us!
                    await new Promise(resolve => setTimeout(resolve, 180000));
                } catch (err) {
                    console.error("Error scraping product:", err);
                }
            }
        })();

        res.status(200).send('OK');
    } catch (e) {
        res.status(500).send('ERROR');
    }
});

module.exports = router;
