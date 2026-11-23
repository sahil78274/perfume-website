'use strict';
const mongoose = require('mongoose');
const { config } = require('../config/env');

mongoose.set('strictQuery', true);

async function connectDB(uri) {
  const mongoUri = uri || config.mongoUri;
  mongoose.connection.on('connected', () => console.log('[db] MongoDB connected:', mongoose.connection.name));
  mongoose.connection.on('error', (err) => console.error('[db] MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
    autoIndex: !config.isProduction ? true : true // keep index builds automatic (Atlas-friendly)
  });
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
