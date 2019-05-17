// ==UserScript==
// @name         Marker's User Blocker
// @description  Block people you don't want to see in the comments and forums
// @version      0.4
// @author       Marker
// @license      MIT
// @namespace    https://github.com/marktaiwan/
// @homepageURL  https://github.com/marktaiwan/Derpibooru-User-Blocker
// @supportURL   https://github.com/marktaiwan/Derpibooru-User-Blocker/issues
// @include      https://derpibooru.org/*
// @include      https://trixiebooru.org/*
// @include      https://www.derpibooru.org/*
// @include      https://www.trixiebooru.org/*
// @grant        GM_addStyle
// @noframes
// @require      https://openuserjs.org/src/libs/mark.taiwangmail.com/Derpibooru_Unified_Userscript_UI_Utility.js
// ==/UserScript==

(function () {
  'use strict';
  const config = ConfigManager(
    'Marker\'s User Blocker',
    'markers_user_blocker',
    'Out of sight, out of mind.'
  );
  config.registerSetting({
    title: 'Block background ponies',
    key: 'block_anon',
    description: 'Hide comments from anonymous users.',
    type: 'checkbox',
    defaultValue: false
  });

  const BLOCK_ANON = config.getEntry('block_anon');

  /** Modified from https://gist.github.com/MoOx/8614711
   */
  function composeElement(obj) {

    /** https://gist.github.com/youssman/745578062609e8acac9f
     * camelToDash('userId') => "user-id"
     */
    function camelToDash(str) {
      return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
    }

    let ele;

    if (obj.tag !== undefined) {
      ele = document.createElement(obj.tag);
      if (obj.attributes !== undefined) {
        for (const attr in obj.attributes) {
          if (obj.attributes.hasOwnProperty(attr)) {
            ele.setAttribute(camelToDash(attr), obj.attributes[attr]);
          }
        }
      }
    } else {
      ele = document.createDocumentFragment();
    }
    if (obj.html !== undefined) ele.innerHTML = obj.html;
    if (obj.text) ele.appendChild(document.createTextNode(obj.text));
    if (Array.isArray(obj.children)) {
      for (const child of obj.children) {
        ele.appendChild((child instanceof window.HTMLElement) ? child : composeElement(child));
      }
    }

    return ele;
  }

  /*
    Unminified code from
    https://derpibooru.org/meta/booru-on-rails-inquiry/post/3823503#post_3823503
  */
  function timeAgo(args) {

    const strings = {
      seconds: 'less than a minute',
      minute: 'about a minute',
      minutes: '%d minutes',
      hour: 'about an hour',
      hours: 'about %d hours',
      day: 'a day',
      days: '%d days',
      month: 'about a month',
      months: '%d months',
      year: 'about a year',
      years: '%d years',
    };

    function distance(time) {
      return new Date() - time;
    }

    function substitute(key, amount) {
      return strings[key].replace('%d', Math.round(amount));
    }

    function setTimeAgo(el) {
      const date = new Date(el.getAttribute('datetime'));
      const distMillis = distance(date);

      /* eslint-disable no-multi-spaces */

      const seconds = Math.abs(distMillis) / 1000;
      const minutes = seconds / 60;
      const hours   = minutes / 60;
      const days    = hours / 24;
      const months  = days / 30;
      const years   = days / 365;

      const words =
        seconds < 45  && substitute('seconds', seconds) ||
        seconds < 90  && substitute('minute', 1)        ||
        minutes < 45  && substitute('minutes', minutes) ||
        minutes < 90  && substitute('hour', 1)          ||
        hours   < 24  && substitute('hours', hours)     ||
        hours   < 42  && substitute('day', 1)           ||
        days    < 30  && substitute('days', days)       ||
        days    < 45  && substitute('month', 1)         ||
        days    < 365 && substitute('months', months)   ||
        years   < 1.5 && substitute('year', 1)          ||
                         substitute('years', years);

      /* eslint-enable no-multi-spaces */

      if (!el.getAttribute('title')) {
        el.setAttribute('title', el.textContent);
      }
      el.textContent = words + (distMillis < 0 ? ' from now' : ' ago');
    }
    [].forEach.call(args, el => setTimeAgo(el));
  }

  function getBlacklist() {
    return config.getEntry('blacklist') || [];
  }

  function setBlacklist(arr) {
    config.setEntry('blacklist', arr);
  }

  function blacklistContains(profileId) {
    const blacklist = getBlacklist();
    return (blacklist.find(entry => entry.profileId === profileId) !== undefined);
  }

  function removeFromBlacklist(profileId) {
    const blacklist = getBlacklist();
    const index = blacklist.findIndex(entry => entry.profileId === profileId);
    if (index > -1) {
      blacklist.splice(index, 1);
    }
    setBlacklist(blacklist);
  }

  function addToBlacklist(id, name) {
    if (blacklistContains(id)) {
      console.error(`The profile ${name} is already blacklisted.`);
      return;
    }
    const blacklist = getBlacklist();
    blacklist.push({profileId: id, profileName: name, timestamp: new Date().getTime()});
    setBlacklist(blacklist);
  }

  function displayBlacklist(configElement) {
    if (configElement === null) return;

    const blacklist = getBlacklist();
    const container = composeElement({
      tag: 'div', attributes: {class: 'block user-blocker--blacklist--container'},
      children: [{
        tag: 'div', attributes: {class: 'block__header--sub'},
        children: [{ tag: 'span', attributes: {class: 'block__header__title'}, text: 'Blacklisted Users'}]
      },{
        tag: 'div', attributes: {class: 'block__content user-blocker--blacklist--list'}
      }]
    });
    const list = container.querySelector('.user-blocker--blacklist--list');
    for (const entry of blacklist) {
      const time = new Date(entry.timestamp);
      const ele = composeElement({
        tag: 'div', attributes: {class: 'block__content alternating-color user-blocker--blacklist--row'},
        children: [{
          tag: 'span', attributes: {class: 'user-blocker__flex'},
          children: [{tag: 'a', attributes: {href: entry.profileId}, text: entry.profileName}]
        },{
          tag: 'span',
          html: `Added <time datetime="${time.toISOString()}">${time.toLocaleString()}</time>`
        },{
          tag: 'a', attributes: {class: 'user-blocker--blacklist--remove', dataProfileId: entry.profileId}, text: 'Remove'
        }]
      });
      ele.querySelector('.user-blocker--blacklist--remove').addEventListener('click', function (event) {
        removeFromBlacklist(event.target.dataset.profileId);
        event.target.parentElement.remove();
      });
      list.appendChild(ele);
    }
    if (blacklist.length == 0) {
      list.appendChild(composeElement({
        tag: 'div', attributes: {class: 'block__content alternating-color center'}, text: 'Empty!'
      }));
    }
    timeAgo(container.querySelectorAll('time'));
    configElement.appendChild(container);
  }


  function hideComment(comment) {
    const stub = document.createElement('div');
    const commentorName = comment.querySelector('.communication__body__sender-name').innerText;
    const mainCommentBlock = comment.firstElementChild;

    stub.classList.add('block__content', 'flex', 'flex--no-wrap');
    stub.innerHTML = `<a class="user-blocker--stub">Hidden comment from <b>${commentorName}</b>, click to toggle.</a>`;

    stub.querySelector('.user-blocker--stub').addEventListener('click', function () {
      mainCommentBlock.classList.toggle('hidden');
    });

    mainCommentBlock.classList.add('hidden');
    comment.insertAdjacentElement('afterbegin', stub);
  }

  function toggleBlocking(event) {
    const button = event.target;
    const profileId = button.dataset.profileId;
    const profileName = button.dataset.profileName;
    const action = button.dataset.blacklistAction;

    switch (action) {
      case 'add':
        addToBlacklist(profileId, profileName);
        break;
      case 'remove':
        removeFromBlacklist(profileId);
        break;
      default:
        throw new Error(`User Blocker: Unrecognized dataset value "${action}"`);
    }

    updateToggleButton(button);
  }

  function updateToggleButton(btn) {
    const currentPath = window.location.pathname;
    let displayText, dataAction;

    if (blacklistContains(currentPath)) {
      displayText = 'Show';
      dataAction = 'remove';
    } else {
      displayText = 'Hide';
      dataAction = 'add';
    }

    btn.innerText = `${displayText} user's comments`;
    btn.dataset.profileId = currentPath;
    btn.dataset.blacklistAction = dataAction;
  }

  function getProfileName(profileLinks) {
    const regex = (/^(.+)'s profile$/);
    const result = profileLinks.querySelector('.profile-top__name-header').innerText.match(regex);
    if (result === null) {
      throw new Error('User Blocker: Could not find profile name');
    }
    return result[1];
  }

  function initCSS() {
    GM_addStyle(`/* Generated by Marker's User Blocker */
.user-blocker--stub, .user-blocker--blacklist--toggle, .user-blocker--blacklist--remove {
  cursor: pointer;
}
.user-blocker--blacklist--container {
  max-width: 700px;
}
.user-blocker--blacklist--list {
  max-height: 200px;
  overflow-y: auto;
  padding: 0px;
  border: 0px;
}
.user-blocker--blacklist--row {
  display: flex;
}
.user-blocker--blacklist--row>* {
  margin: 0px 3px;
}
.user-blocker--blacklist--remove {
  font-weight: bold;
}
.user-blocker__flex {
  flex: auto;
}
`);

  }

  function main() {
    const comments = document.body.querySelectorAll('article[id^="comment_"], article[id^="post_"]');
    const profiles = document.body.querySelectorAll('.profile-top__name-and-links');
    for (const comment of comments) {
      // Comments and forum posts
      if (comment.dataset.userBlockerObserver !== undefined) {
        continue;
      } else {
        comment.dataset.userBlockerObserver = '1';
      }

      const anchor = comment.querySelector('.communication__body__sender-name>a');
      if ((anchor && blacklistContains(anchor.pathname)) || (!anchor && BLOCK_ANON)) {
        hideComment(comment);
      }
    }
    for (const profileLinks of profiles) {
      // Profile page
      if (profileLinks.dataset.userBlockerObserver !== undefined) {
        continue;
      } else {
        profileLinks.dataset.userBlockerObserver = '1';
      }

      const profileName = getProfileName(profileLinks);
      const profileOptions = profileLinks.querySelector('.profile-top__options');
      const buttonColumn = composeElement({
        tag: 'ul', attributes: {class: 'profile-top__options__column'},
        children: [{
          tag: 'li',
          html: `<a class="user-blocker--blacklist--toggle" data-profile-name="${profileName}"></a>`
        }]
      });

      const button = buttonColumn.querySelector('.user-blocker--blacklist--toggle');
      updateToggleButton(button);
      button.addEventListener('click', toggleBlocking);

      profileOptions.appendChild(buttonColumn);
    }
  }

  initCSS();
  displayBlacklist(config.pageElement);
  main();

  const creationObserver = new MutationObserver(function () {
    main();
  });
  creationObserver.observe(document.body, {childList: true, subtree: true});
})();
