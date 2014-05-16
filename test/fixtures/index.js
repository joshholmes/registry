var async = require('async')
  , config = require('../../config')
  , fs = require('fs')
  , log = require('../../log')
  , models = require('../../models')
  , services = require('../../services')
  , ursa = require('ursa');

var fixtures = {};

var removeAll = function (modelType, callback) {
    modelType.remove({}, callback);
};

var createApiKeyFixtures = function(callback) {
    var adminKey = new models.ApiKey({
        name: 'Admin',
        capabilities: ['impersonate'],
        redirect_uri: 'http://localhost:9000/',
        owner: services.principals.servicePrincipal.id
    });

    services.apiKeys.create(adminKey, function(err, adminKey) {
        if (err) throw err;

        fixtures.apiKeys.admin = adminKey;

        var regularAppKey = new models.ApiKey({
            name: 'Regular App',
            capabilities: [],
            redirect_uri: 'http://localhost:9000/',
            owner: fixtures.principals.anotherUser.id
        });

        services.apiKeys.create(regularAppKey, function(err, regularAppKey) {
            if (err) throw err;

            fixtures.apiKeys.regularApp = regularAppKey;

            return callback();
        });
    });
};

var createAppFixtures = function(callback) {
    log.debug("creating app fixture");

    var app = new models.Principal({
        type: 'app',
        api_key: fixtures.apiKeys.regularApp
    });

    services.principals.create(app, function(err, app) {
        if (err) throw err;

        fixtures.principals.app = app;

        return callback();
    });
};

var createAuthCodeFixtures = function(callback) {
    log.debug("creating authCode fixture");

    var authCode = models.AuthCode({
        api_key: fixtures.apiKeys.regularApp,
        app: fixtures.principals.app.id,
        name: fixtures.apiKeys.regularApp.name,
        user: fixtures.principals.user.id,
        scope: '[]',
        redirect_uri: fixtures.apiKeys.regularApp.redirect_uri
    });

    services.authCodes.create(authCode, function(err, authCode) {
        fixtures.authCodes.regularApp = authCode;

        return callback();
    });
};

var createDeviceFixtures = function(callback) {
    log.debug("creating device fixtures");

    var device = new models.Principal({
        type: 'device',
        name: 'existing_device'
    });

    var keys = ursa.generatePrivateKey(config.public_key_bits, config.public_key_exponent);

    device.public_key = keys.toPublicPem().toString('base64');

    services.principals.create(device, function(err, device) {
        if (err) throw err;

        var userIsDeviceAdmin = new models.Permission({
            authorized: true,
            issued_to: fixtures.principals.user.id,
            principal_for: device.id,
            priority: models.Permission.DEFAULT_PRIORITY_BASE
        });

        services.permissions.create(services.principals.servicePrincipal, userIsDeviceAdmin, function(err) {
            if (err) throw err;

            services.principals.updateLastConnection(device, '127.0.0.1');

            device.private_key = keys.toPrivatePem().toString('base64');

            fixtures.principals.device = device;

            services.accessTokens.create(device, function(err, accessToken) {
                if (err) throw err;

                // make access token expire in 15 minutes to force an accessToken refresh
                var updates = { expires_at: new Date(new Date().getTime() + (15 * 60000))};
                models.AccessToken.update({ _id: accessToken.id }, { $set: updates }, function (err, updateCount) {
                    fixtures.accessTokens.device = accessToken;
                    log.debug("creating device fixtures: FINISHED: " + updates.expires_at);
                    callback();
                });
            });
        });
    });

};

var createServiceUserFixtures = function(callback) {
    log.debug("creating service user fixtures");
    services.accessTokens.findOrCreateToken(services.principals.servicePrincipal, function(err, accessToken) {
        if (err) throw err;

        fixtures.accessTokens.service = accessToken;
        log.debug("creating service user fixtures: FINISHED");
        callback();
    });
};

var createUserFixtures = function(callback) {
    log.debug("creating user fixtures");

    var user = new models.Principal({ type: 'user',
                                      email: 'user@server.org',
                                      password: 'sEcReT44' });

    services.principals.create(user, function(err, user) {
        if (err) throw err;

        fixtures.principals.user = user;

        services.accessTokens.create(user, function(err, accessToken) {
            if (err) throw err;

            fixtures.accessTokens.user = accessToken;

            var anotherUser = new models.Principal({
                type: 'user',
                email: 'anotheruser@server.org',
                password: 'sEcReTO66'
            });

            services.principals.create(anotherUser, function(err, user) {
                if (err) throw err;

                fixtures.principals.anotherUser = anotherUser;

                var userCanImpersonateAnotherUser = new models.Permission({
                    authorized: true,
                    issued_to: fixtures.principals.user.id,
                    principal_for: fixtures.principals.anotherUser.id,
                    action: 'impersonate',
                    priority: models.Permission.DEFAULT_PRIORITY_BASE
                });

                services.permissions.create(services.principals.servicePrincipal, userCanImpersonateAnotherUser, function(err) {
                    if (err) throw err;

                    services.accessTokens.create(anotherUser, function(err, accessToken) {
                        if (err) throw err;

                        fixtures.accessTokens.anotherUser = accessToken;

                        log.debug("creating user fixtures: FINISHED");
                        callback();
                    });
                });
            });
        });
    });
};

var createBlobFixture = function(callback) {
    log.debug("creating blob fixtures");

    var fixture_path = 'test/fixtures/images/image.jpg';

    fs.stat(fixture_path, function(err, stats) {
        if (err) throw err;

        var blob = new models.Blob({
            content_type: "image/jpeg",
            content_length: stats.size
        });

        var stream = fs.createReadStream(fixture_path);
        services.blobs.create(fixtures.principals.user, blob, stream, function(err, blob) {
            if (err) throw err;

            fixtures.blobs.removableBlob = blob;

            log.debug("creating blob fixtures: FINISHED");

            callback();
        });
    });
};

var createDeviceIpMessageFixture = function(callback) {
    log.debug("creating device ip fixtures");

    var message = new models.Message({ from: fixtures.principals.device.id,
                                       type: "ip",
                                       body: { ip_address: "127.0.0.1" } });

    services.messages.create(services.principals.servicePrincipal, message, function (err, messages) {
        if (err) throw err;

        fixtures.messages.deviceIp = messages[0];
        log.debug("creating device ip fixtures: FINISHED");
        callback();
    });
};

exports.reset = function(callback) {

    var modelTypes = Object.keys(models).map(function(key) { return models[key]; });

    async.each(modelTypes, removeAll, function(err) {
        if (err) throw err;

        var fixtureFactories = [
            createUserFixtures,
            createDeviceFixtures,
            createDeviceIpMessageFixture,
            createServiceUserFixtures,
            createApiKeyFixtures,
            createAppFixtures,
            createAuthCodeFixtures
        ];

        if (config.blob_provider) {
            fixtureFactories.push(createBlobFixture);
        }

        async.series(fixtureFactories, callback);
    });
};

var fixtures = {
    accessTokens: {},
    apiKeys: {},
    authCodes: {},
    blobs: {},
    messages: {},
    principals: {}
};

exports.models = fixtures;
