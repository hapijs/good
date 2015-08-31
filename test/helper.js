var internals = {};

module.exports.getTestReporter = function () {

    var Reporter = function (events, config, datahandler) {

        this.events = events;
        this.messages = [];
        this.handler = datahandler || function () {};

        // Properties to assert against
        this.initHitCount = 0;
        this.emitters = [];

        Reporter.instance = this;
    };

    Reporter.prototype.init = function (stream, emitter, callback) {

        var self = this;

        this.initHitCount++;
        this.emitters.push(emitter);

        stream.on('data', function (data) {

            if (self.events[data.event]) {
                self.messages.push(data);
                self.handler(data);
            }
        });

        emitter.once('stop', function () {

            self.stopped = true;
        });

        callback();
    };

    Reporter.attributes = {
        name: 'test-reporter'
    };

    return Reporter;
};
