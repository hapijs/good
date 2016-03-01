'use strict';

// Load modules

const Code = require('code');
const Lab = require('lab');
const Hoek = require('hoek');
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

        const _request = {
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
            getLog: () => {

                return {};
            }
        };

        const generateGreatResponse = (requestPayload, responsePayload, nullResponse) => {

            const options = {
                requestHeaders: true,
                requestPayload: true,
                responsePayload: true
            };

            const request = Hoek.clone(_request);
            request.payload = requestPayload;
            request.response = nullResponse ? null : {
                source: responsePayload
            };

            return new Utils.GreatResponse(options, request);
        };

        it('handles response payloads with a toString() function', (done) => {

            const samplePayload = {
                message: 'test',
                toString: () => {

                }
            };

            const req = generateGreatResponse(samplePayload, '');
            expect(req.requestPayload).to.deep.equal(samplePayload);
            const res = generateGreatResponse('', samplePayload);
            expect(res.responsePayload).to.deep.equal(samplePayload);
            done();
        });
    });

    describe('GreatError()', () => {

        it('can base stringifyed', (done) => {

            const err = new Utils.GreatError({
                id: 15,
                url: 'http://localhost:9001',
                method: 'PUT',
                pid: 99,
                info: {
                    received: Date.now()
                }
            }, new Error('mock error'));

            const parse = JSON.parse(JSON.stringify(err));
            expect(parse.error).to.be.an.object();
            expect(parse.error.stack).to.be.a.string();
            done();
        });
    });
});
