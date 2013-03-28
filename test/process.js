// Load modules

var Lab = require('lab');
var ChildProcess = require('child_process');
var Sinon = require('sinon');
var ProcessMonitor = require('../lib/process');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('Process Monitor', function () {

    it('throws an error when constructed without new', function (done) {

        var fn = function () {

            ProcessMonitor.Monitor();
        };
        expect(fn).throws(Error, 'ProcessMonitor must be instantiated using new');
        done();
    });

    describe('#cpu', function () {

        it('passes the current cpu usage to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor();
            monitor.cpu(function (err, cpu) {

                expect(err).not.to.exist;
                expect(cpu).to.exist;
                done();
            });
        });

        it('passes any errors to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor();
            var args = 'ps -eo pcpu,pid | grep ' + process.pid + ' | awk \'{print $1}\'';

            var execStub = Sinon.stub(ChildProcess, 'exec');
            execStub.withArgs(args).callsArgWith(1, new Error());

            monitor.cpu(function (err, cpu) {

                expect(err).to.exist;
                execStub.restore();
                done();
            });
        });
    });

    describe('#memory', function () {

        it('passes the current memory usage to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor();
            monitor.memory(function (err, mem) {

                expect(err).not.to.exist;
                expect(mem).to.exist;
                done();
            });
        });
    });

    describe('#delay', function () {

        it('passes the current event queue delay to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor();
            monitor.delay(function (err, delay) {

                expect(err).not.to.exist;
                expect(delay).to.exist;
                done();
            });
        });
    });
});