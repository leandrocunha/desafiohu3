import React from 'react'
import {actions, store} from './../flux'
import Loading from './Loading'
import Offers from './Offers'

export default class Home extends React.Component {

  constructor(props) {
    super(props);
    this.state = { loading: true };
  }

  componentDidMount() {

    actions.offers.list()
      .then(() => this.setState({loading: false}));
  }  

  render() {

    const {loading} = this.state;
    const offers = store.offers.getOffers();

    return (
      <div id="Home">
        <div className="container">
		      <h1 className="section-title">Ofertas de viagens</h1>
          {
            loading ? <Loading /> : <Offers offers={offers} />
          }
        </div>
      </div>
    );
  }
}
