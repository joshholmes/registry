var config = require('../config')
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var authorize = function(req, res) {
    var key = req.param('api_key');
    var redirect_uri = req.param('redirect_uri');
    var perms = []; // req.param('perms');

    services.apiKeys.check(key, redirect_uri, function(err, apiKey) {
        if (err) return utils.handleError(res, err);

        services.principals.find(services.principals.servicePrincipal, { api_key: apiKey.id, parent: req.user.id }, {}, function(err, apps) {
            if (err) return utils.handleError(res, err);
            if (apps.length > 0) return redirectWithSession(res, apps[0], redirect_uri);

            var authCode = models.AuthCode({
                api_key: apiKey.id,
                name: apiKey.name,
                principal: req.user.id,
                perms: perms,
                redirect_uri: redirect_uri
            });

            services.authCodes.create(authCode, function(err, authCode) {
                if (err) return utils.handleError(res, err);

                res.render('user/authorize', {
                    apiKey:             apiKey,
                    authCode:           authCode,
                    userDecisionPath:  config.user_decision_path
                });
            });
        });
    });
};

var changePassword = function(req, res) {
    var currentPassword = req.param('currentPassword');
    var newPassword = req.param('newPassword');
    var newPasswordAgain = req.param('newPasswordAgain');

    if (!currentPassword || !newPassword || !newPasswordAgain) {
        return renderChangePasswordForm(res, 'Please fill out all three passwords before submitting.');
    }

    if (newPassword !== newPasswordAgain) {
        return renderChangePasswordForm(res, 'New password does not match confirmation, please try again.');
    }

    services.principals.authenticateUser(req.user.email, currentPassword, function(err, user) {
        if (err || !user) return renderChangePasswordForm(res, 'Please re-enter your current password and try again.');

        services.principals.changePassword(req.user, newPassword, function(err, principal, accessToken) {
            if (err) return utils.handleError(res, err);

            return renderLoginForm(res, 'Your password was changed: please login with your new password.');
        });
    });
};

var renderChangePasswordForm = function(res, error) {
    res.render('user/changePassword', {
        error: error,
        user_change_password_path: config.user_change_password_path
    });
};

var changePasswordForm = function(req, res) {
    return renderChangePasswordForm(res);
};

var create = function(req, res) {
    var name = req.param('name');
    var email = req.param('email');
    var password = req.param('password');

    if (!name || !email || !password) {
        return renderCreateForm(res, "Please enter your full name, an email, and a password.");
    }

    var user = new models.Principal({
        type: 'user',
        name: name,
        email: email,
        password: password
    });

    services.principals.create(user, function(err, user) {
        if (err) return renderCreateForm(res, err);

        return logInAndRedirect(req, res, user);
    });
};

var renderCreateForm = function(res, error) {
    res.render('user/create', {
        error: error,
        user_create_path: config.user_create_path,
        user_reset_password_path: config.user_reset_password_path,
        user_login_path: config.user_login_path
    });
};

var createForm = function(req, res) {
    return renderCreateForm(res);
};

var decision = function(req, res) {
    var code = req.param('code');
    var authorized = (req.param('authorize') !== undefined);

    services.authCodes.check(code, req.user, function(err, authCode) {
        if (err) return utils.handleError(res, err);

        if (authorized) {
            var app = new models.Principal({
                type: 'app',
                api_key: authCode.api_key,
                parent: authCode.principal,
                name: authCode.name
            });

            services.principals.create(app, function(err, app) {
                if (err) return utils.handleError(res, err);

                // TODO: in the future: implement full OAuth2 permission request/grant cycle.

                var permission = new models.Permission({
                    action: 'impersonate',
                    authorized: true,
                    issued_to: app.id,
                    principal_for: req.user.id,
                    priority: models.Permission.DEFAULT_PRIORITY_BASE
                });

                services.permissions.create(req.user, permission, function(err) {
                    if (err) return utils.handleError(res, err);

                    return redirectWithSession(res, app, authCode.redirect_uri);
                });

            });
        }
    });
};

var renderLoginForm = function(res, error) {
    res.render('user/login', {
        error: error,
        user_create_path: config.user_create_path,
        user_reset_password_path: config.user_reset_password_path,
        user_login_path: config.user_login_path
    });
};

var login = function(req, res) {
    var email = req.param('email');
    var password = req.param('password');

    if (!email || !password) {
        return renderLoginForm(res, "Please enter your email and password to login.");
    }

    services.principals.authenticateUser(email, password, function (err, user) {
        if (err || !user) return renderLoginForm(res, 'Either your email or password were not correct. Please try again.');

        return logInAndRedirect(req, res, user);
    });
};

var logInAndRedirect = function(req, res, user) {
    req.logIn(user, function(err) {
        if (err) return renderLoginForm(res, err);

        return res.redirect(req.session.returnTo || config.default_user_redirect);
    });
};

var loginForm = function(req, res) {
    return renderLoginForm(res);
};

var redirectWithSession = function(res, app, redirectUri) {
    services.accessTokens.findOrCreateToken(app, function (err, accessToken) {
        if (err) return res.redirect(redirectUri);

        res.redirect(redirectUri + "?principal=" + encodeURI(JSON.stringify(app.toObject())) +
                                   "&accessToken=" + encodeURI(JSON.stringify(accessToken.toObject())));
    });
};

var resetPassword = function(req, res) {
    var email = req.param('email');

    if (!email) return renderResetPasswordForm(res, "Please enter an email to reset your password.");

    services.principals.find(services.principals.servicePrincipal, { email: email }, function(err, principals) {
        if (err) return renderResetPasswordForm(res, err);
        if (principals.length < 1) return renderResetPasswordForm(res, 'User with email "' + email + '" not found.');

        services.principals.resetPassword(services.principals.servicePrincipal, principals[0], function(err) {
            if (err) return utils.handleError(res, err);

            return renderLoginForm(res, 'Your password was reset: please check your email for instructions.');
        });
    });
};

var renderResetPasswordForm = function(res, error) {
    res.render('user/resetPassword', {
        error: error,
        user_create_path: config.user_create_path,
        user_reset_password_path: config.user_reset_password_path,
        user_login_path: config.user_login_path
    });
};

var resetPasswordForm = function(req, res) {
    renderResetPasswordForm(res);
};

module.exports = {
    authorize:              authorize,
    changePassword:         changePassword,
    changePasswordForm:     changePasswordForm,
    create:                 create,
    createForm:             createForm,
    decision:               decision,
    login:                  login,
    loginForm:              loginForm,
    resetPassword:          resetPassword,
    resetPasswordForm:      resetPasswordForm
};