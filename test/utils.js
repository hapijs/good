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
            logs: {}
        };

        const _server = {
            settings: {
                labels: []
            },
            info: {
                uri: 'http://localhost:3000'
            }
        };

        const generateRequestSent = (requestPayload, responsePayload, nullResponse) => {

            const reqOpts = {
                headers: true,
                payload: true
            };

            const resOpts = {
                payload: true
            };

            const request = Hoek.clone(_request);
            request.payload = requestPayload;
            request.response = nullResponse ? null : {
                source: responsePayload
            };

            return new Utils.RequestSent(reqOpts, resOpts, request, _server);
        };

        it('handles response payloads with a toString() function', { plan: 2 }, () => {

            const samplePayload = {
                message: 'test',
                toString: () => {

                }
            };

            const req = generateRequestSent(samplePayload, '');
            expect(req.requestPayload).to.equal(samplePayload);
            const res = generateRequestSent('', samplePayload);
            expect(res.responsePayload).to.equal(samplePayload);
        });
    });

    describe('RequestLog()', () => {

        it('accepts error on the event object when data is not present', { plan: 2 }, () => {

            const errorInstance = new Error('This is a test');

            const err = new Utils.RequestLog({}, {
                info: {
                    id: 32
                },
                method: 'post',
                path: '/graph',
                config: {}
            }, {
                event: 'request',
                timestamp: 1517592924723,
                tags: ['error', 'authentication'],
                error: errorInstance
            });

            expect(err.error).to.equal(errorInstance);
            expect(err.data).to.be.undefined();

        });

        it('accepts data on the event object when error is not present', { plan: 2 }, () => {

            const sampleData = { foo: 'bar' };

            const err = new Utils.RequestLog({}, {
                info: {
                    id: 32
                },
                method: 'post',
                path: '/graph',
                config: {}
            }, {
                event: 'request',
                timestamp: 1517592924723,
                tags: ['error', 'authentication'],
                data: sampleData
            });

            expect(err.data).to.equal(sampleData);
            expect(err.error).to.be.undefined();

        });

    });

    describe('RequestError()', () => {

        it('can be stringifyed', { plan: 1 }, () => {

            const err = new Utils.RequestError({}, {
                id: 15,
                url: 'http://localhost:9001',
                method: 'PUT',
                pid: 99,
                info: {
                    received: Date.now()
                }
            }, {
                'error': {
                    isBoom: true,
                    isServer: true,
                    data: null,
                    output: {
                        statusCode: 500,
                        payload: {
                            statusCode: 500,
                            error: 'Internal Server Error',
                            message: 'An internal server error occurred'
                        },
                        headers: {}
                    }
                }
            });

            const parse = JSON.parse(JSON.stringify(err));
            expect(parse.error).to.equal('An internal server error occurred');
        });
    });
});
