module.exports = {
    AzureArchiveProvider:   require('./archive'),
    AzureBlobProvider:      require('./blob'),
    AzurePubSubProvider:    require('./pubSub'),
    AzureEventHubProvider:  require('./eventHub')
};
