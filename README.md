# Nitrogen Service

Nitrogen is a platform for building connected devices.  Nitrogen provides the authentication, authorization, and realtime messaging platform so that you can focus on your device and/or application.  All with a consistent development platform that leverages the ubiquity of Javascript.  You can learn more about the project's goals at a high level from [my talk at LXJS.](https://www.youtube.com/watch?v=xV0x3boaZwU) and how to get started [on the project site](http://nitrogen.io).

## Device Development Model

Nitrogen at its heart uses messaging between principals. Messages can follow a well known schema to enable interoperability between applications or use their own private custom message types for specialized applications. Devices and applications follow and send messages to each other in a manner you can think of mentally as "Twitter for Devices."

For example, let's say that you wanted to build a connected camera using Nitrogen.  In Nitrogen, this would look something like this:

``` javascript
var service = new nitrogen.Service(config);

var camera = new RaspberryPiCamera({
      nickname: 'living_room',
      width: 1024,
      height: 768
});

service.connect(config.camera, function(err, session, camera) {
    if (err) { return console.log('failed to connect camera: ' + err); }

    // startup camera manager that watches the message stream for this camera.
    new CameraManager(camera).start(session, function(err, message) {
        if (err) return session.log.error(JSON.stringify(err));
    });

    callback();
});
```

The service.connect() call in this example handles all the authentication and realtime communication details and encapsulates these in a session object that you subsequently use to communicate with a Nitrogen service.

It also starts up a CommandManager for the camera.  A CommandManager in Nitrogen follows the message stream for the device and reacts to commands sent to it by typically controlling a device associated with it.  In this case, we are starting a CameraManager and passing in a Nitrogen device for a Raspberry Pi camera.  This manager will watch for cameraCommand messages and execute them against this camera.

By including a CommandManager module in your Nitrogen service's package.json, you can mix in the commands you want your service to support. The Nitrogen project maintains a set of commands in the [commands](http://github.com/nitrogenjs/commands) project but you are free to define your own and mix them in as well. Have a look at the definition of one of these command packages and package.json for the service project for a template for how to do that.

