require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse json bodies and enable cors
app.use(express.json());
app.use(cors());

// A simple health check route to ensure the server is runing properely
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is up and running' });
});

// Import and use product routes
const productRoutes = require('./src/routes/productRoutes');
app.use('/api/products', productRoutes);

// Import and use tracking routes
const trackingRoutes = require('./src/routes/trackingRoutes');
app.use('/api/tracked-products', trackingRoutes);

// Import and use cron routes
const cronRoutes = require('./src/routes/cronRoutes');
app.use('/api/cron', cronRoutes);

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
