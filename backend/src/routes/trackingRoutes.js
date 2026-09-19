const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');

// GET /api/tracked-products
router.get('/', trackingController.getTrackedProducts);

// POST /api/tracked-products
router.post('/', trackingController.trackProduct);

// GET /api/alerts (wait, this isn't specific to a product, but let's put it here or in a separate file. For simplicity, just add to this router, though the path /api/tracked-products/alerts might conflict if 'alerts' is treated as an ID, so we should put it before the /:id routes)
router.get('/alerts', trackingController.getAlerts);

// POST /api/alerts/:id/read (same here)
router.post('/alerts/:id/read', trackingController.markAlertRead);

// DELETE /api/tracked-products/:id
router.delete('/:id', trackingController.untrackProduct);

// GET /api/tracked-products/:id/history
router.get('/:id/history', trackingController.getProductHistory);

// GET /api/tracked-products/:id/logs
router.get('/:id/logs', trackingController.getProductLogs);

module.exports = router;
