# Wolf - Live Python editing for VS-Code

[![Version](https://vsmarketplacebadge.apphb.com/version-short/traBpUkciP.wolf.svg)](https://vsmarketplacebadge.apphb.com/version-short/traBpUkciP.wolf.svg)
[![Build Status](https://travis-ci.org/Duroktar/Wolf.svg?branch=master)](https://travis-ci.org/Duroktar/Wolf)
[![Downloads](https://vsmarketplacebadge.apphb.com/installs/traBpUkciP.wolf.svg)](https://vsmarketplacebadge.apphb.com/installs/traBpUkciP.wolf.svg)
[![Rating](https://vsmarketplacebadge.apphb.com/rating/traBpUkciP.wolf.svg)](https://vsmarketplacebadge.apphb.com/rating/traBpUkciP.wolf.svg)

Wolf is a VsCode extension that enables visual inspection of live Python code from the editor. It was inspired by [`Quokka.js:`](https://quokkajs.com/) `The Rapid Prototyping Playground for JavaScript and TypeScript` and my love of programming.

Wolf is Good for:

* Teachers
* Students
* Kids Who love to Code
* API testers
* Code Streamers
* Planet Earth

## Wolf Feature Overview

![busy-example](images/busy_example.png)

## Other features

### Check out variables inline

![basic-example](images/basic_example.png)

---

### Works inside functions

![functions-example](images/functions_example.png)

---

### And nested objects

![nested-example](images/nested_example.png)

---

### Works with loops

![loops-example](images/loops_example.png)

### and recursion

![recursion-example](images/recursion_example.png)

---

### Highlights errors

![error-example](images/error_example.png)

---

### Works with http requests

![requests-example](images/requests_example.png)

> NOTE: Please see FAQ section "Will APIs Hate Me?"
> before making requests with Wolf.

---

### Comment Macros

![macro-example](images/macro_example.png)

---

## What people are saying about Wolf

* **Very impressive work!** ~ [Quokka.js](https://quokkajs.com/)
* **What the hell does it do?** ~ My Wife

## Requirements

* Visual Studio Code
* Python 3.5 - 3.6
* Hunter - Available on pip (pip install hunter)

## Extension Settings

This extension contributes the following settings:

* `wolf.barkAtCurrentFile`: Starts Wolf on the current file.
* `wolf.stopBarking`: Stops all running Wolf sessions.
* `wolf.pawPrintsInGutter`: Use paw prints for gutter icons.
* `wolf.updateFrequency`: Adjust the minimum timeframe before the file is saved during Hot Mode

## FAQ

### Can I have the text annotations in cornflower blue?

Abso-fucking-lutely.

### I don't see any annotations

Make sure to save the file you're working on, and that Wolf is activated.
You can try stopping and starting Wolf again on the file to see if this
helps.

### The annotations are everywhere

Sorry, it's a feature for now. Try stopping and starting Wolf
from the command menu to clear the pesky buggers.

### Can my script have relative imports?

Yes. Sorry, I mean, HELL YES!

### Will APIs Hate Me?

That depends. If you code reponsibly and use something like
diskcache or redis to cache your calls, then you'll do just
fine out there. But if you decide to just bang away at some
API without some other sort of caching in place, then it's on
you my friend. Having said that, Wolf will only actually run
your code _on document save_. So you do get a small amount of
throttling by default.

Here's an example using [diskcache](https://pypi.python.org/pypi/diskcache/):
![diskcache-example](images/diskcache_example.png)

### Wolf is stupid.. PDB is better

![pdb](https://memecreator.org/static/images/memes/4713467.jpg)

\*Cue Jingle

Honestly, if you need a real debugger, the one builtin to VSCode is
about as good as it gets. So really, please use that (or `pdb`, `ipdb`)
if you're in need of stuff like breakpoints (or if lives depend on it, ie
please don't use this to debug something like a drug pump ffs, ty).

I see Wolf as more of an exploration tool, for teachers or students
in a learning environment, and definitely for streamers.
You can't get any better than _live feedback next to the code you're editing_!

---

## **Changelog**

## v0.3.0 ~ Minor Release

### No Config Setup

Wolf works in what was once called "Hot Mode" by default now. This means
your live editing experience will be tuned for performance out
of the box, with updating annotations on the fly.

> NOTE: With these changes the following config options have been removed
> or changed:

> Removed Options:

* `wolf.hot`: For enabling live re-loading. (Always on now)

> Changed Options:

* `wolf.hotFrequency` -> `wolf.updateFrequency`

## v0.2.0 ~ Minor Release

### Hot Reloading

Turn on Hot Mode to enable live reloading of code as you work. You can set the
minimum frequency from the user settings if you want more control over when your
file is saved/run.

_Turn on Live Reloading:_

    "wolf.hot": true

Adjust minimum time between saves (throttle control) in milliseconds:

    "wolf.hotFrequency": 270

> Note: Frequency setting is clamped between 100 and 1000 millisecends

### Macros are Back!!!

A comment macro is any single line comment character (pound/hash symbol)
followed by a question mark. See the examples above to get a better idea
of how they work, and check out the macro syntax rules below.

Syntax:

    some.expression()           #?  <----Comment Macro
    a = [i for i in some_list]  # ?  <----Space allowed

> Note: Macros are restricted on lines starting with these
> blacklisted tokens.

* continue
* pass
* return
* if
* for
* while

  return 0 #? <---Restriced, won't work

### Completely Rewritten Codebase

Efforts have been made to improve the structure of the core Wolf
extension to allow for easier updates and more powerful features
in the future.

### ReWritten Sticky Logic

Wolf now uses the builtin API for improving the sticky behavior of
line decorations, especially while coding with Hot Reloading turned
off.

### Overview Ruler Markers

Annotated lines now show up in the OverView ruler panel on the left side
and are color coded for easy visual grepping.

### Hover Information

Hover over any Wolf annotation to see the value pretty printed in a
popup box.

## v0.1.7

### Macbook Touch-Bar Icons

Toggle Wolf on and off from the touch bar.

### Wolf Paw gutter icons

Set `wolf.pawGutterIcons`: `true` to swap the default gutter
icons with the new paw print style. (Requires restart)

## v0.1.6.patch ~ Minor updates to sticky handling

## v0.1.5

### Windows Support/Fix

Windows does not support SIGALRM so a custom decorator was provided by Almenon.

### Python 3.5 Support

Newly added support for Python 3.5 was also provided by Almenon.

_Thanks for contributing to Wolf, Almenon!_ :tada:

## v0.1.4 - patch

### Better Stickys

Better sticky handling during multi-line range edits and deletions.

## v0.1.3 - updates

### Sticky annotations during editing

Annotations now stay attached to their line during editing and between
saves. Multi line editing is supported as well. A page save is still
necessary to update the values, this means the script is still only run
when the file is manually saved.

## v0.1.2 - updates

### Gutter Icons

Colored notification icons in the gutter to aid in visual
grepping of Wolf output. Error lines get a red icon while
okay lines get a green icon.

### Shortcut Icons now a Single Toggle Button

The shortcut icons are now a single icon that senses whether
Wolf is running on the current script and updates accordingly.

## v0.1.1 - updates

### Shortcut Icons

New shortcut buttons added to the action bar for easier
starting and stopping.

### Stability

Added a timeout to prevent locking and high cpu usage.

> Bug: This introduced a bug in Windows which was fixed in v0.1.5

## v0.1.0 - minor release

### Much more stable

The previous version of Wolf would crap out a lot due to some
poor choices on my part. Essentially, I tried to make it do
too much too soon. I felt that stabilty should come before
shiny features and have adjusted accordingly. This really
shouldn't affect usability, but if you have other thoughts
please let me know. That feedback is important.

### Proper object printing

Things like nested lists, sets, tuples.. etc, are now printed
properly. Certain structures were flattened during printing
during the last version and it was pretty frustrating, this
should also be fixed but feel free to let me know if you find
a way to break it.

### Shows errors/exceptions

This was a quiet feature in the last release, so not totally
new in 0.1.0. But it wasn't mentioned in the docs before so
I'm making it official now.

### Macros

\* _Removed_ - _Will possibly be re-implemented in a later version_

## v0.0.2 - updates

> Macros ~Removed in 0.1.0~

### Auto evaluate print statements

Wolf now automatically adds annotations for `print` function calls.

**Macros** ~ _Removed in 0.1.0_

## v0.0.1 - initial release

First release of the Wolf. :tada:

---

## I found a bug

You mean a flea? Report any fleas in the issue tracker, please!

## Can I help

That would be awesome. You can shoot me an email or submit a PR. I'm also on
reddit at `/u/Duroktar`. Also, there's plenty of documentation to get started
on your own, if you just want to do that. Welcome one, welcome all!

## Contributors

The following people have contributed to Wolf:

[Almenon](https://github.com/Almenon) - Windows fix and Python 3.5 support and tests, as well as various other fixes and improvements ~ [#3](https://github.com/Duroktar/Wolf/pull/3) [#6](https://github.com/Duroktar/Wolf/pull/6)

## License

Wolf source is available under the Apache 2.0 Software license.
Any dependant libraries are subject to their own licenses and
terms, the most direct of which are listed below.

## Third Party Libraries

[Hunter](https://github.com/ionelmc/python-hunter) - Hunter is a flexible code tracing toolkit. (Honestly, I couldn't have made Wolf without this library.) - [BSD License](https://github.com/ionelmc/python-hunter/blob/master/LICENSE)
