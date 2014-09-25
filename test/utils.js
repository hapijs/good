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

    describe('inheritAsync()', function () {

        it('successfully creates an object wrapper', function (done) {

            var obj = new Function();
            var source = {
                success: function() {
                    return true;
                }
            };

            Utils.inheritAsync(Function, source);

            obj.success(function (error, result) {

                expect(error).to.not.exist;
                expect(result).to.equal(true);

                done();
            });
        });

        it('successfully returns an error', function (done) {

            var obj = new Function();
            var source = {
                success: function() {
                    throw new Error('not successful');
                }
            };

            Utils.inheritAsync(Function, source);

            obj.success(function (error, result) {

                expect(error).to.exist;
                expect(error.message).to.equal('not successful');
                expect(result).to.not.exist;

                done();
            });
        });
    });
});
