# Zenden Square Command Line Interface

This simple app demonstrates the use of the Node.js Square API.  For it to work, you need your own `SQUARE_ACCESS_TOKEN`.  You can get one by going to the [Square Dashboard](https://connect.squareup.com/dashboard/).  Once you've got your token, you can set it in your environment.

An interesting feature of this app is that it uses a custom retry configuration.  The default SDK retry configuration is to not retry.  I couldn't find documentation on how to configure this, so I just examined the SDK source to figure out how to do it.  On a realated note, the Node.js SDK appears to have been generated using technology from [apimatic.io](https://www.apimatic.io).

Another highlight include use of the `commander` library to handle command line arguments.

