// /api/order.js  — Serverless on Vercel
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });

  const { symbol, side, type = 'MARKET', quoteOrderQty } = req.body || {};
  if (!symbol || !side || !quoteOrderQty) {
    return res.status(400).json({ error: 'Missing symbol/side/quoteOrderQty' });
  }

  const API_KEY = process.env.BINANCE_API_KEY;
  const API_SECRET = process.env.BINANCE_API_SECRET;
  const BASE = process.env.BINANCE_BASE_URL || 'https://api.binance.com'; // ضع testnet إن أردت

  if (!API_KEY || !API_SECRET) {
    return res.status(500).json({ error: 'Missing API keys in env' });
  }

  try {
    const qs = new URLSearchParams({
      symbol,
      side,                 // BUY / SELL
      type,                 // MARKET
      quoteOrderQty,        // حجم USDT
      timestamp: Date.now().toString(),
      recvWindow: '5000',
    }).toString();

    const signature = crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex');
    const url = ${BASE}/api/v3/order?${qs}&signature=${signature};

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': API_KEY }
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);
    return res.status(200).json(j);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
