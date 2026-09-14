# Control Phi

Control Phi is the canonical remote and share-event contract for the Infinity TV channel network.

Channel pages load:

```html
<script src="https://www-infinity4.github.io/Control-Phi/control-phi.js"></script>
```

The loader reads `channels.json`, builds the same searchable hamburger everywhere, wraps successful Web Share API calls, and records one unique News Phi card per completed share in `controlPhi:shareFeed:v1`.

It also mounts the shared Infinity live guide at the bottom of each channel. The guide uses long Nintendo-style rows, shows each channel and its current program when the station exposes one, and includes Infinity Phi search.

Pages may also call `ControlPhi.recordShare({ title, text, url, image, channel, searchQuery })` when they use a custom share flow.
