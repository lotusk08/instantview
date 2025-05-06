# Instantview
Make the website faster by preloading pages on hover

This is a mini script like instantclick, but well-structured version:
- Script Sandboxing System
- Improved Script Registry
- Controlled Script Execution
- Script Context Management
- Global Variable Preservation
- Better Error Handling
- Script Dependency Management

## Core functionality remains:

- [x] Link prefetching on hover/mousedown
- [x] Fast page transitions
- [x] History state management
- [x] Script handling during transitions
- [ ] Enhance with new perf like DOM-Less feature & rewrite in ES6 *- I think for myself*

## How to use InstantView
To use this library on your website:

1. Include the JavaScript file in your HTML(header/footer):

```html
<script src="instantview.js"></script>
```

2. Initialize it when the DOM is ready (HTML in header/footer):

```html
<script>
  document.addEventListener("DOMContentLoaded", function() {
	InstantView.init();
  });
</script>
```
3. Optional: Add configuration options

```html
<script>
  document.addEventListener("DOMContentLoaded", function() {
	// Use mousedown instead of mouseover (faster perceived speed but less preloading)
	InstantView.init("mousedown");
	
	// Add a delay in milliseconds before preloading (reduce unnecessary requests)
	InstantView.init(100);
	
	// Use whitelist mode (only preload links with data-instant attribute)
	InstantView.init(true);
	
	// Combine options
	InstantView.init(true, "mousedown", 50);
  });
</script>
```

4. Optional: Listen for events

```html
<script>
  InstantView.on("change", function() {
	// Page has changed
	setupAnalytics();
  });
  
  InstantView.on("fetch", function() {
	// Page fetch started
	showCustomLoadingIndicator();
  });
</script>
```
## Demo
![demo](demo-on-site.gif)
_I tested in my site_

Link: https://dev.lotusk08-github-io.pages.dev/

## Issue?
Read the [WIKI](https://github.com/lotusk08/instantview.wiki.git)

## Source
Thank to [InstantClick](http://instantclick.io) & [EGOIST](https://github.com/egoist/instantclick) libraries.

## License

[MIT](/LICENSE) &copy; [stevehoang.com](https://stevehoang.com).
