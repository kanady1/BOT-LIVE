// /api/futures-order.js  — Binance USDT-M Futures (Vercel Function)
import crypto from 'crypto';

// توقيع طلبات Binance
function sign(query, secret) {
  return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

// استدعاء Binance موقّع
async function binanceSigned(path, params, key, secret, base, method='GET') {
  const qs = new URLSearchParams({ ...params, timestamp: Date.now().toString(), recvWindow: '5000' }).toString();
  const signature = sign(qs, secret);
  const url = ${base}${path}?${qs}&signature=${signature};
  const r = await fetch(url, { method, headers: { 'X-MBX-APIKEY': key }});
  const j = await r.json();
  if (!r.ok) throw new Error(j.msg || JSON.stringify(j));
  return j;
}

// استدعاء عام (غير موقّع)
async function binancePublic(path, params, base) {
  const qs = params ? ?${new URLSearchParams(params).toString()} : '';
  const url = ${base}${path}${qs};
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j.msg || JSON.stringify(j));
  return j;
}

// تقريب الكمية حسب stepSize
function roundStep(qty, step) {
  const p = Math.round(Math.log10(1/step));
  return Math.floor(qty * Math.pow(10, p)) / Math.pow(10, p);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  try {
    const {
      symbol,
      side,
      usdtAmount,
      leverage = 10,
      reduceOnly = false,
      positionSide = 'BOTH',
      type = 'MARKET',
    } = req.body || {};

    if (!symbol || !side || !usdtAmount) {
      return res.status(400).json({ error: 'symbol/side/usdtAmount are required' });
    }

    const API_KEY   = process.env.BINANCE_API_KEY;
    const API_SECRET= process.env.BINANCE_API_SECRET;
    const BASE      = process.env.BINANCE_FAPI_BASE || 'https://fapi.binance.com';

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Missing API keys in env' });
    }

    // Exchange info
    const info = await binancePublic('/fapi/v1/exchangeInfo', null, BASE);
    const s = info.symbols.find(x => x.symbol === symbol);
    if (!s) throw new Error('Symbol not found in exchangeInfo');

    const lotFilter = s.filters.find(f => f.filterType === 'LOT_SIZE');
    const stepSize  = lotFilter ? Number(lotFilter.stepSize) : 0.001;

    // Last price
    const priceObj = await binancePublic('/fapi/v1/ticker/price', { symbol }, BASE);
    const lastPrice = Number(priceObj.price);

    // Set leverage
    await binanceSigned('/fapi/v1/leverage', { symbol, leverage: Number(leverage) }, API_KEY, API_SECRET, BASE, 'POST');

    // Calculate qty: (usdt * leverage) / price
    let qty = (Number(usdtAmount) * Number(leverage)) / lastPrice;
    qty = roundStep(qty, stepSize);
    if (qty <= 0) throw new Error('Calculated qty is zero — increase usdtAmount or leverage');

    // Place MARKET order
    const params = {
      symbol,
      side,
      type,
      quantity: qty.toString(),
      reduceOnly: reduceOnly ? 'true' : 'false',
      positionSide,
    };

    const order = await binanceSigned('/fapi/v1/order', params, API_KEY, API_SECRET, BASE, 'POST');
    return res.status(200).json({ ok:true, price:lastPrice, qty, order });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
