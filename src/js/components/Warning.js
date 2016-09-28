import React from 'react'
import randomKey from './../helpers/randomKey'
import warnings from './../helpers/warnings'

export default class Warning extends React.Component {

  render() {

    const {k} = this.props;

    return(
      <p className={`warning ${warnings[k].color}`}>{warnings[k].msg}</p>
    )
  }
}
