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

    describe('RequestSent()', () => {

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
            route: {
                method: 'POST',
                path: '/',
                realm: {},
                settings: {}
            },
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

        const generateRequestSent = (requestPayload, responsePayload, nullResponse) => {

            const reqOpts = {
                headers: true,
                payload: true,
                auth: true
            };

            const resOpts = {
                payload: true
            };

            const request = Hoek.clone(_request);
            request.payload = requestPayload;
            request.response = nullResponse ? null : {
                source: responsePayload
            };

            return new Utils.RequestSent(reqOpts, resOpts, request);
        };

        it('handles response payloads with a toString() function', { plan: 2 }, (done) => {

            const samplePayload = {
                message: 'test',
                toString: () => {

                }
            };

            const req = generateRequestSent(samplePayload, '');
            expect(req.requestPayload).to.equal(samplePayload);
            const res = generateRequestSent('', samplePayload);
            expect(res.responsePayload).to.equal(samplePayload);
            done();
        });
    });

    describe('RequestError()', () => {

        it('can be stringifyed', { plan: 2 }, (done) => {

            const err = new Utils.RequestError({
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

    describe('WreckResponse()', () => {

        const keysUndefined = (obj) => {

            const keys = Object.keys(obj);
            for (let i = 0; i < keys.length; ++i) {
                const key = keys[i];
                expect(obj[key]).to.be.undefined();
            }
        };

        it('creates a default response and uri values in case they are missing', (done) => {

            const wreckValue = new Utils.WreckResponse(null, {}, null, Date.now());
            keysUndefined(wreckValue.request);
            keysUndefined(wreckValue.response);
            expect(wreckValue.event).to.equal('wreck');
            expect(wreckValue.timeSpent).to.be.a.number();
            done();
        });

        it('attaches an error object in the event of a wreck error', (done) => {

            const wreckValue = new Utils.WreckResponse(new Error('test error'), {}, null, Date.now());
            expect(wreckValue.error.stack).to.be.a.string();
            expect(wreckValue.error.message).to.equal('test error');
            done();
        });
    });
});