The sample camera application above can be found in the [camera](https://github.com/nitrogenjs/camera) project. This project uses the [Nitrogen client node.js module](http://github.com/nitrogenjs/client) to communicate with the service.  The documentation for this API is [documented here](http://nitrogen.io/docs/client/index.html).

Nitrogen also maintains a set of standard schemas to enable cross application / device interoperability.  See [docs/schema.md](docs/schemas.md).  You can opt out of schema checking by prepending the message type with an underscore or mix in your own schemas.

Finally, Nitrogen also maintains a set of device modules (like the Raspberry Pi camera above) in the [devices](https://github.com/nitrogenjs/ic) subproject.  Naturally, you can build your own devices as well.  See one of the device projects for an example.

## Application Development

Let's say that we wanted write an application that asked this camera device we have created to take a picture of the sunset tonight.  In Nitrogen, an application that does this would look something like this:

``` javascript
var times = SunCalc.getTimes(new Date(), 36.972, -122.0263);

var cmd = new nitrogen.Message({
  to: camera.id,
  type: 'cameraCommand',
  ts: times.sunset,
  body: {
      command: 'snapshot'
  }
});

cmd.send(session);
```

In this example, we use the excellent SunCalc node.js module to calculate the sunset time and then build a cameraCommand message.  Note that we set the timestamp of this command message to the sunset.  In Nitrogen, a CommandManager executes a command when the timestamp matches the current time.  This allows us to predeliver these command messages to the device and have it execute them at the appropriate time.  Many devices for connectivity or battery reasons will not be continously connected to the Nitrogen service to receive messages and this allows us to still have precise control of a device.

Obviously, its no fun if we just take photos and don't use them somehow.  Nitrogen also allows you to query on the messages in the service and pull a certain subset out.  Here's a snippet for how we could pull all of the image urls from our sunset camera above from within an application:

``` javascript

nitrogen.Message.find(session, { type: 'image', from: camera.id }, function(err, imageMessages) {
    return imageMessages.map(function(imageMessage) {
        return imageMessage.body.url;
    });
});
```

## Getting Started

We've really only scratched the surface of what's possible with Nitrogen and how all of the parts fit together.

The best way to get started with Nitrogen is to build something. We have a [getting started guide](http://nitrogen.io/guides/start/setup.html) and a [free hosted version of the Nitrogen service](https://admin.nitrogen.io) running in the cloud.

See "Running on Windows" below for instructions on running the server on Windows.

If at any time you run into issues, please file an issue with this project. It is very helpful to know what is hard for beginners to understand so please don't hesitate to reach out.

## Running the Nitrogen service locally:

1. Clone or fork this repo: `https://github.com/nitrogenjs/service`
2. Fetch and install its node.js dependencies: `npm install`
3. Install mongodb locally.
4. Edit `config.js` to change defaults as necessary.
5. `node server.js`

## Running tests

1. `npm test`

## Running on Windows

On Windows, you'll need to install some dependencies first:
 - [node-gyp](https://github.com/TooTallNate/node-gyp/) (`npm install -g node-gyp`)
   - [Python 2.7](http://www.python.org/download/releases/2.7.3#download) (not 3.3)
   - Visual Studio 2010 or higher (including Express editions)
     - Windows XP/Vista/7:
       - Microsoft Visual Studio C++ 2010 ([Express](http://go.microsoft.com/?linkid=9709949) version works well)
       - Also install [Microsoft Visual Studio 2010 Service Pack 1](http://www.microsoft.com/en-us/download/details.aspx?displaylang=en&id=23691)
       - For 64-bit builds of node and native modules you will _**also**_ need the [Windows 7 64-bit SDK](http://www.microsoft.com/en-us/download/details.aspx?id=8279)
       - If you get errors that the 64-bit compilers are not installed you may also need the [compiler update for the Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=4422)
     - Windows 8:
       - Microsoft Visual Studio C++ 2012 for Windows Desktop ([Express](http://go.microsoft.com/?linkid=9816758) version works well)
 - [OpenSSL](http://slproweb.com/products/Win32OpenSSL.html) (normal, not light)
   in the same bitness as your Node.js installation.
   - The build script looks for OpenSSL in the default install directory  (`C:\OpenSSL-Win32` or `C:\OpenSSL-Win64`)
   - If you get `Error: The specified module could not be found.`, copy `libeay32.dll` from the OpenSSL bin directory to this module's bin directory, or to Windows\System32.

## How to contribute

1.  Feedback:  We'd love feedback on what problems you are using Nitrogen to solve.  Obviously, we'd also like to hear about where you ran into sharp edges and dead ends.   Let us know by filing an issue with the project.
2.  Pull requests:  If you'd like to tackle an issue, fork the repo, create a clean commit for the fix or enhancement (with tests if new ones are required), and send us a pull request.

## Nitrogen Project

The Nitrogen project is housed in a set of GitHub projects:

1. [service](https://github.com/nitrogenjs/service): Core platform responsible for managing principals, security, and messaging.
2. [client](https://github.com/nitrogenjs/client): JavaScript client library for building Nitrogen devices and applications.
3. [admin](https://github.com/nitrogenjs/admin): Web admin tool for working with the Nitrogen service.
4. [device](https://github.com/nitrogenjs/devices): Device principals for common pieces of hardware.
5. [commands](https://github.com/nitrogenjs/commands): CommandManagers and schemas for well known command types.
6. [cli](https://github.com/nitrogenjs/cli): Command line interface for working with the Nitrogen service.
7. [reactor](https://github.com/nitrogenjs/reactor): Always-on hosted application execution platform.
8. [apps](https://github.com/nitrogenjs/apps): Project maintained Nitrogen applications.
