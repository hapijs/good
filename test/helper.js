var internals = {};

module.exports = internals.Reporter = function (events, config, datahandler) {

    this.events = events;
    this.messages = [];
    this.handler = datahandler || function () {};
};

internals.Reporter.prototype.init = function (stream, emitter, callback) {

    stream.on('data', function (data) {

      if (this.events[data.event]) {
        this.messages.push(data);
        this.handler(data);
      }
    }.bind(this));

    emitter.once('stop', function () {

      this.stopped = true;
    }.bind(this));

    callback();
};
