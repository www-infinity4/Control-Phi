# Control Phi

Control Phi is the canonical remote and share-event contract for the Infinity TV channel network.

Channel pages load the resilient remote core first, then the navigation/share layer:

```html
<script defer src="https://www-infinity4.github.io/Control-Phi/channel-remote.js"></script>
<script defer src="https://www-infinity4.github.io/Control-Phi/channel-navigation.js"></script>
<script defer src="https://www-infinity4.github.io/Control-Phi/control-phi.js"></script>
```

`channel-remote.js` owns the visible **Channels** hamburger. It reads `channels.json` directly and is intentionally independent of wallet, Cosmo, live-guide, share, and page-specific code. A failure in one of those optional systems must never remove the remote.

`channel-navigation.js` keeps destinations canonical. `control-phi.js` supplies wallet/share-to-News-Phi behavior, Cosmo integration, and the shared Infinity live guide.

`channels.json` is the one channel/site registry. Adding a destination there updates remote consumers without copying channel lists into individual repositories.

Completed Web Share API shares feed one unique News Phi card into `controlPhi:shareFeed:v1`. Pages may also call `ControlPhi.recordShare({ title, text, url, image, channel, searchQuery })` when they use a custom share flow.
