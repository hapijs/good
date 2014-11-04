// Load modules

var Lab = require('lab');
var Fs = require('fs');
var Utils = require('../lib/utils');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Lab.expect;
var describe = lab.describe;
var it = lab.it;


describe('utils', function () {

    describe('makeContinuation()', function () {

        it('successfully creates a continuation function', function (done) {

            var method = Utils.makeContinuation(function() {
                return true;
            });

            method(function (err, value) {

                expect(err).to.not.exist;
                expect(value).to.be.true;
                done();
            });
        });
    });
});
