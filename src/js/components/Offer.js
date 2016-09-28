import React, {findDOMNode} from 'react'
import {actions, store} from './../flux'
import Options from './Options'

export default class Offer extends React.Component {

  componentDidMount() {
    LazyLoad.css([
      `${hU.baseURL}vendors/slick/slick.css`,
      `${hU.baseURL}vendors/slick/slick-theme.css`
    ], this._slick.bind(this));
  }

  _slick() {
    $(findDOMNode(this.refs.slick)).slick({
      slidesToShow: 1,
      slidesToScroll: 1,
      arrows: false,
      fade: true,
      asNavFor: '.nav'
    });

    $(findDOMNode(this.refs.slickNav)).slick({
      slidesToShow: 0,
      slidesToScroll: 1,
      asNavFor: '.wrapper',
      focusOnSelect: true
    });
  }

  render() {

    const offer = store.offers.getOffer();

    return(
      <div id="Offer">
        <div className="container">
          <header>
            <h1 className="title">{offer.title}</h1>
            <h2 className="location">{offer.location}</h2>
            <p>{offer.description}</p>
          </header>
          <div className="slideshow">
            <div className="wrapper" ref="slick">
              {
                offer.photos.map((photo, i) =>
                  <div className="slide"  key={i} style={{backgroundImage: `url(${hU.baseURL}${photo})`}}>
                    <img src={`${hU.baseURL}${photo}`} />
                  </div>
                )
              }
            </div>
            <div className="nav" ref="slickNav">
              {
                offer.photos.map((photo, i) =>
                  <div className="slide"  key={i} style={{backgroundImage: `url(${hU.baseURL}${photo})`}}>
                    <img src={`${hU.baseURL}${photo}`} />
                  </div>
                )
              }
            </div>
          </div>
          <Options options={offer.options} />
        </div>
      </div>
    );
  }
}
