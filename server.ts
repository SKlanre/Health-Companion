import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Paystack Integration
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

  // 1. Initialize Transaction
  app.post('/api/paystack/initialize', async (req, res) => {
    try {
      const { email, amount, metadata, currency } = req.body;
      
      const payload: any = {
        email,
        amount: Math.round(Number(amount) * 100), // Ensure it's a number and convert to cents/kobo
        metadata: JSON.stringify(metadata),
        callback_url: req.headers.origin || `${req.protocol}://${req.get('host')}/`
      };

      if (currency && currency !== 'NGN') {
        payload.currency = currency;
      }
      
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        payload,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('Paystack Initialize Error:', JSON.stringify(errorData || error.message, null, 2));
      res.status(error.response?.status || 500).json({ 
        error: 'Failed to initialize payment',
        details: errorData || error.message
      });
    }
  });

  // 2. Verify Transaction (Webhook or direct check)
  app.post('/api/paystack/verify/:reference', async (req, res) => {
    try {
      const { reference } = req.params;
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`
          }
        }
      );
      
      res.json(response.data);
    } catch (error: any) {
      console.error('Paystack Verify Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
