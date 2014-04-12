var log = require('./log')
  , Loggly = require('winston-loggly').Loggly
  , providers = require('./providers')
  , winston = require('winston');

var config = null;

//
// To enable proxies like NGINX, Nitrogen has internal and external ports.
//
// external_port defines the port that clients should use to access the service.
// internal_port defines the port that the service will listen to.
//

if (process.env.NODE_ENV === "production") {
    config = {
        internal_port: process.env.PORT
    };
} else if (process.env.NODE_ENV === "test") {
    config = {
        external_port: 3050,
        internal_port: 3050,
        protocol: 'http',
        mongodb_connection_string: "mongodb://localhost/nitrogen_test"
    };
} else {
    config = {
        external_port: 3030,
        protocol: 'http',
        mongodb_connection_string: "mongodb://localhost/nitrogen_dev"
    };
}

config.internal_port = config.internal_port || 3030;
config.external_port = config.external_port || 443;
config.protocol = process.env.PROTOCOL || config.protocol || "https";
config.host = process.env.HOST_NAME || config.host || "localhost";
config.mongodb_connection_string = config.mongodb_connection_string || process.env.MONGODB_CONNECTION_STRING;

// Endpoint URI configuration

config.api_path = "/api/";
config.v1_api_path = config.api_path + "v1";

config.base_endpoint = config.protocol + "://" + config.host + ":" + config.external_port;
config.api_endpoint = config.base_endpoint + config.v1_api_path;

config.subscriptions_path = '/';
config.subscriptions_endpoint = config.base_endpoint + config.subscriptions_path;

config.agents_path = config.v1_api_path + "/agents";
config.agents_endpoint = config.base_endpoint + config.agents_path;

config.blobs_path = config.v1_api_path + "/blobs";
config.blobs_endpoint = config.base_endpoint + config.blobs_path;

config.headwaiter_path = config.v1_api_path + "/headwaiter";
config.headwaiter_uri = config.base_endpoint + config.headwaiter_path;

config.messages_path = config.v1_api_path + "/messages";
config.messages_endpoint = config.base_endpoint + config.messages_path;

config.ops_path = config.v1_api_path + "/ops";
config.ops_endpoint = config.base_endpoint + config.ops_path;

config.permissions_path = config.v1_api_path + "/permissions";
config.permissions_endpoint = config.base_endpoint + config.permissions_path;

config.principals_path = config.v1_api_path + "/principals";
config.principals_endpoint = config.base_endpoint + config.principals_path;

// Security configuration parameters.  Make sure you know what you are doing before changing
// any of these parameters.

config.password_hash_iterations = 10000;
config.password_hash_length = 128;
config.device_secret_bytes = 128;
config.salt_length_bytes = 64;
config.reset_password_length = 10;

config.access_token_bytes = 32;
config.access_token_lifetime = 1; // days

config.blob_cache_lifetime = 2592000; // seconds

// # of days a message should live by default
config.default_message_lifetime = 365;

// when the token gets within 10% (default) of config.access_token_lifetime,
// refresh it with a new token via the response header.
config.refresh_token_threshold = 0.1;

// You can use Azure's Blob storage as a blob provider by uncommenting this configuration.
//
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
    console.log('blob_provider: using Azure blob storage.');
    config.blob_provider = new providers.azure.AzureBlobProvider(config);
} else {
    console.log('blob_provider: using local storage.');
    config.blob_storage_path = './storage';
    config.blob_provider = new providers.local.LocalBlobProvider(config);
}

config.cache_provider = new providers.local.NullCacheProvider(config);

if (process.env.REDIS_SERVERS) {

    // To use Redis as a realtime backend, the env variable REDIS_SERVERS
    // should be set to a JSON specification like this with the set of
    // redis servers used for pubsub:
    //
    // { "redis1": { "port": 6379, "host": "redis1.myapp.com", id: "redis1" }

    console.log('pubsub_provider: using Redis pubsub.');

    config.redis_servers = JSON.parse(process.env.REDIS_SERVERS);
    config.pubsub_provider = new providers.redis.RedisPubSubProvider(config);
} else if (process.env.AZURE_SERVICEBUS_NAMESPACE && process.env.AZURE_SERVICEBUS_ACCESS_KEY) {
    console.log('pubsub_provider: using Service Bus pubsub.');
    config.pubsub_provider = new providers.azure.AzurePubSubProvider(config);
} else if (process.env.RABBITMQ_URL) {
    console.log('pubsub_provider: using RabbitMQ pubsub.');
    config.pubsub_provider = new providers.rabbitmq.RabbitMQPubSubProvider(config);
} else {
    console.log('pubsub_provider: using memory pubsub.');
    config.pubsub_provider = new providers.local.MemoryPubSubProvider(config);
}

// Email provider configuration

if (process.env.SENDGRID_API_USER && process.env.SENDGRID_API_KEY) {
    console.log('email_provider: using sendgrid.');
    config.email_provider = new providers.sendgrid.SendgridEmailProvider(config);
} else {
    console.log('email_provider: using null provider.');
    config.email_provider = new providers.local.NullEmailProvider(config);
}

config.request_log_format = ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ":referrer" ":user-agent"';

// You can use Loggly's log service by specifying these 4 environmental variables

if (process.env.LOGGLY_SUBDOMAIN && process.env.LOGGLY_INPUT_TOKEN &&
    process.env.LOGGLY_USERNAME && process.env.LOGGLY_PASSWORD) {

    winston.add(Loggly, {
        "subdomain": process.env.LOGGLY_SUBDOMAIN,
        "inputToken": process.env.LOGGLY_INPUT_TOKEN,
        "auth": {
            "username": process.env.LOGGLY_USERNAME,
            "password": process.env.LOGGLY_PASSWORD
        }
    });
}

log.remove(winston.transports.Console);
log.add(winston.transports.Console, { colorize: true, timestamp: true, level: 'info' });

// if you'd like additional indexes applied to messages at the database layer, you can specify them here.
config.message_indexes = [
];

// Claim codes are what users use to claim devices they have added to the service when IP matching fails.
// Longer claim codes are more secure but less convienent for users.
config.claim_code_length = 8;

// run the janitor every minute
config.janitor_interval = 60 * 1000;

// Validate all message schemas to conform to all core and installed schemas.
config.validate_schemas = true;

// Email address that the service should use for administrative emails.
config.service_email_address = "admin@nitrogen.io";

module.exports = config;
