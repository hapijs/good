'use strict';

const internals = {};

class Reporter {
    constructor(events, config, datahandler) {

        this.events = events;
        this.messages = [];
        this.handler = datahandler || function () {};
    }
    init(stream, emitter, callback) {

        stream.on('data', (data) => {

            if (this.events[data.event]) {
                this.messages.push(data);
                this.handler(data);
            }
        });

        emitter.once('stop', () => {

            this.stopped = true;
        });

        callback();
    }
}

module.exports = Reporter;
