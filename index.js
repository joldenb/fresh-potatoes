const express = require('express');
const Promise = require('bluebird');
const db =  require('sqlite');
const http = require('http-request');
const moment = require('moment');

const app = express();
const port = process.env.PORT || 3000;


app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {

  try {

  	// const limit = 10, // || params.limit;
  	// 	offset = 1; // || params.offset;

  	// first get the genre of the film being queried
    db.get('SELECT genre_id, release_date FROM films WHERE id = ?', req.params.id)
    .then(function(result){
    	
    	//set the genre id and get the next one
    	if ( !result || !result.genre_id || !result.release_date) {
    		throw new Error('film document not found');
    	}

    	console.log("the release date is" + moment(result.release_date).format("YYYY-MM-DD") );

    	const release_date_ceiling = moment(result.release_date).add(15, 'y').format("YYYY-MM-DD");
    	const release_date_floor = moment(result.release_date).subtract(15, 'y').format("YYYY-MM-DD");

    	return db.all('SELECT * FROM films WHERE genre_id = ? AND release_date <= ? AND release_date >= ?', result.genre_id, release_date_ceiling, release_date_floor)
    })
    .then(function(allResults){

    	res.json({'all results': allResults });

    })
    .catch(function(err){
	    if ( !err ){
	    	res.json({'result' : 'there was an error with this request' });
	    } else {
				res.json({'result' : err });
	    }
    });
  } catch (err) {
    if ( !err ){
    	res.json({'result' : 'there was an error with this request' });
    } else {
			res.json({'result' : err });
    }
  }

}
 
 
Promise.resolve()
  // First, try connect to the database 
  .then(() => db.open('./db/database.db', { Promise }))
  .catch(err => console.error(err.stack))
  // Finally, launch Node.js app 
  .finally(() => app.listen(port));


