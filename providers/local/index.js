module.exports = {
    LocalBlobProvider:      require('./blob'),
    MemoryCacheProvider:    require('./memoryCache'),
    MemoryPubSubProvider:   require('./pubSub'),
    NullArchiveProvider:    require('./archive'),
    NullCacheProvider:      require('./nullCache'),
    NullEmailProvider:      require('./email')
};
