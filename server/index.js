'use strict';
const { validateConfig, config } = require('./config/env');

let server;

async function main() {
  try {
    validateConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const { connectDB } = require('./db/connect');
  const { createApp } = require('./app');

  try {
    await connectDB();
  } catch (err) {
    console.error('[db] Failed to connect to MongoDB:', err.message);
    console.error('[db] Check MONGODB_URI, network access and that your IP is allow-listed in MongoDB Atlas.');
    process.exit(1);
  }

  const app = createApp();
  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[scentora] listening on port ${config.port} (${config.env})`);
    if (!config.cloudinary.configured) {
      console.warn('[images] Cloudinary is NOT configured — admin product image uploads will be rejected until CLOUDINARY_* env vars are set. See README.md.');
    }
    if (!config.email.configured) {
      console.warn('[email] SMTP is NOT configured — order confirmation emails will be skipped. See README.md.');
    }
  });

  const shutdown = (signal) => {
    console.log(`\n[scentora] ${signal} received — shutting down gracefully`);
    if (server) server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err);
  process.exit(1);
});

main();
