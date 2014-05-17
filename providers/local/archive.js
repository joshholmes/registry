function NullArchiveProvider(config) {
}

NullArchiveProvider.prototype.archive = function(message, callback) {
    if (callback) return callback();
};

NullArchiveProvider.prototype.initialize = function(callback) {
    if (callback) return callback();
};

module.exports = NullArchiveProvider;