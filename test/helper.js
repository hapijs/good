'use strict';

const internals = {};

module.exports = internals.Reporter = function (events, config, datahandler) {

    this.events = events;
    this.messages = [];
    this.handler = datahandler || function () {};
};

internals.Reporter.prototype.init = function (stream, emitter, callback) {

    const self = this;

    stream.on('data', (data) => {

        if (self.events[data.event]) {
            self.messages.push(data);
            self.handler(data);
        }
    });

    emitter.once('stop', () => {

        self.stopped = true;
    });

    callback();
};
