/**
 * DIRECTAURANTE — Customer & Commercial Express Routes (Fase 11)
 * RESTful API endpoints for Customers, Loyalty Programs, Promotions, and Coupons.
 */

import { Router, Request, Response } from 'express';
import { CustomerService } from './customerService';
import { LoyaltyService } from './loyaltyService';
import { PromotionService } from './promotionService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';
import { CustomerSegment } from '../../core/types';

export const customerRouter = Router();

// ==========================================
// CUSTOMERS
// ==========================================

customerRouter.get('/customers', (req: Request, res: Response) => {
  const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
  const search = req.query.search as string | undefined;
  const segment = req.query.segment as CustomerSegment | undefined;
  const customers = CustomerService.listCustomers(restaurantId, search, segment);
  res.json({ customers });
});

customerRouter.get('/customers/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const customer = CustomerService.getCustomer(req.params.id, restaurantId);
    res.json({ customer });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

customerRouter.post('/customers', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Recepción';
    const customer = CustomerService.createCustomer(req.body, restaurantId, actor);
    res.status(201).json({ success: true, customer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

customerRouter.patch('/customers/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const customer = CustomerService.updateCustomer(req.params.id, req.body, restaurantId, actor);
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

customerRouter.get('/customers/:id/summary', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const summary = CustomerService.getCustomerSummary(req.params.id, restaurantId);
    res.json(summary);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

customerRouter.get('/customers/:id/orders', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const orders = CustomerService.getCustomerOrders(req.params.id, restaurantId);
    res.json({ orders });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ==========================================
// LOYALTY & POINTS
// ==========================================

customerRouter.get('/loyalty/config', (req: Request, res: Response) => {
  const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
  const config = LoyaltyService.getProgramConfig(restaurantId);
  res.json({ config });
});

customerRouter.patch('/loyalty/config', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const config = LoyaltyService.updateProgramConfig(req.body, restaurantId, actor);
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

customerRouter.get('/loyalty/:customerId', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const account = LoyaltyService.getOrCreateAccount(req.params.customerId, restaurantId);
    res.json({ account });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

customerRouter.get('/loyalty/:customerId/transactions', (req: Request, res: Response) => {
  const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
  const transactions = LoyaltyService.getTransactions(req.params.customerId, restaurantId);
  res.json({ transactions });
});

customerRouter.post('/loyalty/:customerId/redeem', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Cajero';
    const { points, reference } = req.body;
    const result = LoyaltyService.redeemPoints(req.params.customerId, Number(points), reference || 'Canje POS', restaurantId, actor);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

customerRouter.post('/loyalty/:customerId/adjust', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Gerente';
    const { points, reason } = req.body;
    const result = LoyaltyService.adjustPoints(req.params.customerId, Number(points), reason, actor, restaurantId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// PROMOTIONS
// ==========================================

customerRouter.get('/promotions', (req: Request, res: Response) => {
  const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
  const promotions = PromotionService.listPromotions(restaurantId);
  res.json({ promotions });
});

customerRouter.get('/promotions/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const promotion = PromotionService.getPromotion(req.params.id, restaurantId);
    res.json({ promotion });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

customerRouter.post('/promotions', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Gerencia Comercial';
    const promotion = PromotionService.createPromotion(req.body, restaurantId, actor);
    res.status(201).json({ success: true, promotion });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

customerRouter.patch('/promotions/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Gerencia Comercial';
    const promotion = PromotionService.updatePromotion(req.params.id, req.body, restaurantId, actor);
    res.json({ success: true, promotion });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// COUPONS
// ==========================================

customerRouter.get('/coupons', (req: Request, res: Response) => {
  const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
  const coupons = PromotionService.listCoupons(restaurantId);
  res.json({ coupons });
});

customerRouter.post('/coupons', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const coupon = PromotionService.createCoupon(req.body, restaurantId, actor);
    res.status(201).json({ success: true, coupon });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

customerRouter.post('/coupons/validate', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const { code, promotion_id, order_subtotal_cents, items, customer_id } = req.body;
    const evaluation = PromotionService.evaluatePromotion(
      { coupon_code: code, promotion_id },
      { subtotal_cents: Number(order_subtotal_cents) || 0, items },
      customer_id,
      restaurantId
    );
    res.json(evaluation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

customerRouter.post('/coupons/redeem', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.body.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Cajero';
    const { code, order_id, customer_id, discount_cents } = req.body;
    const redemption = PromotionService.redeemCoupon(
      code,
      order_id,
      customer_id,
      Number(discount_cents) || 0,
      restaurantId,
      actor
    );
    res.json({ success: true, redemption });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// COMMERCIAL REPORTS
// ==========================================

customerRouter.get('/commercial/report', (req: Request, res: Response) => {
  const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
  const report = PromotionService.getCommercialReport(restaurantId);
  res.json({ report });
});
