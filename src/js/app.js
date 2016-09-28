LazyLoad.js([`${hU.baseURL}js/vendors.js`], () => {

  const {assign} = require('lodash');

  global.React = require('react');
  assign(global.React, require('react-dom'));
  
  global.jQuery = require('jquery');
  global.$ = jQuery;

  LazyLoad.js([`${hU.baseURL}vendors/slick/slick.min.js`], () => require('./router'));
});
