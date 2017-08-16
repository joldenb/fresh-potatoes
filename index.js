const express = require('express');
const Promise = require('bluebird');
const db =  require('sqlite');
const http = require('request-promise');
const moment = require('moment');
const _ = require('lodash');

const app = express();
const port = process.env.PORT || 3000;



app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {

  try {
		var allFilmResults = [];
		var genre_name = "", genre_id;
		var film_release_date = "";
		var finalRecommendations = {
			"recommendations" : [],
			"meta" : {}
		};

  	const limit = 10, // || params.limit;
  		offset = 0; // || params.offset;

  		finalRecommendations["meta"]["limit"] = limit;
  		finalRecommendations["meta"]["offset"] = offset;

  	// first get the genre of the film being queried
    db.get('SELECT genre_id, release_date FROM films WHERE id = ?', req.params.id)
    .then(function(result){
    	
    	//set the genre id and get the next one
    	if ( !result || !result.genre_id || !result.release_date) {
    		throw new Error('film document not found');
    	}

    	genre_id = result.genre_id;

    	film_release_date = result.release_date;

    	return db.get('SELECT name FROM genres WHERE id = ?', result.genre_id);
    })
    .then(function(result){

    	genre_name = result.name;

    	const release_date_ceiling = moment(film_release_date).add(15, 'y').format("YYYY-MM-DD");
    	const release_date_floor = moment(film_release_date).subtract(15, 'y').format("YYYY-MM-DD");

    	return db.all('SELECT * FROM films WHERE genre_id = ? AND release_date <= ? AND release_date >= ?', genre_id, release_date_ceiling, release_date_floor)
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
				_.forEach(reviewResults, function(oneFilm) {

					var ratings_total = 0;
					_.forEach(oneFilm.reviews, function(oneReview, index){
						ratings_total = ratings_total + oneReview.rating;
					});

					const average_rating = Math.round( ( ratings_total / oneFilm.reviews.length) * 100 ) / 100;
					
					//if the average rating is above 4.0, add it to the list of final recommendations
					if ( average_rating >= 4.0 ){

						var film_name = "", release_date = "";
						_.forEach(allFilmResults, function(film) {
							if ( film.id == oneFilm.film_id ){
								film_name = film.title;
								release_date = film.release_date;
							}
						})

						var new_film_recommendation = {};
						new_film_recommendation["id"] = oneFilm.film_id;
						new_film_recommendation["title"] = film_name;
						new_film_recommendation["releaseDate"] = release_date;
						new_film_recommendation["genre"] = genre_name;
						new_film_recommendation["averageRating"] = average_rating;
						new_film_recommendation["reviews"] = oneFilm.reviews.length;
						finalRecommendations["recommendations"].push(new_film_recommendation);
					}

				});


				//finally, sort the results by id

				return res.json(finalRecommendations);

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


module.exports = app;

