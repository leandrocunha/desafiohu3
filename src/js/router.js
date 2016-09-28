import React from 'react';
import ReactDOM from 'react-dom';
import Page from 'react-page';

import {actions, store} from './flux';
import Main from './components/Main';
import Home from './components/Home';
import Offer from './components/Offer';

import numeral from './config/numeral';

var render = RootComponent => ReactDOM.render(<RootComponent />,
  document.getElementById('app'));

Page.set(render)
 .with(Main)
  .on(
    'app',
    '/',
    Home
  )
  .on(
    'offer',
    '/offer/:id',
    Page.when(
      ({params}) => actions.offers.get(params.id),
      Offer,
      null,
      null
    )
  )
  .run();
