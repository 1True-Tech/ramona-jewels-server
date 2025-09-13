const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    payments: {
      stripe: {
        enabled: { type: Boolean, default: true },
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Get or create the singleton settings document
SettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

module.exports = mongoose.model('Settings', SettingsSchema);