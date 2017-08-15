const express = require('express');
const Promise = require('bluebird');
const db =  require('sqlite');
const http = require('http-request');

const app = express();
const port = process.env.PORT || 3000;


app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {

  try {

  	// const limit = 10, // || params.limit;
  	// 	offset = 1; // || params.offset;

  	// first get the genre of the film being queried
    db.get('SELECT genre_id FROM films WHERE id = ?', req.params.id)
    .then(function(result){
    	
    	//set the genre id and get the next one
    	if ( !result ) {
    		throw new Error('film document not found');
    	}
    	
    	return db.all('SELECT * FROM films WHERE genre_id = ?', result.genre_id)
    })
    .then(function(allResults){

    	res.json({'result': allResults });


    })
    .catch(function(err){
	    if ( err ){
	    	res.json({'result' : 'there was an error with this request' });
	    } else {
				res.json({'result' : err });
	    }
    });



  } catch (err) {
    if ( err ){
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


