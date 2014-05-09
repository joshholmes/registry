var config = require('../config')
  , BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var nonceSchema = new BaseSchema();
nonceSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    nonce:          { type: String }, // base64
    principal:      { type: Schema.Types.ObjectId, ref: 'Principal' },
});

nonceSchema.index({ nonce: 1 });
nonceSchema.index({ principal: 1 });
nonceSchema.index({ created_at: 1 }, { expireAfterSeconds: config.nonce_lifetime_seconds });

var Nonce = mongoose.model('Nonce', nonceSchema);

module.exports = Nonce;