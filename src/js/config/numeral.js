import numeral from 'numeral';

numeral.language('pt-br', {
  currency: {
    symbol: 'R$'
  },  
  delimiters: {
    thousands: '.',
    decimal: ','
  }
});

numeral.language('pt-br');

export {numeral};
