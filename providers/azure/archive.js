var azure = require('azure')
  , log = require('../../log');

var TABLE_NAME = "messages";

function AzureArchiveProvider(config) {
    var azure_storage_account = config.azure_storage_account || process.env.AZURE_STORAGE_ACCOUNT;
    var azure_storage_key = config.azure_storage_key || process.env.AZURE_STORAGE_KEY;

    if (!azure_storage_account || !azure_storage_key) {
        log.warn("WARNING: Azure storage account or key not configured.  Set AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY as environment variables to configure the azure blob provider.");
        return;
    }

    var retryOperations = new azure.ExponentialRetryPolicyFilter();

    this.azureTableService = azure.createTableService(
        azure_storage_account,
        azure_storage_key
    ).withFilter(retryOperations);
}

AzureArchiveProvider.prototype.archive = function(message, callback) {
    var messageObject = message.toObject();

    messageObject.PartitionKey = messageObject.from;
    messageObject.RowKey = messageObject.id;

    messageObject.body = JSON.stringify(messageObject.body);
    messageObject.tags = JSON.stringify(messageObject.tags);
    messageObject.response_to = JSON.stringify(messageObject.response_to);
    messageObject.visible_to = JSON.stringify(messageObject.visible_to);

    this.azureTableService.insertEntity(TABLE_NAME, messageObject, callback);
};

AzureArchiveProvider.prototype.initialize = function(callback) {
    this.azureTableService.createTableIfNotExists(TABLE_NAME, callback);
};

module.exports = AzureArchiveProvider;