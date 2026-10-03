# Change Log
All notable changes to the "wolf" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
- Require Python 3.8 or later, matching the supported CI matrix.
- Authenticate the local tracing server and reject browser-origin connections.
- Fix trace client cleanup, stale editor updates, session restarts, and update scheduling.
- Fix Python path/temp-file cleanup and augmented-assignment macro evaluation.