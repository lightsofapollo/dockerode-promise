suite("dockerode-promise", function() {
  var Docker = require('./');
  var assert = require('assert');

  var docker = new Docker({
    socketPath: '/var/run/docker.sock'
  });

  test("docker.info", function() {
    return docker.info();
  });

  test("docker.createVolume", function() {
    return docker.createVolume({
      Name: 'dockerode-promise-test',
    }).then(function(volume) {
      assert.equal(volume.name, 'dockerode-promise-test');
    });
  });

  test("docker.getVolume", function() {
    const volumeRef = docker.getVolume('dockerode-promise-test')
    return volumeRef.inspect().then(function (volume) {
      assert.equal(volume.Name, 'dockerode-promise-test');
      assert.equal(volume.Driver, 'local');
      assert.equal(volume.Mountpoint, '/var/lib/docker/volumes/dockerode-promise-test/_data');
      assert.equal(volume.Label, null);
    });
  });

  test("docker.createContainer", function() {
    return docker.createContainer({
      Image: 'busybox',
      Cmd: ['true'],
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false
    }).then(function(container) {
      assert(container.id);
      return container.start().then(function() {
        return docker.getContainer(container.id);
      }).then(function(container) {
        return container.wait();
      }).then(function() {
        return container.remove({force: true, v: true});
      });
    })
  });

  test("container.exec", function() {
    var container = null;
    return docker.createContainer({
      Image: 'busybox',
      Cmd: ['sleep', '30'],
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false
    }).then(function(container_) {
      container = container_;
      return container.start();
    }).then(function() {
      return container.exec({
        Cmd: ['echo', 'hello'],
        Tty: true,
        Detach: false,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true
      });
    }).then(function(exec) {
      return exec.start({
        stdin: true,
        stdout: true,
        stderr: true,
        stream: true,
      }).then(function(result) {
        return new Promise(function(accept) {
          var output = "";
          result.on('data', function(data) {
            output += data.toString('utf-8')
          });
          result.once('end', function() {
            accept(output);
          });
        });
      }).then(function(data) {
        assert(data.indexOf('hello') !== -1, "Expected to see hello");
      });
    }).then(function() {
      return container.remove({force: true, v: true});
    });
  });
});
