const express = require('express');
const Promise = require('bluebird');
const db =  require('sqlite');
const http = require('request-promise');
const moment = require('moment');
const _ = require('lodash');

const app = express();
const port = process.env.PORT || 3000;

var allFilmResults = [];


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

    	if ( !allResults || !allResults.length && allResults.length > 0) {
	    	res.json({'all results': "no recommendations found" });
    	}

    	allFilmResults = allResults;

    	var reviewQuery = "http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=";

    	_.forEach(allResults, function( singleResult ) {
    		reviewQuery = reviewQuery + singleResult.id + ","
    	});

    	console.log("query string is " + reviewQuery);

			var options = {
			    uri: reviewQuery,
			    headers: {
			        'User-Agent': 'Request-Promise'
			    },
			    json: true // Automatically parses the JSON string in the response 
			};    	

    	return http.get(options)
    })
    .then(function(results){

				var reviewResults = results;
				
				//filter out the movies with less than 5 reviews
				reviewResults = _.filter(reviewResults, function(oneFilm) { return oneFilm.reviews.length >= 5; } );

				//of the films that are left, filter out the ones that dont have an average rating of at least 4
				reviewResults = _.filter(reviewResults, function(oneFilm) {

					var ratings_total = 0;
					_.forEach(oneFilm.reviews, function(oneReview, index){
						ratings_total = ratings_total + oneReview.rating;
					});

					const average_rating = ratings_total / oneFilm.reviews.length;

					if (average_rating < 4 ){
						console.log("getting rid of film " + oneFilm.film_id + " which has an average of " + average_rating);
					}
					return average_rating >= 4.0;

				});

				//by this point, reviewResults only contains the reviews that meet the minimum requirements, so we just need to find the correct films in the list of film objects to return to the requester
				const film_ids = _.map(reviewResults, function(reviewList) { return reviewList.film_id; } );
				allFilmResults = _.filter(allFilmResults, function(film) {
					return film_ids.indexOf(film.id) > -1;
				});

				//finally, sort the results by id
				allFilmResults = _.sortBy(allFilmResults, 'id');

				return res.json({"results" : allFilmResults });

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




