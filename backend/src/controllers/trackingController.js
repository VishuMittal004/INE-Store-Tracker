const supabase = require('../config/supabase');

// Get all tracked pdts for the dashboard
async function getTrackedProducts(req, res) {
    try {
        const { data, error } = await supabase
            .from('tracked_products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching tracked products:', error);
        res.status(500).json({ error: 'Failed to fetch tracked products' });
    }
}

// Start tracking a new pdt
async function trackProduct(req, res) {
    try {
        const { external_product_id, name, product_url, image_url } = req.body;

        if (!external_product_id || !name || !product_url) {
            return res.status(400).json({ error: 'Missing requried fields' });
        }

        // Check if it already exists to avoid duplicates
        const { data: existing } = await supabase
            .from('tracked_products')
            .select('id')
            .eq('external_product_id', external_product_id)
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Product is already being tracked' });
        }

        const { data, error } = await supabase
            .from('tracked_products')
            .insert([{
                external_product_id,
                name,
                product_url,
                image_url,
                scrape_frequency_minutes: 120 // Default 2 hours
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error tracking product:', error);
        res.status(500).json({ error: 'Failed to start tracking product' });
    }
}

// Stop tracking a pdt
async function untrackProduct(req, res) {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('tracked_products')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error stopping tracking:', error);
        res.status(500).json({ error: 'Failed to stop tracking' });
    }
}

async function getProductHistory(req, res) {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('price_history')
            .select('*')
            .eq('tracked_product_id', id)
            .order('scraped_at', { ascending: true }); // chronological

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching product history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
}

async function getProductLogs(req, res) {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('scrape_logs')
            .select('*')
            .eq('tracked_product_id', id)
            .order('started_at', { ascending: false }) // most recent first
            .limit(50); // limit to last 50 for ui performance

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching product logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
}

async function getAlerts(req, res) {
    try {
        const { data, error } = await supabase
            .from('alerts')
            .select(`
                *,
                tracked_products:product_id (name, image_url)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
}

async function markAlertRead(req, res) {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('alerts')
            .update({ status: 'read' })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking alert read:', error);
        res.status(500).json({ error: 'Failed to mark alert as read' });
    }
}

module.exports = {
    getTrackedProducts,
    trackProduct,
    untrackProduct,
    getProductHistory,
    getProductLogs,
    getAlerts,
    markAlertRead
};
