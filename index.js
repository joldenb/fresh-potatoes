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
			let allFilmResults = [];
			let genreName = "", genreId;
			let filmReleaseDate = "";
			let finalRecommendations = {
				"recommendations" : [],
				"meta" : {}
			};

		//check if the parameters are valid
		if ((req.query.limit && !Number.isInteger(parseInt(req.query.limit))) || 
			 (req.query.offset && !Number.isInteger(parseInt(req.query.offset))) ||
			 (!req.params.id || (req.params.id && !Number.isInteger(parseInt(req.params.id))))){
			return res.status(422).json({"message" : "Return an explicit error here"});
		}

		const limit = req.query.limit || 10,
			offset = req.query.offset || 0;

		finalRecommendations["meta"]["limit"] = limit;
		finalRecommendations["meta"]["offset"] = offset;

		// first get the genre of the film being queried
		db.get('SELECT genre_id, release_date FROM films WHERE id = ?', req.params.id)
		.then( result => {
			
			//set the genre id and get the next one
			if (!result || !result.genre_id || !result.release_date) {
				throw new Error('film document not found');
			}

			genreId = result.genre_id;
			filmReleaseDate = result.release_date;

			//get the name of the genre
			return db.get('SELECT name FROM genres WHERE id = ?', result.genre_id);
		})
		.then( result => {

			if (!result.name) {
				throw new Error('no genre name');
			}

			// proceed to get all the films from the same genre within the date range
			genreName = result.name;

			const release_date_ceiling = moment(filmReleaseDate).add(15, 'y').format("YYYY-MM-DD");
			const release_date_floor = moment(filmReleaseDate).subtract(15, 'y').format("YYYY-MM-DD");

			return db.all('SELECT * FROM films WHERE genre_id = ? AND release_date <= ? AND release_date >= ?', genreId, release_date_ceiling, release_date_floor)
		})
		.then( allResults => {

			if (!allResults || !allResults.length && allResults.length > 0) {
				throw new Error('no valid reviews');
			}

			// get all the reviews for the films within range
			allFilmResults = allResults;
			let reviewQuery = "http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=";

			_.forEach(allResults, function( singleResult ) {
				reviewQuery = reviewQuery + singleResult.id + ","
			});

			let options = {
				uri: reviewQuery,
				headers: {
						'User-Agent': 'Request-Promise'
				},
				json: true
			};    	

			return http.get(options)
		})
		.then( results => {

				let reviewResults = results;
				
				//filter out the movies with less than 5 reviews
				reviewResults = _.filter(reviewResults, oneFilm => { return oneFilm.reviews.length >= 5;});

				//of the films that are left, filter out the ones that dont have an average rating of at least 4
				_.forEach(reviewResults, oneFilm => {

					let ratingsTotal = 0;
					_.forEach(oneFilm.reviews, function(oneReview, index){
						ratingsTotal = ratingsTotal + oneReview.rating;
					});

					const average_rating = Math.round( ( ratingsTotal / oneFilm.reviews.length) * 100 ) / 100;
					
					//if the average rating is above 4.0, add it to the list of final recommendations
					if ( average_rating >= 4.0 ){

						let filmName = "", releaseDate = "";
						_.forEach(allFilmResults, film => {
							if ( film.id == oneFilm.film_id ){
								filmName = film.title;
								releaseDate = film.release_date;
							}
						})

						let new_film_recommendation = {};
						new_film_recommendation["id"] = oneFilm.film_id;
						new_film_recommendation["title"] = filmName;
						new_film_recommendation["releaseDate"] = releaseDate;
						new_film_recommendation["genre"] = genreName;
						new_film_recommendation["averageRating"] = average_rating;
						new_film_recommendation["reviews"] = oneFilm.reviews.length;
						finalRecommendations["recommendations"].push(new_film_recommendation);
					}

				});


				//finally, sort by id, limit, and offset the results as needed
				let recommendationArray = finalRecommendations["recommendations"];
				recommendationArray = _.sortBy(recommendationArray, 'id');
				recommendationArray = recommendationArray.slice(offset, offset + limit);
				finalRecommendations["recommendations"] = recommendationArray;

				//return the formatted list of recommendations
				return res.json(finalRecommendations);

		})
		.catch( err => {
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

app.get('*', (req, res) => {
	return res.status(404).json( { "message" : "Return an explicit error here" } )
});
	

Promise.resolve()
	// First, try connect to the database 
	.then(() => db.open('./db/database.db', { Promise }))
	.catch(err => console.error(err.stack))
	// Finally, launch Node.js app 
	.finally(() => app.listen(port));


module.exports = app;