// Load modules

var Lab = require('lab');
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

            var monitor = new ProcessMonitor.Monitor({ leakDetection: true });
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

            var monitor = new ProcessMonitor.Monitor({ leakDetection: false });
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

    describe('#gc', function () {

        it('passes the current gc count to the callback', function (done) {

            var monitor = new ProcessMonitor.Monitor({ gcDetection: true });
            MemWatch.emit('stats', {
                start: 'Fri, 29 Jun 2012 14:12:13 GMT',
                end: 'Fri, 29 Jun 2012 14:12:33 GMT',
                growth: 67984,
                reason: 'heap growth over 5 consecutive GCs (20s) - 11.67 mb/hr'
            });

            monitor.gcCount(function (err, count) {

                expect(count).to.equal(1);
                done();
            });
        });
    });
});