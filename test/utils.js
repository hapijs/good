// Load modules

var Code = require('code');
var Lab = require('lab');
var Utils = require('../lib/utils');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Code.expect;
var describe = lab.describe;
var it = lab.it;


describe('utils', function () {

    describe('makeContinuation()', function () {

        it('successfully creates a continuation function', function (done) {

            var method = Utils.makeContinuation(function () {

                return true;
            });

            method(function (err, value) {

                expect(err).to.not.exist();
                expect(value).to.be.true();
                done();
            });
        });
    });

    describe('GreatWreck()', function () {

        var options = {
            reqHeaders: [],
            reqPayload: [],
            resHeaders: [],
            resPayload: []
        };

        it('handles a null request and response', function (done) {

            var greatWreck = new Utils.GreatWreck(null, null, null, new Date(), null, options, null);
            expect(greatWreck.request).to.exist();
            expect(greatWreck.response).to.exist();
            done();
        });

        it('reports on errors', function (done) {

            var error = new Error('my error');
            var greatWreck = new Utils.GreatWreck(error, null, null, new Date(), null, options, null);

            expect(greatWreck.error.message).to.equal('my error');
            done();
        });
    });

    describe('GreatResponse()', function () {

        var generateGreatResponse = function (reqPayload, resPayload, nullResponse) {

            var filterRules = {
                password: 'censor'
            };

            var options = {
                reqHeaders: ['response'],
                reqPayload: ['response'],
                resPayload: ['response'],
                resHeaders: ['response']
            };

            var request = {
                id: '1429974169154:localhost:10578:i8x5ousn:10000',
                raw: {
                    req: {
                        headers: {
                            'user-agent': 'Paw/2.2.1 (Macintosh; OS X/10.10.3) GCDHTTPRequest'
                        }
                    },
                    res: {
                        statusCode: 200
                    }
                },
                info: {
                    received: 1429974169154,
                    remoteAddress: '127.0.0.1'
                },
                method: 'POST',
                path: '/',
                query: {},
                responseTime: 123,
                connection: {
                    settings: {
                        labels: []
                    },
                    info: {
                        uri: 'http://localhost:3000'
                    }
                },
                payload: reqPayload,
                response: nullResponse ? null : {
                    source: resPayload
                },
                getLog: function () {

                    return {};
                }
            };
            return new Utils.GreatResponse(request, options, filterRules);
        };

        it('handles empty request payloads', function (done) {

            var sampleresPayload = { message: 'test' };
            generateGreatResponse(null, sampleresPayload);
            generateGreatResponse({}, sampleresPayload);
            generateGreatResponse(undefined, sampleresPayload);
            generateGreatResponse('string payload', sampleresPayload);
            generateGreatResponse('', sampleresPayload);
            done();
        });

        it('handles empty response payloads', function (done) {

            var samplereqPayload = { message: 'test' };
            generateGreatResponse(samplereqPayload, null);
            generateGreatResponse(samplereqPayload, {});
            generateGreatResponse(samplereqPayload, undefined);
            generateGreatResponse(samplereqPayload, 'string payload');
            generateGreatResponse(samplereqPayload, '');
            generateGreatResponse(samplereqPayload, null, true);
            done();
        });

        it('handles response payloads with a toString() function', function (done) {

            var samplePayload = {
                message: 'test',
                toString: function () {

                }
            };

            generateGreatResponse(samplePayload, '');
            generateGreatResponse('', samplePayload);
            done();
        });
    });
});
