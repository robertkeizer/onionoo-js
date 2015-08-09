"use strict";

var Joi			= require( "joi" );
//var elasticsearch	= require( "elasticsearch" );
var async		= require( "async" );
var request		= require( "request" );
var utils		= require( "./utils" );

function OnionoJS( options ){

	var _defaultOptions = Joi.object( ).keys( {
		elasticsearch: Joi.object( ).keys( {
			host: Joi.string( ).required( ),
			port: Joi.number( ).integer( ).required( ),
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
		self.initializeElasticsearch( function( err ){
			if( err ){ return cb( err ); }
			return cb( null, options );
		} );
	} ], function( err, options ){
		if( err ){ throw new Error( err ); }

		self.options = options;
	} );
}

OnionoJS.prototype.initializeElasticsearch = function( cb ){

	var self = this;

	if( this._client ){
		return cb( null, this._client );
	}

	this._client = new elasticsearch.Client( {
		host: self.options.elasticsaerch.host
	} );

	// Lets make sure the index exists 

	return cb( null, this._client );
}

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

			// Because we're going to be using msearch instead of wrapping search
			// on the client side we want an array of search bodies that will look for
			// that specific link. This allows us to have the database do the matching and lookup
			// of if the link exists already or not, rather than us matching.
			var _searchBody = [ ];

			links.forEach( function( _link ){
				_searchBody.push( { query: { filtered: { filter: { term: { "link", _link } } } } } );
			} );
	
			// Go and run the search.
			self._client.msearch( {
				index: self.options.elasticsearch.indexSearch,
				type: "download-log",
				body: _searchBody
			}, function( err, result ){
				if( err ){ return cb( err ); }
			
				// result is an array with the results of a .search with a term filter in the order of links.
				

				return cb( null, links );
			} );
					

		}, function( linksToGet, cb ){

			async.mapLimit( linksToGet, 10, function( link, cb ){
				
				request.get( link, function( err, response ){ //, body ){
					if( err ){ return cb( err ); }

					if( response.statusCode !== 200 ){
						return cb( "Non-200 error code: " + response.statusCode );
					}

					// Lets go ahead and store the raw results so that we can
					// process them at a later point.
					

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
