var assert = require('assert')
  , config = require('../../../config')
  , providers = require('../../../providers')
  , services = require('../../../services');

if (config.email_provider instanceof providers.sendgrid.SendgridEmailProvider) {

    describe('Sendgrid email provider', function() {
        it('can send an email', function(done) {
        	var email = {
        		to: 'test@nitrogen.io',
        		from: 'service@nitrogen.io',
        		subject: 'test',
        		text: 'this is a test body'
        	};

        	services.email.send(email, function(err, json) {
        		assert.ifError(err);

                assert.equal(json.message, 'success');
 
        		done();
        	});
        });
    });
}