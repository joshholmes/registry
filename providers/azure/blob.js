var azure = require('azure')
  , log = require('../../log')
  , streamifier = require('streamifier');

var BLOB_CONTAINER = "blobs";

function AzureBlobProvider(config) {
    var azure_storage_account = config.azure_storage_account || process.env.AZURE_STORAGE_ACCOUNT;
    var azure_storage_key = config.azure_storage_key || process.env.AZURE_STORAGE_KEY;
    var azure_storage_endpoint = azure_storage_account + ".blob.core.windows.net";

    this.base_endpoint = "https://" + azure_storage_endpoint;

    if (!azure_storage_account || !azure_storage_key) {
        log.warn("WARNING: Azure storage account or key not configured.  Set AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY as environment variables to configure the azure blob provider.");
        return;
    }

    this.azureBlobService = azure.createBlobService(
        azure_storage_account,
        azure_storage_key,
        azure_storage_endpoint
    );
}

AzureBlobProvider.prototype.create = function(blob, stream, callback) {
    // Azure requires the length of the stream at the start of the Stream
    // so count and buffer the contents.  Yes, this sucks.

    var buffers = [];
    var contentLength = 0;
    var self = this;

    stream.on('data', function(data) {
        buffers.push(data);
        contentLength += data.length;
    });

    stream.on('end', function() {
        var fullBlobBuffer = Buffer.concat(buffers);

        var blobStream = streamifier.createReadStream(fullBlobBuffer);

        self.azureBlobService.createBlockBlobFromStream(
            BLOB_CONTAINER, blob.id, blobStream, contentLength,
            { "contentType": blob.content_type },
            function(err, blobResult, response) {

                callback(err, blob);
            }
        );
    });
};

AzureBlobProvider.prototype.initialize = function(callback) {
    this.azureBlobService.createContainerIfNotExists(BLOB_CONTAINER, callback);
};

AzureBlobProvider.prototype.remove = function(blob, callback) {
    this.azureBlobService.deleteBlob(BLOB_CONTAINER, blob.id, callback);
};

AzureBlobProvider.prototype.stream = function(blob, stream, callback) {
    this.azureBlobService.getBlobToStream(BLOB_CONTAINER, blob.id, stream, callback);
};

module.exports = AzureBlobProvider;