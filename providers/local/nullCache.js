var log = require('../../log');

/* Cache provider that provides no caching */

function NullCacheProvider() {
}

NullCacheProvider.prototype.del = function(namespace, key, callback) {
    return callback();
};

NullCacheProvider.prototype.get = function(namespace, key, callback) {
    return callback();
};

NullCacheProvider.prototype.set = function(namespace, key, value, expiration, callback) {
    return callback();
};

module.exports = NullCacheProvider;
