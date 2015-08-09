"use strict";

var Joi			= require( "joi" );
var elasticsearch	= require( "elasticsearch" );
var async		= require( "async" );
var request		= require( "request" );
var utils		= require( "./utils" );

function OnionoJS( options, cb ){

	var _defaultOptions = Joi.object( ).keys( {
		elasticsearch: Joi.object( ).keys( {
			host: Joi.string( ).required( ),
			indexSearch: Joi.string( ).required( ),
			insertIndex: Joi.string( ).required( )
		} ).required( )
	} ).required( );

	var self = this;

	async.waterfall( [ function( cb ){
		Joi.validate( options, _defaultOptions, function( err ){
			if( err ){ return cb( err ); }
			return cb( null, options );
		} );
	}, function( options, cb ){

		// We want to expose the options to the rest of the instance
		// so we set it here; That way initializeElasticsearch has
		// access to it.
		self.options = options;

		self.initializeElasticsearch( cb );
	} ], cb );
}

OnionoJS.prototype.initializeElasticsearch = function( cb ){

	var self = this;

	if( this._client ){
		return cb( null, this._client );
	}

	this._client = new elasticsearch.Client( {
		host: self.options.elasticsearch.host
	} );

	// Lets make sure the index exists 

	return cb( null );
};

OnionoJS.prototype.GrabData = function( cb ){
	
	/* istanbul ignore else */
	if( !cb ){
		throw new Error( "Callback must be specified." );
	}

	var baseCollectorUrl	= "https://collector.torproject.org/recent/";
	var directoryDetails	= [
		{ path: "relay-descriptors/consensuses/", regex: new RegExp( "consensus$" ) },
		/*{ path: "relay-descriptors/server-descriptors/", regex: new RegExp( "server-descriptors$" ) },
		{ path: "relay-descriptors/extra-infos/", regex: new RegExp( "extra-infos$" ) },
		{ path: "exit-lists/", regex: new RegExp( "[0-9]{4}(-[0-9]{2}){5}" ) },
		{ path: "bridge-descriptors/server-descriptors/", regex: new RegExp( "server-descriptors$" ) },
		{ path: "bridge-descriptors/extra-infos/", regex: new RegExp( "extra-infos$" ) },
		{ path: "bridge-descriptors/statuses/", regex: new RegExp( "[0-9]{8}-[0-9]{6}-[A-Z0-9]{41}$" ) }*/
	];
	
	var self = this;
	async.mapLimit( directoryDetails, 1, function( details, cb ){
		async.waterfall( [ function( cb ){

			utils.getLinksMatching(
				baseCollectorUrl + details.path,
				details.regex,
				cb
			);

		}, function( links, cb ){
			// Lets filter out what links we've already downloaded.
			async.filter( links, function( link, _cb ){
				var _searchBody = { query: { filtered: { filter: { term: { "link": link } } } } };

				// Lets make a query to see if we have downloaded this link or not.
				self._client.search( {
					index: self.options.elasticsearch.indexSearch,
					type: "download-log",
					body: _searchBody
				}, function( err, result ){
					// Note that we error out to the waterfall callback
					// if we have an error determining if the link has been
					// downloaded already.
					if( err ){ return cb( err ); }

					// If we have a result back, we shouldn't include it in the 
					// results to download.
					if( result.hits.hits.length > 0 ){
						return _cb( false );
					}

					// No matching download-log found; We should download them.
					return _cb( true );
				} );

			}, function( resultsToGet ){
				return cb( null, resultsToGet );
			} );

		}, function( linksToGet, cb ){

			console.log( "I have linksToGet of " );
			console.log( linksToGet );

			async.mapLimit( linksToGet, 10, function( link, cb ){
				
				request.get( link, function( err, response ){ 
					if( err ){ return cb( err ); }

					if( response.statusCode !== 200 ){
						return cb( "Non-200 error code: " + response.statusCode );
					}

					// Lets go ahead and store the raw results and a download-log 
					// at this point.
					

					return cb( null, null );
				} );


			}, function( err, results ){

				if( err ){ return cb( err ); }
				
				return cb( null, results );
			} );
		} ], cb );
	}, function( err, result ){
		if( err ){
			return cb( err );
		}

		console.log( "I have results of " );
		console.log( result );

		return cb( null );
	} );
	
};

exports.OnionoJS = OnionoJS;
