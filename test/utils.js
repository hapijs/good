'use strict';

// Load modules

const Code = require('code');
const Lab = require('lab');
const Utils = require('../lib/utils');


// Test shortcuts

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;


describe('utils', () => {

    describe('GreatWreck()', () => {

        it('handles a null request and response', (done) => {

            const greatWreck = new Utils.GreatWreck();
            expect(greatWreck.request).to.exist();
            expect(greatWreck.response).to.exist();
            done();
        });

        it('reports on errors', (done) => {

            const error = new Error('my error');
            const greatWreck = new Utils.GreatWreck(error);

            expect(greatWreck.error.message).to.equal('my error');
            done();
        });

        it('contains the current pid', (done) => {

            const greatWreck = new Utils.GreatWreck();

            expect(greatWreck.pid).to.equal(process.pid);
            done();
        });
    });

    describe('GreatResponse()', () => {

        const generateGreatResponse = (requestPayload, responsePayload, nullResponse) => {

            const filterRules = {
                password: 'censor'
            };

            const options = {
                requestHeaders: true,
                requestPayload: true,
                responsePayload: true
            };

            const request = {
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
                payload: requestPayload,
                response: nullResponse ? null : {
                    source: responsePayload
                },
                getLog: () => {

                    return {};
                }
            };
            return new Utils.GreatResponse(request, options, filterRules);
        };

        it('handles empty request payloads', (done) => {

            const sampleResponsePayload = { message: 'test' };
            generateGreatResponse(null, sampleResponsePayload);
            generateGreatResponse({}, sampleResponsePayload);
            generateGreatResponse(undefined, sampleResponsePayload);
            generateGreatResponse('string payload', sampleResponsePayload);
            generateGreatResponse('', sampleResponsePayload);
            done();
        });

        it('handles empty response payloads', (done) => {

            const sampleRequestPayload = { message: 'test' };
            generateGreatResponse(sampleRequestPayload, null);
            generateGreatResponse(sampleRequestPayload, {});
            generateGreatResponse(sampleRequestPayload, undefined);
            generateGreatResponse(sampleRequestPayload, 'string payload');
            generateGreatResponse(sampleRequestPayload, '');
            generateGreatResponse(sampleRequestPayload, null, true);
            done();
        });

        it('handles response payloads with a toString() function', (done) => {

            const samplePayload = {
                message: 'test',
                toString: () => {

                }
            };

            generateGreatResponse(samplePayload, '');
            generateGreatResponse('', samplePayload);
            done();
        });
    });
});
