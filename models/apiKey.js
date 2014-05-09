var config = require('../config')
  , BaseSchema = require('./baseSchema')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var apiKeySchema = new BaseSchema();
apiKeySchema.add({
//  From BaseSchema:
//  created_at:     { type: Date, default: Date.now },

    enabled:        { type: Boolean, default: true },
    key:            { type: String },
    name:           { type: String },
    owner:          { type: Schema.Types.ObjectId, ref: 'Principal' },
    redirect_uri:   { type: String }
});

apiKeySchema.index({ key: 1 });
apiKeySchema.index({ owner: 1 });

var ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;