/**
 * Cloudflare Service for Kerala Desam
 * Bridges to the unified storage service and provides Cloudflare-specific tools.
 */

const storageService = require('./storageService');

function getCloudflareStatus() {
  return storageService.getStorageStatus();
}

async function uploadMedia(bufferOrBase64, originalName = 'upload.jpg', mimeType = 'image/jpeg') {
  return storageService.uploadMedia(bufferOrBase64, originalName, mimeType);
}

function prepareLargeArticleParagraphs(paragraphs) {
  if (!Array.isArray(paragraphs)) {
    if (typeof paragraphs === 'string') {
      try {
        const parsed = JSON.parse(paragraphs);
        if (Array.isArray(parsed)) return parsed.map((p) => String(p).trim()).filter(Boolean);
      } catch {}
      return paragraphs.split('\n\n').map((p) => p.trim()).filter(Boolean);
    }
    return [];
  }
  return paragraphs.map((p) => String(p || '').trim()).filter(Boolean);
}

module.exports = {
  getCloudflareStatus,
  uploadMedia,
  prepareLargeArticleParagraphs,
};
