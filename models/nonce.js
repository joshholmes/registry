var config = require('../config')
  , BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var metadataSchema = new BaseSchema();
metadataSchema.add({
    nonce:      { type: String }, // base64
    principal:  { type: Schema.Types.ObjectId, ref: 'Principal' },
    created_at: { type: Date, default: Date.now }
});

metadataSchema.index({ nonce: 1 });
metadataSchema.index({ principal: 1 });
metadataSchema.index({ created_at: 1 }, { expireAfterSeconds: config.nonce_lifetime_seconds });

var Nonce = mongoose.model('Nonce', metadataSchema);

module.exports = Nonce;