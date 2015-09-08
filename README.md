# MathSlax

A typesetting solution for all of your [Slack](https://slack.com/) chat needs.

# Dependencies
Requires Java, Node.JS and NPM.

```shell
$ sudo apt-get install nodejs npm default-jre
$ sudo apt-get install openjdk-7-jdk # unless a JDK is already installed
```

# Set up
## Slack setup

Set up an outgoing web hook in Slack pointing to
`myhostname.com:9999/typeset` (don't forget the `/typeset`). Use
`math!` as the prefix.  Note the authentication token for configuring
MathSlax.

## config.js
Create a `config.js`, using the template if you wish.
The following fields can be exported:

|field |desc|required?|
|------|----|---------|
| authToken | Slack authentication token | yes |
| server | server hostname or IP | if SERVER env var not set |
| port | server port | if PORT env var not set |
| defaultFormat | one of "AsciiMath", "TeX", and "inline-TeX" |
| mj_dpi |   mj_dpi | DPI for PNG generation | no |
| mj_ex |    mj_ex | width of 'x' in pixels | no |
| mj_width | mj_width | width of rendering box in ex | no |

## Starting MathSlax

```shell
$ cd mathslax
$ cp config.js.example config.js
# edit config.js as above
$ make install
$ SERVER=myhostname.com PORT=9999 node server.js
```

The environment variables `SERVER` and `PORT` override the corresponing `config.js` settings.

# Usage

In the Slack channel with the web hook configured, you should be able
to typeset equations by starting your message with `math!`. For
example, `math!  x^2 * sin(x)` would cause the `mathslax` bot to
comment with a link to a typeset image of `x^2 * sin(x)`. If there is
an error, it will send you a private message with the error message.

### Note About Debian/Ubuntu node vs nodejs

The npm install step can produce hard to diagnose errors on Debian derived systems
(such as Ubuntu 12.x and later). The binary /usr/bin/node was renamed to /usr/bin/nodejs
and many packages
in npm do not expect this. You can either create a link yourself from /usr/bin/node -> /usr/bin/nodejs or use one of the other various solutions out there (including attempting to use the package
    nodejs-legacy).  Good luck!

