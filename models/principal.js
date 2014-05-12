var BaseSchema = require('./baseSchema')
  ,	mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var principalSchema = new BaseSchema();
principalSchema.add({
//  From BaseSchema:
//  created_at:      { type: Date, default: Date.now },

    type:            { type: String },
    name:            { type: String },

    claim_code:      { type: String },

    last_ip:         { type: String },
    last_connection: { type: Date, default: Date.now },

    tags:            [{ type: String }],

// non-user fields

    public_key:     { type: String },  // base64

    // TODO: legacy device credential support - remove once migration complete.
    secret_hash:     { type: String }, // base64

// application fields

    api_key:         { type: Schema.Types.ObjectId, ref: 'ApiKey' },

// user fields

    email:           { type: String },
    password_hash:   { type: String }, // base64
    salt:            { type: String }, // base64

// internally used fields

    visible_to:      [{ type: Schema.Types.ObjectId, ref: 'Principal' }]
});

principalSchema.index({ claim_code: 1 });
principalSchema.index({ email: 1 });
principalSchema.index({ last_ip: 1 });
principalSchema.index({ parent: 1 });
principalSchema.index({ tags: 1 });
principalSchema.index({ type: 1 });
principalSchema.index({ visible_to: 1 });

principalSchema.virtual('secret').set(function(value) { this._secret = value; });
principalSchema.virtual('secret').get(function() { return this._secret; });

principalSchema.virtual('password').set(function(value) { this._password = value; });
principalSchema.virtual('password').get(function() { return this._password; });

var principalObjectTransform = function(doc, ret, options) {
    BaseSchema.baseObjectTransform(doc, ret, options);

    delete ret.salt;
    delete ret.secret_hash;
    delete ret.password_hash;
    delete ret.visible_to;
};

principalSchema.set('toObject', { transform: principalObjectTransform });
principalSchema.set('toJSON', { transform: principalObjectTransform });

principalSchema.path('type').validate(function (value) {
    return Principal.PRINCIPAL_TYPES.indexOf(value) !== -1;
}, 'Principal must have valid type.');

var Principal = mongoose.model('Principal', principalSchema);

Principal.prototype.is = function(type) {
    return this.type === type;
};

Principal.prototype.equals = function(principal) {
    return principal.id.toString() === this.id.toString();
};

Principal.PRINCIPAL_TYPES = ['app', 'device', 'reactor', 'service', 'user'];

module.exports = Principal;