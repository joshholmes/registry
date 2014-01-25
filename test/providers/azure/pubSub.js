var assert = require('assert')
  , config = require('../../../config')
  , fixtures = require('../../fixtures')
  , log = require('../../../log')
  , models = require('../../../models')
  , mongoose = require('mongoose')
  , providers = require('../../../providers')
  , services = require('../../../services')
  , utils = require('../../../utils');

describe('AzurePubSubProvider', function() {

    it('can build sql queries from json queries', function(done) {
        var jsonQuery1 = {
            "foo": "bar",
            "fee": "foo"
        };

        var sqlQuery1 = providers.azure.AzurePubSubProvider.sqlFromJsonQuery(jsonQuery1);
        assert.equal(sqlQuery1, "(foo='bar' AND fee='foo')");

        var jsonQuery2 = {
            "$and": [
                { "type": "cameraCommand" },
                { "$or": [
                        {"public": true},
                        {"visible_to": "xyz"}
                  ]
                }
           ],
           "foo": "bar"
        };

        var sqlQuery2 = providers.azure.AzurePubSubProvider.sqlFromJsonQuery(jsonQuery2);
        assert.equal(sqlQuery2, "(((type='cameraCommand') AND (((public=true) OR (visible_to_xyz=true)))) AND foo='bar')");

        var jsonQuery3 = {};
        var sqlQuery3 = providers.azure.AzurePubSubProvider.sqlFromJsonQuery(jsonQuery3);
        assert.equal(sqlQuery3, '');

        var jsonQuery4 = {
          "$and": [
            {
              "$and": [
                {
                  "$or": [
                    {
                      "to": "52e2bc776625b7c00d0019d6"
                    },
                    {
                      "from": "52e2bc776625b7c00d0019d6"
                    }
                  ]
                },
                {
                  "$or": [
                    {
                      "type": "lightCommand"
                    },
                    {
                      "type": "lightState"
                    }
                  ]
                }
              ]
            },
            {
              "$or": [
                {
                  "public": true
                },
                {
                  "visible_to": "52e2bc776625b7c00d0019d6"
                }
              ]
            }
          ]
        };

        var sqlQuery4 = providers.azure.AzurePubSubProvider.sqlFromJsonQuery(jsonQuery4);
        assert.equal(sqlQuery4, "(((((((to='52e2bc776625b7c00d0019d6') OR (from='52e2bc776625b7c00d0019d6'))) AND (((type='lightCommand') OR (type='lightState'))))) AND (((public=true) OR (visible_to_52e2bc776625b7c00d0019d6=true)))))");

        done();
    });

});