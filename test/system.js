// Load modules

var Lab = require('lab');
var Fs = require('fs');
var Sinon = require('sinon');
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

    describe('#poll_cpu', function () {

        it('returns an error if a target is omitted', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu(null, function (err) {

                expect(err).to.exist;
                done();
            });
        });

        it('returns an error if the target is invalid', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('invalid', function (err) {

                expect(err).to.be.instanceOf(Error);
                done();
            });
        });

        it('returns cpu usage totals for all cores', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('cpu', function (err, stats) {

                expect(err).to.not.exist;
                expect(stats.idle).to.exist;
                expect(stats.total).to.exist;
                done();
            });
        });

        it('returns cpu usage', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('cpu0', function (err, stats) {

                expect(err).to.not.exist;
                expect(stats.idle).to.exist;
                expect(stats.total).to.exist;
                done();
            });
        });

        it('returns error when cpu target not found', function (done) {

            var monitor = new SystemMonitor.Monitor();

            monitor.poll_cpu('notfound', function (err, stats) {

                expect(err).to.be.instanceOf(Error);
                expect(stats).not.to.exist;
                done();
            });
        });
    });

    describe('#cpu', function () {

        it('returns cpu usage delta', function (done) {

            var firstRun = true;
            var monitor = new SystemMonitor.Monitor();
            var pollStub = Sinon.stub(SystemMonitor.Monitor.prototype, 'poll_cpu', function (err, callback) {

                if (firstRun) {
                    firstRun = false;

                    return callback(null, {
                        idle: 1765610273,
                        total: 1974415361
                    });
                }

                return callback(null, {
                    idle: 1765613273,
                    total: 1994415361
                });
            });

            monitor.cpu(function (err, stats) {

                pollStub.restore();
                expect(stats).to.equal('99.98');
                expect(err).to.not.exist;
                done();
            });
        });
    });
});