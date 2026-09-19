const { createClient } = require('@supabase/supabase-js');
const { launchBrowser } = require('../scraper/browser');
const { scrapeProduct } = require('../scraper/productScraper');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runScrapeJob(productId) {
    // 1. Fetch the product URL
    const { data: product, error: fetchError } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('id', productId)
        .single();

    if (fetchError || !product) {
        console.error("Product not found:", fetchError);
        return;
    }

    console.log(`Starting scrape job for ${product.name}...`);
    
    // We launch one browser for the entire sequence
    const browser = await launchBrowser();
    let attempt = 1;
    const maxAttempts = 5;
    let finalSuccess = false;

    try {
        while (attempt <= maxAttempts) {
            console.log(`[Job Attempt ${attempt}/${maxAttempts}] Scraping ${product.product_url}`);
            
            const page = await browser.newPage();
            const result = await scrapeProduct(page, product.product_url);
            await page.close();

            // Record the exact outcome in the database
            const outcomeStatus = result.success ? 'success' : (attempt < maxAttempts ? 'retried' : 'failed');
            
            const logEntry = {
                tracked_product_id: product.id,
                status: outcomeStatus,
                attempt_number: attempt,
                message: result.error || 'Extracted successfully',
                http_code: 200
            };
            
            // Note: If you added price_recorded to schema.sql, you can uncomment this
            // if (result.data && result.data.price !== null) logEntry.price_recorded = result.data.price;

            const { error: logError } = await supabase.from('scrape_logs').insert([logEntry]);
            if (logError) console.error("Failed to insert scrape_log:", logError);

            if (result.success) {
                // Check previous history for alerts
                const { data: previousHistories } = await supabase
                    .from('price_history')
                    .select('price, stock')
                    .eq('tracked_product_id', product.id)
                    .order('scraped_at', { ascending: false })
                    .limit(1);

                const previous = previousHistories && previousHistories.length > 0 ? previousHistories[0] : null;

                // We succeeded! Update price history and tracked product.
                const { error: historyError } = await supabase.from('price_history').insert([{
                    tracked_product_id: product.id,
                    price: result.data.price,
                    stock: result.data.stock
                }]);
                
                await supabase.from('tracked_products').update({
                    current_price: result.data.price,
                    current_stock: result.data.stock,
                    last_scraped_at: new Date().toISOString()
                }).eq('id', product.id);

                // --- ALERTS LOGIC (M10) ---
                if (previous) {
                    let alertType = null;
                    let alertMessage = null;

                    if (result.data.price < previous.price) {
                        alertType = 'price_drop';
                        alertMessage = `Price dropped for ${product.name} from ₹${previous.price} to ₹${result.data.price}!`;
                    } else if (result.data.stock === true && previous.stock === false) {
                        alertType = 'back_in_stock';
                        alertMessage = `${product.name} is back in stock!`;
                    }

                    if (alertType) {
                        // 1. Insert In-App Alert (Using the existing table schema)
                        await supabase.from('alerts').insert([{
                            product_id: product.id,
                            type: alertType,
                            message: alertMessage,
                            status: 'pending' // instead of is_read
                        }]);

                        // 2. SendGrid Email Alert
                        if (process.env.SENDGRID_API_KEY && process.env.ALERT_EMAIL) {
                            try {
                                const sgMail = require('@sendgrid/mail');
                                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                                const msg = {
                                    to: process.env.ALERT_EMAIL,
                                    from: process.env.ALERT_EMAIL, // Usually needs to be a verified sender
                                    subject: `INE Tracker Alert: ${alertType === 'price_drop' ? 'Price Drop!' : 'Back In Stock!'}`,
                                    text: alertMessage,
                                    html: `<strong>${alertMessage}</strong>`,
                                };
                                await sgMail.send(msg);
                                console.log(`Sent SendGrid email alert to ${process.env.ALERT_EMAIL}`);
                            } catch (err) {
                                console.error('Error sending SendGrid email:', err);
                            }
                        }
                    }
                }

                console.log("\n=========================");
                console.log("  EXTRACTION SUCCESS!  ");
                console.log("=========================");
                console.log(result.data);
                console.log("=========================\n");

                finalSuccess = true;
                break; // Break the retry loop
            } else if (attempt < maxAttempts) {
                // If we failed but have retries left, wait 15 seconds before trying again!
                // This prevents us from instantly hammering the exact same page and getting permanently blocked by the anti-bot.
                console.log(`Waiting 30 seconds before attempt ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
            
            attempt++;
        }
    } catch (e) {
        console.error("Job crashed:", e);
    } finally {
        await browser.close();
    }
    
    if (finalSuccess) {
        console.log(`Job for ${product.name} finished successfully.`);
    } else {
        console.log(`Job for ${product.name} exhausted all retries and FAILED.`);
    }
}

module.exports = {
    runScrapeJob
};
