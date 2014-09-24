// Load modules

var Lab = require('lab');
var Fs = require('fs');
var SystemMonitor = require('../lib/system');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Lab.expect;
var describe = lab.describe;
var it = lab.it;


describe('System Monitor', function () {

    describe('mem()', function () {

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
