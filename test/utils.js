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

        it('handles a null request and response', function (done) {

            var greatWreck = new Utils.GreatWreck();
            expect(greatWreck.request).to.exist();
            expect(greatWreck.response).to.exist();
            done();
        });

        it('reports on errors', function (done) {

            var error = new Error('my error');
            var greatWreck = new Utils.GreatWreck(error);

            expect(greatWreck.error.message).to.equal('my error');
            done();
        });
    });
});
