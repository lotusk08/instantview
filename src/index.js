var instantclick,
  InstantClick = (instantclick = (function (document, location, $userAgent) {
    var $currentLocationWithoutHash,
      $urlToPreload,
      $preloadTimer,
      $lastTouchTimestamp,
      $hasBeenInitialized,
      $touchEndedWithoutClickTimer,
      $lastUsedTimeoutId = 0,
      $history = {},
      $xhr,
      $url = false,
      $title = false,
      $isContentTypeNotHTML,
      $areTrackedElementsDifferent,
      $body = false,
      $lastDisplayTimestamp = 0,
      $isPreloading = false,
      $isWaitingForCompletion = false,
      $gotANetworkError = false,
      $trackedElementsData = [],
      $preloadOnMousedown,
      $delayBeforePreload = 65,
      $eventsCallbacks = {
        preload: [],
        receive: [],
        wait: [],
        change: [],
        restore: [],
        exit: [],
      },
      $timers = {},
      $currentPageXhrs = [],
      $windowEventListeners = {},
      $delegatedEvents = {};

    if (!Element.prototype.matches) {
      Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        function (selector) {
          var matches = document.querySelectorAll(selector);
          for (var i = 0; i < matches.length; i++) {
            if (matches[i] == this) {
              return true;
            }
          }
          return false;
        };
    }

    function removeHash(url) {
      var index = url.indexOf("#");
      if (index == -1) {
        return url;
      }
      return url.slice(0, index);
    }

    function getParentLinkElement(element) {
      while (element && element.nodeName != "A") {
        element = element.parentNode;
      }
      return element;
    }

    function isBlacklisted(element) {
      do {
        if (!element.hasAttribute) {
          break;
        }
        if (element.hasAttribute("data-instant")) {
          return false;
        }
        if (element.hasAttribute("data-no-instant")) {
          return true;
        }
      } while ((element = element.parentNode));
      return false;
    }

    function isPreloadable(linkElement) {
      var domain = location.protocol + "//" + location.host;

      if (
        linkElement.target ||
        linkElement.hasAttribute("download") ||
        linkElement.href.indexOf(domain + "/") != 0 ||
        (linkElement.href.indexOf("#") > -1 &&
          removeHash(linkElement.href) == $currentLocationWithoutHash) ||
        isBlacklisted(linkElement)
      ) {
        return false;
      }
      return true;
    }

    function triggerPageEvent(eventType) {
      var argumentsToApply = Array.prototype.slice.call(arguments, 1),
        returnValue = false;
      for (var i = 0; i < $eventsCallbacks[eventType].length; i++) {
        if (eventType == "receive") {
          var altered = $eventsCallbacks[eventType][i].apply(
            window,
            argumentsToApply,
          );
          if (altered) {
            if ("body" in altered) {
              argumentsToApply[1] = altered.body;
            }
            if ("title" in altered) {
              argumentsToApply[2] = altered.title;
            }

            returnValue = altered;
          }
        } else {
          $eventsCallbacks[eventType][i].apply(window, argumentsToApply);
        }
      }
      return returnValue;
    }

    function changePage(title, body, urlToPush, scrollPosition) {
      abortCurrentPageXhrs();

      document.documentElement.replaceChild(body, document.body);
      document.title = title;

      if (urlToPush) {
        addOrRemoveWindowEventListeners("remove");
        if (urlToPush != location.href) {
          history.pushState(null, null, urlToPush);

          if ($userAgent.indexOf(" CriOS/") > -1) {
            if (document.title == title) {
              document.title = title + String.fromCharCode(160);
            } else {
              document.title = title;
            }
          }
        }

        var hashIndex = urlToPush.indexOf("#"),
          offsetElement =
            hashIndex > -1 &&
            document.getElementById(urlToPush.slice(hashIndex + 1)),
          offset = 0;

        if (offsetElement) {
          while (offsetElement.offsetParent) {
            offset += offsetElement.offsetTop;
            offsetElement = offsetElement.offsetParent;
          }
        }

        window.scrollTo({
          top: offset,
          behavior: "smooth",
        });

        clearCurrentPageTimeouts();

        $currentLocationWithoutHash = removeHash(urlToPush);

        if ($currentLocationWithoutHash in $windowEventListeners) {
          $windowEventListeners[$currentLocationWithoutHash] = [];
        }

        $timers[$currentLocationWithoutHash] = {};

        applyScriptElements(function (element) {
          return !element.hasAttribute("data-instant-track");
        });

        triggerPageEvent("change", false);
      } else {
        window.scrollTo({
          top: scrollPosition,
          behavior: "smooth",
        });

        $xhr.abort();
        setPreloadingAsHalted();

        applyScriptElements(function (element) {
          return element.hasAttribute("data-instant-restore");
        });

        restoreTimers();

        triggerPageEvent("restore");
      }
    }

    function setPreloadingAsHalted() {
      $isPreloading = false;
      $isWaitingForCompletion = false;
    }

    function removeNoscriptTags(html) {
      return html.replace(/<noscript[\s\S]+?<\/noscript>/gi, "");
    }

    function abortCurrentPageXhrs() {
      for (var i = 0; i < $currentPageXhrs.length; i++) {
        if (
          typeof $currentPageXhrs[i] == "object" &&
          "abort" in $currentPageXhrs[i]
        ) {
          $currentPageXhrs[i].instantclickAbort = true;
          $currentPageXhrs[i].abort();
        }
      }
      $currentPageXhrs = [];
    }

    function clearCurrentPageTimeouts() {
      for (var i in $timers[$currentLocationWithoutHash]) {
        var timeout = $timers[$currentLocationWithoutHash][i];
        window.clearTimeout(timeout.realId);
        timeout.delayLeft = timeout.delay - +new Date() + timeout.timestamp;
      }
    }

    function restoreTimers() {
      for (var i in $timers[$currentLocationWithoutHash]) {
        if (!("delayLeft" in $timers[$currentLocationWithoutHash][i])) {
          continue;
        }
        var args = [
          $timers[$currentLocationWithoutHash][i].callback,
          $timers[$currentLocationWithoutHash][i].delayLeft,
        ];
        for (
          var j = 0;
          j < $timers[$currentLocationWithoutHash][i].params.length;
          j++
        ) {
          args.push($timers[$currentLocationWithoutHash][i].params[j]);
        }
        addTimer(
          args,
          $timers[$currentLocationWithoutHash][i].isRepeating,
          $timers[$currentLocationWithoutHash][i].delay,
        );
        delete $timers[$currentLocationWithoutHash][i];
      }
    }

    function handleTouchendWithoutClick() {
      $xhr.abort();
      setPreloadingAsHalted();
    }

    function addOrRemoveWindowEventListeners(addOrRemove) {
      if ($currentLocationWithoutHash in $windowEventListeners) {
        for (
          var i = 0;
          i < $windowEventListeners[$currentLocationWithoutHash].length;
          i++
        ) {
          window[addOrRemove + "EventListener"].apply(
            window,
            $windowEventListeners[$currentLocationWithoutHash][i],
          );
        }
      }
    }

    function applyScriptElements(condition) {
      var scriptElementsInDOM = document.body.getElementsByTagName("script"),
        scriptElementsToCopy = [],
        originalElement,
        copyElement,
        parentNode,
        nextSibling,
        i;

      for (i = 0; i < scriptElementsInDOM.length; i++) {
        scriptElementsToCopy.push(scriptElementsInDOM[i]);
      }

      for (i = 0; i < scriptElementsToCopy.length; i++) {
        originalElement = scriptElementsToCopy[i];
        if (!originalElement) {
          continue;
        }
        if (!condition(originalElement)) {
          continue;
        }

        copyElement = document.createElement("script");
        for (var j = 0; j < originalElement.attributes.length; j++) {
          copyElement.setAttribute(
            originalElement.attributes[j].name,
            originalElement.attributes[j].value,
          );
        }
        copyElement.textContent = originalElement.textContent;

        parentNode = originalElement.parentNode;
        nextSibling = originalElement.nextSibling;
        parentNode.removeChild(originalElement);
        parentNode.insertBefore(copyElement, nextSibling);
      }
    }

    function addTrackedElements() {
      var trackedElements = document.querySelectorAll("[data-instant-track]"),
        element,
        elementData;
      for (var i = 0; i < trackedElements.length; i++) {
        element = trackedElements[i];
        elementData =
          element.getAttribute("href") ||
          element.getAttribute("src") ||
          element.textContent;
        $trackedElementsData.push(elementData);
      }
    }

    function addTimer(args, isRepeating, realDelay) {
      var callback = args[0],
        delay = args[1],
        params = [].slice.call(args, 2),
        timestamp = +new Date();

      $lastUsedTimeoutId++;
      var id = $lastUsedTimeoutId;

      var callbackModified;
      if (isRepeating) {
        callbackModified = function (args2) {
          callback(args2);
          delete $timers[$currentLocationWithoutHash][id];
          args[0] = callback;
          args[1] = delay;
          addTimer(args, true);
        };
      } else {
        callbackModified = function (args2) {
          callback(args2);
          delete $timers[$currentLocationWithoutHash][id];
        };
      }

      args[0] = callbackModified;
      if (realDelay != undefined) {
        timestamp += delay - realDelay;
        delay = realDelay;
      }
      var realId = window.setTimeout.apply(window, args);
      $timers[$currentLocationWithoutHash][id] = {
        realId: realId,
        timestamp: timestamp,
        callback: callback,
        delay: delay,
        params: params,
        isRepeating: isRepeating,
      };
      return -id;
    }

    function mousedownListener(event) {
      var linkElement = getParentLinkElement(event.target);

      if (!linkElement || !isPreloadable(linkElement)) {
        return;
      }

      preload(linkElement.href);
    }

    function mouseoverListener(event) {
      if ($lastTouchTimestamp > +new Date() - 500) {
        return;
      }

      if (+new Date() - $lastDisplayTimestamp < 100) {
        return;
      }

      var linkElement = getParentLinkElement(event.target);

      if (!linkElement) {
        return;
      }

      if (linkElement == getParentLinkElement(event.relatedTarget)) {
        return;
      }

      if (!isPreloadable(linkElement)) {
        return;
      }

      linkElement.addEventListener("mouseout", mouseoutListener);

      if (!$isWaitingForCompletion) {
        $urlToPreload = linkElement.href;
        $preloadTimer = setTimeout(preload, $delayBeforePreload);
      }
    }

    function touchstartListener(event) {
      $lastTouchTimestamp = +new Date();

      var linkElement = getParentLinkElement(event.target);

      if (!linkElement || !isPreloadable(linkElement)) {
        return;
      }

      if ($touchEndedWithoutClickTimer) {
        clearTimeout($touchEndedWithoutClickTimer);
        $touchEndedWithoutClickTimer = false;
      }

      linkElement.addEventListener("touchend", touchendAndTouchcancelListener);
      linkElement.addEventListener(
        "touchcancel",
        touchendAndTouchcancelListener,
      );

      preload(linkElement.href);
    }

    function clickListenerPrelude() {
      document.addEventListener("click", clickListener);
    }

    function clickListener(event) {
      document.removeEventListener("click", clickListener);

      if ($touchEndedWithoutClickTimer) {
        clearTimeout($touchEndedWithoutClickTimer);
        $touchEndedWithoutClickTimer = false;
      }

      if (event.defaultPrevented) {
        return;
      }

      var linkElement = getParentLinkElement(event.target);

      if (!linkElement || !isPreloadable(linkElement)) {
        return;
      }

      if (event.button != 0 || event.metaKey || event.ctrlKey) {
        return;
      }
      event.preventDefault();
      display(linkElement.href);
    }

    function mouseoutListener(event) {
      if (
        getParentLinkElement(event.target) ==
        getParentLinkElement(event.relatedTarget)
      ) {
        return;
      }

      if ($preloadTimer) {
        clearTimeout($preloadTimer);
        $preloadTimer = false;
        return;
      }

      if (!$isPreloading || $isWaitingForCompletion) {
        return;
      }

      $xhr.abort();
      setPreloadingAsHalted();
    }

    function touchendAndTouchcancelListener() {
      if (!$isPreloading || $isWaitingForCompletion) {
        return;
      }

      $touchEndedWithoutClickTimer = setTimeout(
        handleTouchendWithoutClick,
        500,
      );
    }

    function readystatechangeListener() {
      if ($xhr.readyState == 2) {
        var contentType = $xhr.getResponseHeader("Content-Type");
        if (!contentType || !/^text\/html/i.test(contentType)) {
          $isContentTypeNotHTML = true;
        }
      }

      if ($xhr.readyState < 4) {
        return;
      }

      if ($xhr.status == 0) {
        $gotANetworkError = true;
        if ($isWaitingForCompletion) {
          triggerPageEvent("exit", $url, "network error");
          location.href = $url;
        }
        return;
      }

      if ($isContentTypeNotHTML) {
        if ($isWaitingForCompletion) {
          triggerPageEvent("exit", $url, "non-html content-type");
          location.href = $url;
        }
        return;
      }

      var doc = document.implementation.createHTMLDocument("");
      doc.documentElement.innerHTML = removeNoscriptTags($xhr.responseText);
      $title = doc.title;
      $body = doc.body;

      var alteredOnReceive = triggerPageEvent("receive", $url, $body, $title);
      if (alteredOnReceive) {
        if ("body" in alteredOnReceive) {
          $body = alteredOnReceive.body;
        }
        if ("title" in alteredOnReceive) {
          $title = alteredOnReceive.title;
        }
      }

      var urlWithoutHash = removeHash($url);
      $history[urlWithoutHash] = {
        body: $body,
        title: $title,
        scrollPosition:
          urlWithoutHash in $history
            ? $history[urlWithoutHash].scrollPosition
            : 0,
      };

      var trackedElements = doc.querySelectorAll("[data-instant-track]"),
        element,
        elementData;

      if (trackedElements.length != $trackedElementsData.length) {
        $areTrackedElementsDifferent = true;
      } else {
        for (var i = 0; i < trackedElements.length; i++) {
          element = trackedElements[i];
          elementData =
            element.getAttribute("href") ||
            element.getAttribute("src") ||
            element.textContent;
          if ($trackedElementsData.indexOf(elementData) == -1) {
            $areTrackedElementsDifferent = true;
          }
        }
      }

      if ($isWaitingForCompletion) {
        $isWaitingForCompletion = false;
        display($url);
      }
    }

    function popstateListener() {
      var loc = removeHash(location.href);
      if (loc == $currentLocationWithoutHash) {
        return;
      }

      if ($isWaitingForCompletion) {
        setPreloadingAsHalted();
        $xhr.abort();
      }

      if (!(loc in $history)) {
        triggerPageEvent("exit", location.href, "not in history");
        if (loc == location.href) {
          location.href = location.href;
        } else {
          location.reload();
        }
        return;
      }

      $history[$currentLocationWithoutHash].scrollPosition = window.scrollY;
      clearCurrentPageTimeouts();
      addOrRemoveWindowEventListeners("remove");
      $currentLocationWithoutHash = loc;
      changePage(
        $history[loc].title,
        $history[loc].body,
        false,
        $history[loc].scrollPosition,
      );
      addOrRemoveWindowEventListeners("add");
    }

    function preload(url) {
      if ($preloadTimer) {
        clearTimeout($preloadTimer);
        $preloadTimer = false;
      }

      if (!url) {
        url = $urlToPreload;
      }

      if ($isPreloading && (url == $url || $isWaitingForCompletion)) {
        return;
      }
      $isPreloading = true;
      $isWaitingForCompletion = false;

      $url = url;
      $body = false;
      $isContentTypeNotHTML = false;
      $gotANetworkError = false;
      $areTrackedElementsDifferent = false;
      triggerPageEvent("preload");
      $xhr.open("GET", url);
      $xhr.timeout = 90000;
      $xhr.send();
    }

    function display(url) {
      $lastDisplayTimestamp = +new Date();
      if ($preloadTimer || !$isPreloading) {
        if ($preloadTimer && $url && $url != url) {
          triggerPageEvent(
            "exit",
            url,
            "click occured while preloading planned",
          );
          location.href = url;
          return;
        }

        preload(url);
        triggerPageEvent("wait");
        $isWaitingForCompletion = true;
        return;
      }
      if ($isWaitingForCompletion) {
        triggerPageEvent(
          "exit",
          url,
          "clicked on a link while waiting for another page to display",
        );
        location.href = url;
        return;
      }
      if ($isContentTypeNotHTML) {
        triggerPageEvent("exit", $url, "non-html content-type");
        location.href = $url;
        return;
      }
      if ($gotANetworkError) {
        triggerPageEvent("exit", $url, "network error");
        location.href = $url;
        return;
      }
      if ($areTrackedElementsDifferent) {
        triggerPageEvent("exit", $url, "different assets");
        location.href = $url;
        return;
      }
      if (!$body) {
        triggerPageEvent("wait");
        $isWaitingForCompletion = true;
        return;
      }
      $history[$currentLocationWithoutHash].scrollPosition = window.scrollY;
      setPreloadingAsHalted();
      changePage($title, $body, $url);
    }

    var supported = false;
    if ("pushState" in history && location.protocol != "file:") {
      supported = true;

      var indexOfAndroid = $userAgent.indexOf("Android ");
      if (indexOfAndroid > -1) {
        var androidVersion = parseFloat(
          $userAgent.slice(indexOfAndroid + "Android ".length),
        );
        if (androidVersion < 4.4) {
          supported = false;
          if (androidVersion >= 4) {
            var whitelistedBrowsersUserAgentsOnAndroid4 = [
              / Chrome\//,
              / UCBrowser\//,
              / Firefox\//,
              / Windows Phone /,
            ];
            for (
              var i = 0;
              i < whitelistedBrowsersUserAgentsOnAndroid4.length;
              i++
            ) {
              if (whitelistedBrowsersUserAgentsOnAndroid4[i].test($userAgent)) {
                supported = true;
                break;
              }
            }
          }
        }
      }
    }

    function init(preloadingMode) {
      if (!supported) {
        triggerPageEvent("change", true);
        return;
      }

      if ($hasBeenInitialized) {
        return;
      }
      $hasBeenInitialized = true;

      if (preloadingMode == "mousedown") {
        $preloadOnMousedown = true;
      } else if (typeof preloadingMode == "number") {
        $delayBeforePreload = preloadingMode;
      }

      $currentLocationWithoutHash = removeHash(location.href);
      $timers[$currentLocationWithoutHash] = {};
      $history[$currentLocationWithoutHash] = {
        body: document.body,
        title: document.title,
        scrollPosition: window.scrollY,
      };

      var DOMContentLoaded = new Event("DOMContentLoaded");

      if (document.readyState == "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          addTrackedElements();
          document.dispatchEvent(DOMContentLoaded);
        });
      } else {
        addTrackedElements();
        document.dispatchEvent(DOMContentLoaded);
      }

      $xhr = new XMLHttpRequest();
      $xhr.addEventListener("readystatechange", readystatechangeListener);

      document.addEventListener("touchstart", touchstartListener, true);
      if ($preloadOnMousedown) {
        document.addEventListener("mousedown", mousedownListener, true);
      } else {
        document.addEventListener("mouseover", mouseoverListener, true);
      }
      document.addEventListener("click", clickListenerPrelude, true);

      addEventListener("popstate", popstateListener);
    }

    function on(eventType, callback) {
      $eventsCallbacks[eventType].push(callback);

      if (eventType == "change") {
        callback(!$lastDisplayTimestamp);
      }
    }

    function setTimeout() {
      return addTimer(arguments, false);
    }

    function setInterval() {
      return addTimer(arguments, true);
    }

    function clearTimeout(id) {
      id = -id;
      for (var loc in $timers) {
        if (id in $timers[loc]) {
          window.clearTimeout($timers[loc][id].realId);
          delete $timers[loc][id];
        }
      }
    }

    function xhr(xhr) {
      $currentPageXhrs.push(xhr);
    }

    function addPageEvent() {
      if (!($currentLocationWithoutHash in $windowEventListeners)) {
        $windowEventListeners[$currentLocationWithoutHash] = [];
      }
      $windowEventListeners[$currentLocationWithoutHash].push(arguments);
      addEventListener.apply(window, arguments);
    }

    function removePageEvent() {
      if (!($currentLocationWithoutHash in $windowEventListeners)) {
        return;
      }
      firstLoop: for (
        var i = 0;
        i < $windowEventListeners[$currentLocationWithoutHash].length;
        i++
      ) {
        if (
          arguments.length !=
          $windowEventListeners[$currentLocationWithoutHash][i].length
        ) {
          continue;
        }
        for (
          var j = 0;
          j < $windowEventListeners[$currentLocationWithoutHash][i].length;
          j++
        ) {
          if (
            arguments[j] !=
            $windowEventListeners[$currentLocationWithoutHash][i][j]
          ) {
            continue firstLoop;
          }
        }
        $windowEventListeners[$currentLocationWithoutHash].splice(i, 1);
      }
    }

    function addEvent(selector, type, listener) {
      if (!(type in $delegatedEvents)) {
        $delegatedEvents[type] = {};

        document.addEventListener(
          type,
          function (event) {
            var element = event.target;
            event.originalStopPropagation = event.stopPropagation;
            event.stopPropagation = function () {
              this.isPropagationStopped = true;
              this.originalStopPropagation();
            };
            while (element && element.nodeType == 1) {
              for (var selector in $delegatedEvents[type]) {
                if (element.matches(selector)) {
                  for (
                    var i = 0;
                    i < $delegatedEvents[type][selector].length;
                    i++
                  ) {
                    $delegatedEvents[type][selector][i].call(element, event);
                  }
                  if (event.isPropagationStopped) {
                    return;
                  }
                  break;
                }
              }
              element = element.parentNode;
            }
          },
          false,
        );

        if (type == "click" && /iP(?:hone|ad|od)/.test($userAgent)) {
          var styleElement = document.createElement("style");
          styleElement.setAttribute("instantclick-mobile-safari-cursor", "");
          styleElement.textContent = "body { cursor: pointer !important; }";
          document.head.appendChild(styleElement);
        }
      }

      if (!(selector in $delegatedEvents[type])) {
        $delegatedEvents[type][selector] = [];
      }

      removeEvent(selector, type, listener);

      $delegatedEvents[type][selector].push(listener);
    }

    function removeEvent(selector, type, listener) {
      var index = $delegatedEvents[type][selector].indexOf(listener);
      if (index > -1) {
        $delegatedEvents[type][selector].splice(index, 1);
      }
    }

    return {
      supported: supported,
      init: init,
      on: on,
      setTimeout: setTimeout,
      setInterval: setInterval,
      clearTimeout: clearTimeout,
      xhr: xhr,
      addPageEvent: addPageEvent,
      removePageEvent: removePageEvent,
      addEvent: addEvent,
      removeEvent: removeEvent,
    };
  })(document, location, navigator.userAgent));

export default InstantClick;
