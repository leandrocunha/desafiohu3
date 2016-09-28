import React from 'react'
import Numeral from 'numeral'
import {flatten, sortBy, uniq} from 'lodash'
import Warning from './Warning'
import randomKey from './../helpers/randomKey'

export default class Options extends React.Component {

  constructor(props){
    super(props);
    this.state = {options: []}
  }

  componentDidMount() {
    const {options} = this.props;
    this.setState({options: sortBy(options, 'price')});
  }

  _daily(options) {
    const dailyArr = options.map((option, index) => option.daily);
    return uniq(dailyArr);
  }

  _departures(options) {
    const departuresArr = options.map(option => option.from.map(location => location));
    return uniq(flatten(departuresArr)).sort();
  }

  _filterDeparture(e) {
    const {options} = this.props;
    const filteredOpts = [];

    options.forEach((option) => {
        option.from.forEach((location) =>{
          if(location === e.target.value) filteredOpts.push(option);
        })
      });

    this.setState({options: sortBy(filteredOpts, 'price')});
  }

  _filterDaily(e) {
    const {options} = this.props;
    const filteredOpts = [];

    options.forEach((option) => {
      if(option.daily === Number(e.target.value)) filteredOpts.push(option);
    });

    this.setState({options: sortBy(filteredOpts, 'price')});
  }

  render() {
    const options = this.state.options || [];
    const srcDaily = this._daily(this.props.options);
    const srcDepartures = this._departures(this.props.options);

    return(
      <div className="options">
        <header>
          <p className="section-title">Escolha sua melhor opção</p>
          <form>
            <div className="form-control">
              <label>Saídas: </label>
              <div className="select-wrapper">
                <select onChange={this._filterDeparture.bind(this)}>
                  <option>Escolha</option>
                  {
                    srcDepartures.map((departure, i) =>
                      <option key={i} value={departure}>{departure}</option>
                    )
                  }
                </select>
              </div>
            </div>
            <div className="form-control">
              <label>N. de diárias: </label>
              <div className="select-wrapper">
                <select onChange={this._filterDaily.bind(this)}>
                  <option>Escolha</option>
                  {
                    srcDaily.map((daily, i) =>
                      <option key={i} value={daily}>{daily}</option>
                    )
                  }
                </select>
              </div>
            </div>
          </form>
        </header>
        {
          options.map((option, index) =>
            <div className="option" key={index}>
              <div className="info">
                <div className="wrapper">
                  <h3 className="title">{option.title}</h3>
                  <p>{option.description}</p>
                </div>
              </div>
              <div className="departures">
                <div className="wrapper">
                  <p className="title">Saídas:</p>
                  <ul>
                    {
                      option.from.map((locale, index) =>
                        <li key={index}>{locale}</li>
                      )
                    }
                  </ul>
                </div>
              </div>
              <div className="specs">
                <div className="wrapper">
                  <div className="daily">
                    <p>{option.daily} <i className="icon-calendar-day"></i></p>
                    <p className="small">Diárias</p>
                  </div>
                  <div className="person">
                    <p>1 <i className="icon-user"></i></p>
                    <p className="small">Pessoa</p>
                  </div>
                </div>
              </div>
              <div className="price">
                <div className="wrapper">
                  <Warning k={randomKey(0,2)} />
                  <p>Por apenas:</p>
                  <p className="price-value"><span>R$</span> {Numeral(option.price).format('0,0')}</p>
                  <p className="taxes">+ taxas  em 10x</p>
                  <button className="buy">quero ir</button>
                </div>
              </div>
            </div>
          )
        }
      </div>
    );
  }
}
