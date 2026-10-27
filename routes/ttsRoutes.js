const express = require('express');
const router = express.Router();

// Simple in-memory cache for generated Malayalam audio buffers
const audioCache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Split text into chunks of <= 180 chars preserving word boundaries
 */
function splitIntoChunks(text, maxLen = 180) {
  const sentences = text.replace(/([.?!;।\n]+)/g, '$1|').split('|');
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      // If a single sentence is longer than maxLen, split by spaces
      if (trimmed.length > maxLen) {
        const words = trimmed.split(' ');
        let wordChunk = '';
        for (const w of words) {
          if ((wordChunk + ' ' + w).trim().length <= maxLen) {
            wordChunk = (wordChunk + ' ' + w).trim();
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = w;
          }
        }
        current = wordChunk;
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.slice(0, 8); // Limit to top 8 chunks (~1200 characters) for fast responsive playback
}

router.get('/', async (req, res) => {
  try {
    const rawText = req.query.text || '';
    if (!rawText.trim()) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    // Clean text: strip HTML tags and excessive symbols
    const cleanText = rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/[#*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(400).json({ error: 'Valid text is required' });
    }

    // Check cache
    if (audioCache.has(cleanText)) {
      const cached = audioCache.get(cleanText);
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': cached.length,
      });
      return res.send(cached);
    }

    const chunks = splitIntoChunks(cleanText, 175);
    const audioBuffers = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ml&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://translate.google.com/',
        },
      });

      if (!response.ok) {
        console.warn(`TTS upstream responded with HTTP ${response.status} for chunk`);
        continue;
      }

      const arrBuf = await response.arrayBuffer();
      if (arrBuf && arrBuf.byteLength > 0) {
        audioBuffers.push(Buffer.from(arrBuf));
      }
    }

    if (audioBuffers.length === 0) {
      return res.status(502).json({ error: 'Failed to generate Malayalam audio' });
    }

    const combinedBuffer = Buffer.concat(audioBuffers);

    // Save to cache (evict oldest if cache gets large)
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cleanText, combinedBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': combinedBuffer.length,
    });
    return res.send(combinedBuffer);
  } catch (error) {
    console.error('Error generating Malayalam TTS:', error);
    return res.status(500).json({ error: 'TTS processing error', details: error.message });
  }
});

module.exports = router;
