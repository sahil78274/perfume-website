'use strict';
const cloudinary = require('cloudinary').v2;
const { config } = require('../config/env');

if (config.cloudinary.configured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true
  });
}

/** Upload a buffer to Cloudinary. Throws if Cloudinary is not configured. */
function uploadBuffer(buffer, { folder = 'scentora/products', publicId } = {}) {
  if (!config.cloudinary.configured) {
    const err = new Error('IMAGE_STORAGE_NOT_CONFIGURED');
    err.code = 'IMAGE_STORAGE_NOT_CONFIGURED';
    throw err;
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function destroyImage(publicId) {
  if (!config.cloudinary.configured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[cloudinary] destroy failed for', publicId, '-', err.message);
  }
}

module.exports = { uploadBuffer, destroyImage, cloudinaryConfigured: () => config.cloudinary.configured };
