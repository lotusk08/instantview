# instantclick

[![NPM version](https://img.shields.io/npm/v/instantclick.svg?style=flat-square)](https://www.npmjs.com/package/instantclick)
[![NPM download](https://img.shields.io/npm/dm/instantclick.svg?style=flat-square)](https://www.npmjs.com/package/instantclick)
[![jsDelivr Hits](https://data.jsdelivr.com/v1/package/npm/instantclick/badge)](https://www.jsdelivr.com/package/npm/instantclick)

The unofficial NPM package for the well known [InstantClick](http://instantclick.io) library.

```bash
yarn add instantclick
```

```javascript
import InstantClick from 'instantclick'

InstantClick.init()
```

CDN: [unpkg](https://unpkg.com/instantclick/) | [jsDelivr](https://cdn.jsdelivr.net/npm/instantclick/) (as `window.InstantClick`)

See more usages and test on the original website: http://instantclick.io/documentation

## enhancements:

### Modern Preloading System

Replace XMLHttpRequest with Fetch API
Implement proper resource hints with prioritization
Add timeout and retry logic for failed preloads

### Smart Detection

Add Intersection Observer implementation
Implement viewport priority (links in viewport get higher priority)
Create intelligent preloading that considers available bandwidth

### Event System Overhaul

Create namespaced custom events
Implement a better event delegation system
Add proper cleanup for events between page transitions

### Performance Optimizations

Add request caching
Implement priority queue for preloads
Add bandwidth detection to adjust preloading behavior

### Integration and Testing

Create compatibility layer for legacy browsers
Add comprehensive error handling
Implement testing across different browsers and scenarios

## License

[MIT](/LICENSE) &copy; [EGOIST](https://github.com/egoist).
