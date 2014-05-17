var app = require('../../server')
  , assert = require('assert')
  , config = require('../../config')
  , crypto = require('crypto')
  , fixtures = require('../fixtures')
  , io = require('socket.io-client')
  , models = require('../../models')
  , request = require('request')
  , services = require('../../services')
  , ursa = require('ursa');

describe('principals endpoint', function() {

    it('should create and fetch a device principal', function(done) {
        var keys = ursa.generatePrivateKey(config.public_key_bits, config.public_key_exponent);

        request.post(config.principals_endpoint,
            { json: { type: 'device',
                      tags: ['executes:cameraCommand', 'sends:image'],
                      api_key: fixtures.models.apiKeys.user.key,
                      public_key: keys.toPublicPem().toString('base64'),
                      name: "createTest" } }, function(post_err, post_resp, post_body) {
              assert.ifError(post_err);
              assert.equal(post_resp.statusCode, 200);

              assert(post_body.principal.claim_code);

              assert(post_body.principal.tags.length === 2);
              assert(post_body.principal.tags.indexOf('sends:image') !== -1);

              assert.equal(post_body.principal.name, "createTest");
              assert.ok(Date.now() < Date.parse(post_body.accessToken.expires_at));

              assert.equal(post_body.principal.id, post_body.accessToken.principal);

              var principalId = post_body.principal.id;
              var token = post_body.accessToken.token;

              request({ url: config.principals_endpoint + '/' + post_body.principal.id,
                        json: true,
                        headers: { Authorization: "Bearer " + post_body.accessToken.token } }, function(get_err, get_resp, get_body) {
                    assert.equal(get_err, null);
                    assert.equal(get_resp.statusCode, 200);

                    assert.equal(get_body.principal.secret, undefined);
                    assert.equal(get_body.principal.name, "createTest");
                    assert.equal(post_body.principal.salt, undefined);
                    assert.notEqual(get_body.principal.last_connection, undefined);
                    assert.notEqual(get_body.principal.last_ip, undefined);

                    done();
              });
        });
    });

    it('should be able to remove principal', function(done) {
        request.post(config.principals_endpoint, {
          json: { type: 'user',
                  email: 'deluser@server.org',
                  password: 'sEcReT55' } }, function(err, resp, body) {

            assert.ifError(err);
            assert.equal(resp.statusCode, 200);

            request.del({ url: config.principals_endpoint + "/" + body.principal.id,
                headers: { Authorization: "Bearer " + body.accessToken.token } }, function(err, resp, body) {
                assert.ifError(err);
                assert.equal(resp.statusCode, 200);

                done();
            });
        });
    });

    it('should reject requests for a principal without access token', function(done) {
        request({ url: config.principals_endpoint + '/' + fixtures.models.principals.device.id, json: true }, function(get_err, get_resp, get_body) {
            assert.equal(get_err, null);
            assert.equal(get_resp.statusCode, 401);
            done();
        });
    });

    it('should fetch all principals', function(done) {
        request.get({ url: config.principals_endpoint,
                      headers: { Authorization: fixtures.models.accessTokens.device.toAuthHeader() },
                      json: true }, function(err, resp, body) {

            assert.equal(resp.statusCode, 200);
            assert.equal(body.principals.length > 0, true);
            assert.notEqual(resp.headers['x-n2-set-access-token'], undefined);

            done();
        });
    });

    it('should fetch only user principals', function(done) {
        request.get({ url: config.principals_endpoint,
                      qs: { q: JSON.stringify({ type: 'user' }) },
                      headers: { Authorization: fixtures.models.accessTokens.user.toAuthHeader() },
                      json: true }, function(err, resp, body) {
            assert.equal(resp.statusCode, 200);
            assert.equal(body.principals.length > 0, true);

            body.principals.forEach(function(principal) {
                assert.equal(principal.type, 'user');
            });

            done();
        });
    });

    it ('should reject requests for index without access token', function(done) {
        request.get({ url: config.principals_endpoint }, function(err, resp, body) {
            assert.equal(resp.statusCode, 401);
            done();
        });
    });

    it('should login device principal', function (done) {
        var device = fixtures.models.principals.device;

        request.get({
            url: config.headwaiter_uri + "?principal_id=" + device.id,
            json: true
        }, function(err, resp, headwaiterBody) {
            assert.ifError(err);
            assert(headwaiterBody.nonce);

            var signer = crypto.createSign("RSA-SHA256");
            signer.update(headwaiterBody.nonce);
            var privateKeyBuf = new Buffer(device.private_key, 'base64');

            var signature = signer.sign(privateKeyBuf, "base64");

            request.post(config.principals_endpoint + '/publickey/auth', {
                headers: {
                    nonce: headwaiterBody.nonce,
                    signature: signature
                },
                json: true
            }, function(err, resp, body) {
                assert.ifError(err);

                assert.equal(resp.statusCode, 200);
                assert.notEqual(body.accessToken.token, undefined);

                assert.equal(Date.parse(body.principal.last_connection) > fixtures.models.principals.device.last_connection.getTime(), true);
                assert.notEqual(body.principal.last_ip, undefined);
                done();
            });
        });
    });

    it('should login user principal at legacy endpoint', function(done) {
        request.post(config.principals_endpoint + '/auth',
            { json: { type: 'user',
                      email: 'user@server.org',
                      password: 'sEcReT44' } }, function(err, resp, body) {
                assert.equal(resp.statusCode, 200);
                assert.notEqual(body.accessToken.token, undefined);

                assert.equal(Date.parse(body.principal.last_connection) > fixtures.models.principals.user.last_connection.getTime(), true);
                assert.notEqual(body.principal.last_ip, undefined);
                assert.equal(body.principal.password, undefined);

                done();
            });
    });

    it('should return failed authorization for wrong password', function(done) {
        request.post(config.principals_endpoint + '/auth', {
          json: {
              type: 'user',
              email: 'user@server.org',
              password: 'WRONGPASSWORD'
          }
        }, function(err, resp, body) {
            assert.equal(resp.statusCode, 401);
            assert.equal(body.accessToken, undefined);
            assert.notEqual(body.error, undefined);

            assert.equal(body.error.statusCode, 401);
            assert.notEqual(body.error.message, undefined);

            done();
        });
    });

    it('should allow updates to a principals name', function(done) {
        fixtures.models.principals.device.name = "my camera";

        request.put(config.principals_endpoint + "/" + fixtures.models.principals.device.id,
            { headers: { Authorization: fixtures.models.accessTokens.service.toAuthHeader() },
              json: fixtures.models.principals.device }, function(err, resp, body) {
                assert.ifError(err);
                assert.equal(resp.statusCode, 200);

                assert.equal(body.principal.name, "my camera");

                done();
            }
        );
    });

    it('should allow service to impersonate user principal', function(done) {
        request.post(config.principals_endpoint + '/impersonate',
            { headers: { Authorization: fixtures.models.accessTokens.service.toAuthHeader() },
              json: fixtures.models.principals.user }, function(err, resp, body) {
                assert.equal(resp.statusCode, 200);
                assert.notEqual(body.accessToken.token, undefined);

                if (resp.headers['x-n2-set-access-token']) {
                  var headerToken = JSON.parse(resp.headers['x-n2-set-access-token']);
                  assert.notEqual(headerToken.token, body.accessToken.token);
                }

                done();
            });
    });

    it('should allow user to impersonate anotherUser principal', function(done) {
        request.post(config.principals_endpoint + '/impersonate',
            { headers: { Authorization: fixtures.models.accessTokens.user.toAuthHeader() },
              json: fixtures.models.principals.anotherUser }, function(err, resp, body) {
                assert.equal(resp.statusCode, 200);
                assert.notEqual(body.accessToken.token, undefined);

                done();
            });
    });

    it('should not allow anotherUser to impersonate user principal', function(done) {
        request.post(config.principals_endpoint + '/impersonate',
            { headers: { Authorization: fixtures.models.accessTokens.anotherUser.toAuthHeader() },
              json: fixtures.models.principals.user }, function(err, resp, body) {
                assert.equal(resp.statusCode, 403);
                assert.equal(body.accessToken, undefined);

                done();
            });
    });

    it('should login user principal', function(done) {
        request.post(config.principals_endpoint + '/user/auth', {
            json: {
                type: 'user',
                email: 'anotheruser@server.org',
                password: 'sEcReTO66'
            }
        }, function(err, resp, body) {
            assert.equal(resp.statusCode, 200);
            assert.notEqual(body.accessToken.token, undefined);

            assert.equal(Date.parse(body.principal.last_connection) > fixtures.models.principals.user.last_connection.getTime(), true);
            assert.notEqual(body.principal.last_ip, undefined);
            assert.equal(body.principal.password, undefined);

            done();
        });
    });

    it('should return failed authorization for wrong password', function(done) {
        request.post(config.principals_endpoint + '/user/auth', {
          json: {
              type: 'user',
              email: 'user@server.org',
              password: 'WRONGPASSWORD'
          }
        }, function(err, resp, body) {
            assert.equal(resp.statusCode, 401);
            assert.equal(body.accessToken, undefined);
            assert.notEqual(body.error, undefined);

            assert.equal(body.error.statusCode, 401);
            assert.notEqual(body.error.message, undefined);

            done();
        });
    });

});
