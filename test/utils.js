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

            return new Utils.RequestSent(reqOpts, resOpts, request);
        };

        it('handles response payloads with a toString() function', { plan: 2 }, (done) => {

            const samplePayload = {
                message: 'test',
                toString: () => {

                }
            };

            const req = generateRequestSent(samplePayload, '');
            expect(req.requestPayload).to.deep.equal(samplePayload);
            const res = generateRequestSent('', samplePayload);
            expect(res.responsePayload).to.deep.equal(samplePayload);
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
});
