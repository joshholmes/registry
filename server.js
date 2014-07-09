if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_APP_NAME) {
    require('newrelic');
}

var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , BearerStrategy = require('passport-http-bearer').Strategy
  , config = require('./config')
  , controllers = require('./controllers')
  , ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn(config.user_login_path)
  , exphbs = require('express3-handlebars')
  , hbs = exphbs.create({ defaultLayout: 'main' })
  , LocalStrategy = require('passport-local').Strategy
  , log = require('./log')
  , middleware = require('./middleware')
  , models = require('./models')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , path = require('path')
  , PublicKeyStrategy = require('passport-publickey').Strategy
  , services = require('./services')
  , utils = require('./utils');

log.info("connecting to mongodb instance: " + config.mongodb_connection_string);
mongoose.connect(config.mongodb_connection_string);

app.use(express.logger(config.request_log_format));
app.use(express.compress());
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.cookieSession({
    secret: config.user_session_secret,
    cookie: {
        expires: new Date(Date.now() + config.user_session_timeout_seconds * 1000),
        maxAge: new Date(Date.now() + config.user_session_timeout_seconds * 1000),
    }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new BearerStrategy({}, services.accessTokens.verify));
passport.use(new PublicKeyStrategy({}, services.principals.verifySignature));

app.use(middleware.crossOrigin);

app.enable('trust proxy');
app.disable('x-powered-by');

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// only open endpoints when we have a connection to MongoDB.
mongoose.connection.once('open', function () {
    log.info("service connected to mongodb.");

    services.initialize(function(err) {
        if (err) return log.error("service failed to initialize: " + err);
        if (!services.principals.servicePrincipal) return log.error("Service principal not available after initialize.");

        server.listen(config.internal_port);
        services.subscriptions.attach(server);

        log.info("service has initialized itself, exposing api at: " + config.api_endpoint);

        // REST API ENDPOINTS

        // headwaiter endpoint
        app.get(config.headwaiter_path,                                               controllers.headwaiter.index);

        app.get(config.api_keys_path,              middleware.accessTokenAuth,        controllers.apiKeys.index);
        app.post(config.api_keys_path,             middleware.accessTokenAuth,        controllers.apiKeys.create);

        // blob endpoints
        if (config.blob_provider) {
            app.get(config.blobs_path + '/:id',    middleware.accessTokenAuth,        controllers.blobs.show);
            app.post(config.blobs_path,            middleware.accessTokenAuth,        controllers.blobs.create);
        } else {
            log.warn("not exposing blob endpoints because no blob provider configured (see config.js).");
        }

        // ops endpoints
        app.get(config.ops_path + '/health',                                          controllers.ops.health);
        app.get(config.ops_path + '/stats',                                           controllers.ops.stats);

        // permissions endpoints
        app.get(config.permissions_path,           middleware.accessTokenAuth,        controllers.permissions.index);
        app.post(config.permissions_path,          middleware.accessTokenAuth,        controllers.permissions.create);
        app.delete(config.permissions_path + '/:id', middleware.accessTokenAuth,      controllers.permissions.remove);

        // principal endpoints
        app.post(config.principals_path + '/auth',                                    controllers.principals.legacyAuthentication);

        app.post(config.principals_path + '/publickey/auth', middleware.publicKeyAuth, controllers.principals.authenticate);

        app.get(config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.show);
        app.get(config.principals_path,            middleware.accessTokenAuth,        controllers.principals.index);

        // TODO: CLI needs auth user and create user endpoints for now.
        app.post(config.principals_path + '/user/auth',                               controllers.principals.authenticateUser);
        app.post(config.principals_path,                                              controllers.principals.create);

        app.post(config.principals_path + '/impersonate', middleware.accessTokenAuth, controllers.principals.impersonate);
        app.put(config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.update);
        app.delete(config.principals_path + '/:id', middleware.accessTokenAuth,       controllers.principals.remove);

        // message endpoints
        app.get(config.messages_path + '/:id',     middleware.accessTokenAuth,        controllers.messages.show);
        app.get(config.messages_path,              middleware.accessTokenAuth,        controllers.messages.index);
        app.post(config.messages_path,             middleware.accessTokenAuth,        controllers.messages.create);
        app.delete(config.messages_path,           middleware.accessTokenAuth,        controllers.messages.remove);

        // USER AND OAUTH2 ENDPOINTS

        // create user
        app.get(config.user_create_path,                                              controllers.users.createForm);
        app.post(config.user_create_path,                                             controllers.users.create);

        // login user
        app.get(config.user_login_path,                                               controllers.users.loginForm);
        app.post(config.user_login_path,                                              controllers.users.login);

        // change password
        app.get(config.user_change_password_path,  ensureLoggedIn,                    controllers.users.changePasswordForm);
        app.post(config.user_change_password_path, ensureLoggedIn,                    controllers.users.changePassword);

        // delete account
        app.get(config.user_delete_account_path,  ensureLoggedIn,                     controllers.users.deleteAccountForm);
        app.post(config.user_delete_account_path, ensureLoggedIn,                     controllers.users.deleteAccount);

        // reset password
        app.get(config.user_reset_password_path,                                      controllers.users.resetPasswordForm);
        app.post(config.user_reset_password_path,                                     controllers.users.resetPassword);

        // logout
        app.get(config.user_logout_path,           ensureLoggedIn,                    controllers.users.logout);

        // privacy policy and terms of service
        app.get(config.users_path + "/privacy",                                        controllers.users.privacy);
        app.get(config.users_path + "/terms",                                         controllers.users.terms);

        // user serialization and deserialization
        passport.serializeUser(function(user, done) {
            done(null, user.id);
        });

        passport.deserializeUser(function(id, done) {
            services.principals.findByIdCached(services.principals.servicePrincipal, id, done);
        });

        // oauth2 endpoints
        app.get(config.users_path + '/impersonate', ensureLoggedIn, controllers.users.impersonate);
        app.get(config.users_path + '/authorize', ensureLoggedIn, controllers.users.authorize);
        app.post(config.users_path + '/decision', ensureLoggedIn, controllers.users.decision);

        // client libraries
        app.get('/client/nitrogen.js', function(req, res) { res.send(services.messages.clients['nitrogen.js']); });
        app.get('/client/nitrogen-min.js', function(req, res) { res.send(services.messages.clients['nitrogen-min.js']); });

        // static files (static/ is mapped to the root API url for any path not already covered above)
        app.use(express.static(path.join(__dirname, '/static')));

        log.info("service has initialized API endpoints");

        mongoose.connection.on('error', log.error);
    });
});
