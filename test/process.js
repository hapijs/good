// Load modules

var Lab = require('lab');
var ChildProcess = require('child_process');
var Sinon = require('sinon');
var MemWatch = require('memwatch');
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

    describe('#leaks', function () {

        it('passes the current list of leaks to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor(true);
            MemWatch.emit('leak', {
                start: 'Fri, 29 Jun 2012 14:12:13 GMT',
                end: 'Fri, 29 Jun 2012 14:12:33 GMT',
                growth: 67984,
                reason: 'heap growth over 5 consecutive GCs (20s) - 11.67 mb/hr'
            });

            expect(monitor._leaks.length).to.equal(1);
            monitor.leaks(function (err, leaks) {

                expect(leaks.length).to.equal(1);
                expect(monitor._leaks.length).to.equal(0);
                done();
            });
        });

        it('doesn\'t log leaks when disabled', function (done) {

            var monitor = new ProcessMonitor.Monitor(false);
            MemWatch.emit('leak', {
                start: 'Fri, 29 Jun 2012 14:12:13 GMT',
                end: 'Fri, 29 Jun 2012 14:12:33 GMT',
                growth: 67984,
                reason: 'heap growth over 5 consecutive GCs (20s) - 11.67 mb/hr'
            });

            expect(monitor._leaks.length).to.equal(0);
            monitor.leaks(function (err, leaks) {

                expect(leaks.length).to.equal(0);
                expect(monitor._leaks.length).to.equal(0);
                done();
            });
        });
    });
});