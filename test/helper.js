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

        stream.on('end', () => {

            this.stopped = true;
        });

        process.nextTick(callback);
    }
}

module.exports = Reporter;
