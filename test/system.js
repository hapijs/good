// Load modules

var Lab = require('lab');
var Fs = require('fs');
var SystemMonitor = require('../lib/system');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('System Monitor', function () {

    it('throws an error when constructed without new', function (done) {

        var fn = function () {

            SystemMonitor.Monitor();
        };

        expect(fn).throws(Error, 'OSMonitor must be instantiated using new');
        done();
    });

    describe('#mem', function () {

        it('returns an object with the current memory usage', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.mem(function (err, mem) {

                expect(err).not.to.exist;
                expect(mem).to.exist;
                expect(mem.total).to.exist;
                expect(mem.free).to.exist;
                done();
            });
        });
    });
});