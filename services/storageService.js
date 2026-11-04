/**
 * Unified Storage Service for Kerala Desam
 * 
 * Priority:
 * 1. Cloudinary (if CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET or CLOUDINARY_URL set)
 * 2. Cloudflare R2 (if CLOUDFLARE_ACCOUNT_ID / R2 keys configured)
 * 3. Local disk storage ('public/uploads') when running on persistent servers
 * 4. Resilient Base64 Data-URI fallback for serverless cold-starts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

// --- 1. Cloudinary Configuration ---
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME &&
   process.env.CLOUDINARY_API_KEY &&
   process.env.CLOUDINARY_API_SECRET)
);

if (isCloudinaryConfigured && !process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// --- 2. Cloudflare R2 Configuration ---
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'keraladesam-media';
const CLOUDFLARE_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.CLOUDFLARE_CDN_URL || '';

const isCloudflareConfigured = Boolean(
  CLOUDFLARE_ACCOUNT_ID &&
  CLOUDFLARE_R2_ACCESS_KEY_ID &&
  CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
  CLOUDFLARE_R2_BUCKET_NAME
);

function getStorageStatus() {
  if (isCloudinaryConfigured) {
    return {
      activeProvider: 'Cloudinary',
      configured: true,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'configured via URL',
      features: ['Automatic optimization', 'Responsive URLs', 'Secure CDN delivery', 'Images and Videos']
    };
  }
  if (isCloudflareConfigured) {
    return {
      activeProvider: 'Cloudflare R2 + CDN',
      configured: true,
      bucket: CLOUDFLARE_R2_BUCKET_NAME,
      publicUrl: CLOUDFLARE_R2_PUBLIC_URL || 'Configured via Cloudflare Custom Domain',
      features: ['Zero egress fees', 'Global Anycast CDN distribution']
    };
  }
  return {
    activeProvider: 'Local Disk / In-line Fallback',
    configured: false,
    notes: 'Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env for production media storage.'
  };
}

/**
 * Upload buffer or data string to active storage provider
 * @param {Buffer|string} bufferOrBase64 
 * @param {string} originalName 
 * @param {string} mimeType 
 * @param {string} folder 
 * @returns {Promise<{ url: string, provider: string, publicId?: string, key?: string }>}
 */
async function uploadMedia(bufferOrBase64, originalName = 'upload.jpg', mimeType = 'image/jpeg', folder = 'keraladesam') {
  let fileBuffer;
  if (Buffer.isBuffer(bufferOrBase64)) {
    fileBuffer = bufferOrBase64;
  } else if (typeof bufferOrBase64 === 'string') {
    if (bufferOrBase64.startsWith('data:')) {
      const base64Data = bufferOrBase64.split(';base64,').pop();
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else {
      fileBuffer = Buffer.from(bufferOrBase64, 'utf8');
    }
  } else {
    throw new Error('Invalid buffer provided to uploadMedia');
  }

  // 1. Cloudinary upload if configured
  if (isCloudinaryConfigured) {
    try {
      const isVideo = mimeType.startsWith('video/');
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: isVideo ? 'video' : 'auto',
          },
          (err, res) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
        stream.end(fileBuffer);
      });

      return {
        url: result.secure_url || result.url,
        provider: 'cloudinary',
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
      };
    } catch (cErr) {
      console.warn('Cloudinary upload warning:', cErr.message);
    }
  }

  const ext = path.extname(originalName) || (mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : '.jpg');
  const uniqueKey = `uploads/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

  // 2. Cloudflare R2 upload if configured
  if (isCloudflareConfigured) {
    try {
      const endpoint = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${CLOUDFLARE_R2_BUCKET_NAME}/${uniqueKey}`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileBuffer.length),
        },
        body: fileBuffer,
      });

      if (response.ok) {
        const publicUrl = CLOUDFLARE_R2_PUBLIC_URL
          ? `${CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, '')}/${uniqueKey}`
          : `https://${CLOUDFLARE_R2_BUCKET_NAME}.r2.dev/${uniqueKey}`;

        return {
          url: publicUrl,
          provider: 'cloudflare-r2',
          key: uniqueKey,
        };
      }
    } catch (r2Err) {
      console.warn('Cloudflare R2 upload warning:', r2Err.message);
    }
  }

  // 3. Local disk fallback (persistent node runtime)
  try {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localFilePath = path.join(uploadDir, path.basename(uniqueKey));
    fs.writeFileSync(localFilePath, fileBuffer);
    return {
      url: `/uploads/${path.basename(uniqueKey)}`,
      provider: 'local-disk',
      key: uniqueKey,
    };
  } catch (fsErr) {
    // 4. Serverless data URL fallback
    const base64Str = fileBuffer.toString('base64');
    return {
      url: `data:${mimeType};base64,${base64Str}`,
      provider: 'data-url-fallback',
      key: uniqueKey,
    };
  }
}

/**
 * Delete media from active provider
 */
async function deleteMedia(identifier) {
  if (!identifier) return false;

  if (isCloudinaryConfigured) {
    try {
      await cloudinary.uploader.destroy(identifier);
      return true;
    } catch (err) {
      console.warn('Cloudinary destroy warning:', err.message);
    }
  }

  return true;
}

module.exports = {
  getStorageStatus,
  uploadMedia,
  deleteMedia,
  isCloudinaryConfigured,
  isCloudflareConfigured,
};

