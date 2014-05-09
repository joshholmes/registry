var config = require('../config')
  , BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var authCodeSchema = new BaseSchema();
authCodeSchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    code:           { type: String },
    api_key:        { type: Schema.Types.ObjectId, ref: 'ApiKey' },
    name:           { type: String },
    perms:          { type: Object },
    principal:      { type: Schema.Types.ObjectId, ref: 'Principal' },
    redirect_uri:   { type: String }
});

authCodeSchema.index({ code: 1 });
authCodeSchema.index({ created_at: 1 }, { expireAfterSeconds: config.auth_code_lifetime_seconds });

var AuthCode = mongoose.model('AuthCode', authCodeSchema);

module.exports = AuthCode;