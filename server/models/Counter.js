'use strict';
const mongoose = require('mongoose');

/** Atomic sequence generator used for human-friendly order numbers. */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.statics.next = async function (id) {
  const doc = await this.findByIdAndUpdate(id, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
