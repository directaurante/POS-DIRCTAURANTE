/**
 * DIRECTAURANTE POS CORE — Full-Stack Server
 * Express backend running REST API and mounting Vite dev middleware on port 3000.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/modules/pos/posRoutes';
import { customerRouter } from './src/modules/customer/customerRoutes';
import { FinancialService } from './src/modules/finance/financialService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // CORS headers for preview safety
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Mount API routers
  app.use('/api', apiRouter);
  app.use('/api', customerRouter);

  // Financial API extensions
  app.post('/api/pos/tables/:id/pay-idempotent', (req, res) => {
    try {
      const { amount_cents, method, guest_subaccount_id, cashier, reference } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      const payment = FinancialService.recordPayment(
        req.params.id,
        Number(amount_cents),
        method,
        guest_subaccount_id,
        cashier || 'Cajero',
        reference,
        idempotencyKey
      );

      const updatedBill = FinancialService.calculateTableBill(req.params.id);
      res.json({ success: true, payment, updated_bill: updatedBill });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Directaurante POS Server] Operational at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Directaurante POS Server] Startup failed:', err);
  process.exit(1);
});
