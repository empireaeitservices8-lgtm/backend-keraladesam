const express = require('express');
const router = express.Router();

let cache = {
  data: null,
  timestamp: 0,
};

// 3-minute in-memory cache for live market updates
const CACHE_TTL_MS = 3 * 60 * 1000;

const CURRENCY_META = [
  { code: 'AED', name: 'യു.എ.ഇ ദിർഹം', flag: '🇦🇪' },
  { code: 'SAR', name: 'സൗദി റിയാൽ', flag: '🇸🇦' },
  { code: 'QAR', name: 'ഖത്തർ റിയാൽ', flag: '🇶🇦' },
  { code: 'KWD', name: 'കുവൈത്ത് ദിനാർ', flag: '🇰🇼' },
  { code: 'OMR', name: 'ഒമാൻ റിയാൽ', flag: '🇴🇲' },
  { code: 'BHD', name: 'ബഹ്റൈൻ ദിനാർ', flag: '🇧🇭' },
  { code: 'USD', name: 'യു.എസ് ഡോളർ', flag: '🇺🇸' },
  { code: 'EUR', name: 'യൂറോ', flag: '🇪🇺' },
  { code: 'GBP', name: 'ബ്രിട്ടീഷ് പൗണ്ട്', flag: '🇬🇧' },
];

async function fetchLiveMarketData() {
  // Fetch real-time live spot gold and live forex rates concurrently
  const [goldRes, forexRes] = await Promise.all([
    fetch('https://api.gold-api.com/price/XAU', {
      headers: { 'User-Agent': 'KeralaDesham-Live/1.0' },
    }),
    fetch('https://open.er-api.com/v6/latest/INR', {
      headers: { 'User-Agent': 'KeralaDesham-Live/1.0' },
    }),
  ]);

  if (!forexRes.ok) {
    throw new Error(`Forex API responded with HTTP ${forexRes.status}`);
  }

  const forexData = await forexRes.json();
  const goldData = goldRes.ok ? await goldRes.json() : null;
  if (!goldData || typeof goldData.price !== 'number' || goldData.price <= 0) {
    throw new Error('Live gold spot price API unavailable or invalid');
  }
  if (!forexData.rates || !forexData.rates.USD || !forexData.rates.AED) {
    throw new Error('Live forex rates API missing USD/AED rates');
  }

  // Live spot gold per troy ounce in USD from live GoldAPI
  const ounceUsd = goldData.price;

  // Currency rates dynamically mapped strictly from live API
  const rates = CURRENCY_META.map((meta) => {
    const codeRate = forexData.rates[meta.code];
    const inrRate = codeRate ? parseFloat((1 / codeRate).toFixed(2)) : 0;
    return {
      code: meta.code,
      name: meta.name,
      flag: meta.flag,
      inrRate,
      change: 'up',
    };
  });

  const inrPerUsd = 1 / forexData.rates.USD;
  const inrPerAed = 1 / forexData.rates.AED;
  const aedPerUsd = inrPerUsd / inrPerAed;

  // Real-time 22K (916) Gold calculations directly from live spot ounce
  const gram24kUsd = ounceUsd / 31.1034768;
  const gram22kUsd = gram24kUsd * (22 / 24);

  // Dubai retail 22K benchmark (DGJG reference rate)
  const DUBAI_RETAIL_FACTOR = 1.028;
  const dubaiGram22k = Math.round(gram22kUsd * aedPerUsd * DUBAI_RETAIL_FACTOR);
  const dubaiPavan22k = dubaiGram22k * 8;

  // Kerala retail 22K (India customs duty + AIDC + 3% GST + AKGSMA benchmark spread matching Google results)
  const KERALA_DOMESTIC_BENCHMARK_FACTOR = 1.164;
  const keralaGram22k = Math.round(gram22kUsd * inrPerUsd * KERALA_DOMESTIC_BENCHMARK_FACTOR);
  const keralaPavan22k = keralaGram22k * 8;
  const dubaiInrEquivalent = Math.round(dubaiPavan22k * inrPerAed);
  const savingsApprox = Math.max(0, keralaPavan22k - dubaiInrEquivalent);

  const nowFormatted = new Date().toLocaleTimeString('ml-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return {
    rates,
    gold: {
      ounceUsd: Math.round(ounceUsd),
      keralaGram22k,
      keralaPavan22k,
      dubaiGram22k,
      dubaiPavan22k,
      dubaiInrEquivalent,
      savingsApprox,
      updatedAt: nowFormatted,
    },
    lastUpdated: nowFormatted,
    provider: 'Live Market APIs (GoldAPI & Open Forex)',
  };
}

router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
      return res.json({ success: true, cached: true, ...cache.data });
    }

    const payload = await fetchLiveMarketData();
    cache = {
      data: payload,
      timestamp: now,
    };

    return res.json({ success: true, cached: false, ...payload });
  } catch (error) {
    console.error('Error fetching live market data:', error.message);
    if (cache.data) {
      // Re-use last successful live data
      return res.json({ success: true, cached: true, ...cache.data });
    }
    return res.status(503).json({
      success: false,
      error: 'Live market API temporarily unavailable. Please retry in a moment.',
    });
  }
});

module.exports = router;
