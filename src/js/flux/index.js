import McFly from 'mcfly';

const Flux = new McFly();

// SET ACTIONS
const OffersActions = Flux.createActions(
  {
    list: () => new Promise(function(resolve, reject) {
      $.get(`${hU.baseURL}api/offers`)
        .done((data) => resolve(data))
        .fail((jqxhr, textStatus, error) => console.log(error));
      })
      .then((result) => ({
        data: result,
        actionType: "OFFERS"
    })),

    get: (id) => new Promise(function(resolve, reject) {
      $.get(`${hU.baseURL}api/offer/${id}`)
       .done((data) => resolve(data))
       .fail((jqxhr, textStatus, error) => console.log(error));
      })
    .then((result) => ({
      data: result,
      actionType: "OFFER"
    }))
  }
);

// SET STORES
const OffersStore = Flux.createStore(
  {
    setOffers: function(data) {
      this.offers = data;
    },

    getOffers: function() {
      return this.offers;
    },

    setOffer: function(data) {
      this.offer = data;      
    },

    getOffer: function() {
      return this.offer;
    }
  },

  function(payload){
    switch(payload.actionType) {
      case 'OFFERS':
        OffersStore.setOffers(payload.data);
        break;

      case 'OFFER':
        OffersStore.setOffer(payload.data);
        break;

      default:
        return false;
    }

    return true;
  }
);

// HELPER
const aliases = {
  actions: {
    offers: OffersActions
  },

  store: {
    offers: OffersStore
  }
}

module.exports = aliases;
