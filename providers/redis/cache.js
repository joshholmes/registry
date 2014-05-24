var log = require('../../log')
  , redis = require('redis');

function RedisCacheProvider(config) {
    this.client = redis.createClient(config.redis_server.port, config.redis_server.host);
}

RedisCacheProvider.buildCompositeKey = function(namespace, key) {
    return namespace + '_' + key;
}

RedisCacheProvider.prototype.del = function(namespace, key, callback) {
    this.client.del(RedisCacheProvider.buildCompositeKey(namespace, key), callback);
};

RedisCacheProvider.prototype.get = function(namespace, key, callback) {
    var compositeKey = RedisCacheProvider.buildCompositeKey(namespace, key);

    this.client.get(compositeKey, function(err, entryJson) {
        if (err) return callback(err);
        if (!entryJson) return callback();

        var entry = JSON.parse(entryJson);

        if (entry.expiration < new Date()) {
            return this.del(namespace, key, callback);
        }

//        log.warn('returning');
//        console.dir(entry.value);

        return callback(null, entry.value);
    });
};

RedisCacheProvider.prototype.set = function(namespace, key, value, expiration, callback) {
    var entry = {
        expiration: expiration,
        value: value
    };

//    log.warn('caching');
//    console.dir(entry.value);

    this.client.set(RedisCacheProvider.buildCompositeKey(namespace, key), JSON.stringify(entry), function() {
        return callback();
    });
};

module.exports = RedisCacheProvider;