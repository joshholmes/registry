var azure = require('azure')
    , eventhub = require('event-hub-client')
    , log = require('../../log');

/**
 * Builds the Azure EventHub Provider, which operates similarly to the Archive provider,
 *  in that it is a one-way communication of, ideally, telemetry data to the EventHub.
 *
 * @param {Object} config   Map containing configuration values.  If they don't exist, they are pulled from process.env.
 *                          Values required: azure_servicebus_namespace, azure_eventhub_name, azure_eventhub_key_name, and azure_eventhub_key.
 *                          The key name/value are the SAS key for sending messages from the publishers serviced by this nitrogen instance.
 * @constructor
 */
function AzureEventHubProvider(config) {
    var azure_servicebus_namespace = config.azure_servicebus_namespace || process.env.AZURE_SERVICEBUS_NAMESPACE;
    var azure_eventhub_name = config.azure_eventhub_name || process.env.AZURE_EVENTHUB_NAME;
    var azure_shared_access_key_name = config.azure_eventhub_key_name || process.env.AZURE_EVENTHUB_KEY_NAME;
    var azure_shared_access_key = config.azure_eventhub_key || process.env.AZURE_EVENTHUB_KEY;

    if (!azure_servicebus_namespace || !azure_eventhub_name || !azure_shared_access_key_name || !azure_shared_access_key) {
        log.warn('WARNING: Azure Event Hub not configured correctly.  ' +
            'Set AZURE_SERVICEBUS_NAMESPACE, AZURE_EVENTHUB_NAME, AZURE_EVENTHUB_KEY_NAME, and AZURE_EVENTHUB_KEY as environment variables to configure the azure event hub provider.');
        return;
    }

    this.eventHubClient = eventhub.restClient(
        azure_servicebus_namespace,
        azure_eventhub_name,
        azure_shared_access_key_name,
        azure_shared_access_key
    );
}

/**
 * Send the message to the Azure EventHub.
 *
 * @param {Object} message                          Message to send, message.from is used as the publisher name.
 * @param {Function(error, statusCode)} callback    Callback, error evaluates to true on failure.
 */
AzureEventHubProvider.prototype.archive = function(message, callback) {
    var messageObject = message.toObject();

    var publisher = (messageObject.from && messageObject.from.name) ? messageObject.from.name : null;

    this.eventHubClient.sendMessage(JSON.stringify(messageObject), publisher, callback);
};

/**
 * Creates the configured EventHub in Azure, if it doesn't exist.  Succeeds on collisions, fails on other errors.
 *
 * @param {Function(error, statusCode)} callback    Callback, error evaluates to true on failure.
 */
AzureEventHubProvider.prototype.initialize = function(callback) {
    this.eventHubClient.createHubIfNotExists(callback);
};

module.exports = AzureEventHubProvider;