var express = require('express');
var offers = require('./src/data/offers');

var app = express();

app.set('views', './frontend');
app.set('view engine', 'jade');

app.use(express.static('assets'));

app.get('/api/offers', function(req, res) {
	res.json(offers);
});

app.get('/api/offer/:id', function(req, res) {
	const {params} = req;
	const offer = require('./src/data/offer' + params.id);

	res.json(offer);
});

app.get('*', (req, res) => {
  res.render('index', {
    title: 'Desafio HU',
    message: 'Hello World!'
  });
});

app.listen(3000, function() {
	console.log('listening port 3000!');
});
