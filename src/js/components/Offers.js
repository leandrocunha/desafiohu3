import React from 'react'
import {Link} from 'react-page'

export default class Offers extends React.Component {

  _randonImageKey(min, max) {
    return parseInt(Math.random() * (max - min) + min);
  }

  render() {
    const {offers} = this.props;

    return(
      <div id="Offers">
        <div className="row">
          {
            offers.map(({description, id, location, photos, title}, index) =>
              <div className="column" key={index}>
                <Link to="offer" params={{id: id}}>
                  <div className="image" style={{backgroundImage: `url(${photos[this._randonImageKey(1,5)]})`}} />
                  <div className="info">
                    <p className="location">{location}</p>
                    <h2 className="title">{title}</h2>
                    <p className="description">{description}</p>
                  </div>
                </Link>
              </div>
            )
          }
        </div>
      </div>
    );
  }
}
