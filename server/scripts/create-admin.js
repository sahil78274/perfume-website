'use strict';
/**
 * Create (or, with --force, reset) the FIRST admin account.
 * Usage:
 *   ADMIN_NAME="Store Owner" ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='StrongPass1' node server/scripts/create-admin.js
 *   node server/scripts/create-admin.js --force   # reset password for ADMIN_EMAIL
 * Aliases: npm run create-admin
 *
 * There is NO public admin registration endpoint. This script is the only way in.
 */
const bcrypt = require('bcryptjs');
const { validateConfig, config } = require('../config/env');

async function main() {
  validateConfig();
  const { connectDB, disconnectDB } = require('../db/connect');
  const Admin = require('../models/Admin');
  const { passwordProblem } = require('../utils/validators');

  const force = process.argv.includes('--force') || process.env.ADMIN_FORCE_RESET === 'true';
  const { name, email, password } = config.adminSetup;

  if (!name || !email || !password) {
    console.error('Missing ADMIN_NAME, ADMIN_EMAIL or ADMIN_PASSWORD.');
    console.error('Set them in your environment or .env file — never commit real credentials. See .env.example.');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error('ADMIN_EMAIL is not a valid email address.');
    process.exit(1);
  }
  const problem = passwordProblem(password);
  if (problem) {
    console.error('ADMIN_PASSWORD rejected:', problem);
    process.exit(1);
  }

  await connectDB();
  const existing = await Admin.findOne({ email });
  const adminCount = await Admin.countDocuments();

  if (existing) {
    if (!force) {
      console.error(`An admin with email ${email} already exists (admins: ${adminCount}).`);
      console.error('Refusing to overwrite it. Re-run with --force (or ADMIN_FORCE_RESET=true) to reset that admin\'s password.');
      await disconnectDB();
      process.exit(1);
    }
    existing.name = name;
    existing.passwordHash = await bcrypt.hash(password, 12);
    existing.isActive = true;
    await existing.save();
    console.log(`✔ Admin password reset for ${email}. Log in at /admin/`);
    await disconnectDB();
    return;
  }

  if (adminCount > 0 && !force) {
    console.error(`This store already has ${adminCount} admin account(s). Refusing to create another automatically.`);
    console.error('If you intended to reset an existing admin instead, use --force with ADMIN_EMAIL set to that admin.');
    await disconnectDB();
    process.exit(1);
  }

  await Admin.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
  console.log(`✔ Admin account created for ${email}.`);
  console.log('  Log in at /admin/ — keep these credentials private and change them regularly.');
  await disconnectDB();
}

main().catch((err) => {
  console.error('create-admin failed:', err.message);
  process.exit(1);
});
