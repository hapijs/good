// Load modules

var Fs = require('fs');
var Lab = require('lab');
var ProcessMonitor = require('../lib/process');
var Utils = require('../lib/utils');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Utils', function () {

    describe('inheritAsync', function () {

        it('handles null keys', function (done) {

            var test = {}; 
            Utils.inheritAsync(test, {});
            expect(test.keys).not.to.exist;
            done();
        });

    });
});
