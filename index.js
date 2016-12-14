const Docker = require('dockerode');

var wrappedProto = Docker.prototype;

function denodeify(func) {
  return function(...args) {
    return new Promise((resolve, reject) => {
      let input = [...args, (err, val) => err ? reject(err) : resolve(val)];
      func.apply(this, input);
    });
  }
}

function proxyPromise (method) {
  var promisey = denodeify(method);
  return function() {
    return promisey.apply(this.$subject, arguments);
  };
}

function promiseObj(target, input) {
  for (var key in input) {
    if (typeof input[key] !== 'function') continue;
    target[key] = proxyPromise(input[key]);
  }
  return target;
}

function PromiseProxy(subject) {
  var result = Object.create(subject);
  result.$subject = subject;
  return promiseObj(result, subject);
}

function ContainerProxy(subject) {
  var result = PromiseProxy(subject);
  var exec = result.exec;
  result.exec = function() {
    return exec.apply(this, arguments).then(function(exec) {
      return PromiseProxy(exec);
    });
  }
  return result;
}

function DockerProxy(options) {
  this.$subject = new Docker(options);
}

promiseObj(DockerProxy.prototype, wrappedProto);

// sadly we need to wrap run directly as a promise to consolidate both
// of the resulting arguments.
DockerProxy.prototype.run = function() {
  var subject = this.$subject;
  var args = Array.prototype.slice.call(arguments);
  while(args.length && args.length < subject.run.length - 1) {
    args.push(undefined);
  }
  return new Promise(function(accept, reject) {
    args.push(function(err, result, container) {
      if (err) return reject(err);
      accept({
        result: result,
        // re-wrap
        container: ContainerProxy(container)
      })
    });
     subject.run(...args);
  });
};

// We also have wrap createContainer manually as it returns
DockerProxy.prototype.createContainer = function(opts) {
  var subject = this.$subject;
  return new Promise(function(accept, reject) {
    subject.createContainer(opts, function(err, container) {
      if (err) return reject(err);
      accept(ContainerProxy(container));
    });
  });
};

DockerProxy.prototype.getImage = function (id) {
  return PromiseProxy(this.$subject.getImage(id));
};

DockerProxy.prototype.getContainer = function (id) {
  return ContainerProxy(this.$subject.getContainer(id));
};

DockerProxy.prototype.getVolume = function (name) {
  return PromiseProxy(this.$subject.getVolume(name));
};

module.exports = DockerProxy;
