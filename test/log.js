// Load modules

var Chai = require('chai');
var Helpers = require('./helpers');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Log', function () {

    describe('#event', function () {

        it('fires an event with the passed in tags', function (done) {

            var tags = ['hello'];
            Helpers.log.once('log', function (event) {

                expect(event).to.exist;
                expect(event.tags).to.exist;
                expect(event.tags[0]).to.equal('hello');
                done();
            });
            Helpers.log.event(tags, null, Date.now());
        });

        it('outputs to stdout if no listeners exist', function (done) {

            var tags = ['hello'];
            Helpers._TEST.once('log', function (output) {

                expect(output).to.contain('hello');
                done();
            });

            Helpers.log.event(tags, null, Date.now());
        });
    });

    describe('#print', function () {

        it('outputs correct text to stdout', function (done) {

            var event = {
                tags: ['tag1'],
                data: 'test'
            };

            Helpers._TEST.once('log', function (output) {

                expect(output).to.contain('test');
                expect(output).to.contain('tag1');
                done();
            });

            Helpers.log.print(event, false);
        });

        it('outputs correct error text to stdout', function (done) {

            var event = {
                tags: ['tag1'],
                data: { a: 1 }
            };
            event.data.b = event.data;

            Helpers._TEST.once('log', function (output) {

                expect(output).to.contain('JSON Error');
                done();
            });

            Helpers.log.print(event, false);
        });
    });
});