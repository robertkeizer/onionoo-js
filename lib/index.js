"use strict";

var path	= require( "path" );
var fs		= require( "fs" );

var Joi			= require( "joi" );
var elasticsearch	= require( "elasticsearch" );
var async		= require( "async" );
var request		= require( "request" );
var uuid		= require( "uuid" );
var utils		= require( "./utils" );

function OnionoJS( options, cb ){

	var _requiredOptions = Joi.object( ).keys( {
		elasticsearch: Joi.object( ).keys( {
			host: Joi.string( ).required( ),
			indexSearch: Joi.string( ).required( ),
			insertIndex: Joi.string( ).required( )
		} ).required( ),
		downloadLocation: Joi.string( ).required( ),
		removeRawDownloads: Joi.boolean( ).required( )
	} ).required( );

	var self = this;

	async.waterfall( [ function( cb ){
		Joi.validate( options, _requiredOptions, function( err ){
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

			async.mapLimit( linksToGet, 10, function( link, cb ){

				var _pathForFile = path.join( self.options.downloadLocation, "oniono-download-" + uuid.v4() );
				
				request.get( link )
					.on( "error", cb )
					.on( "response", function( response ){
						if( response.statusCode !== 200 ){
							return cb( "Non-200 error code: " + response.statusCode );
						}
					} )
					.pipe( fs.createWriteStream( _pathForFile ) )
					.on( "close", function( ){
						console.log( "DONE FOR URL " + link );
						return cb( null, { link: link, path: _pathForFile } );
					} );

			}, function( err, results ){

				if( err ){ return cb( err ); }
				
				return cb( null, results );
			} );

		}, function( pathsAndLinks, cb ){

			async.eachLimit( pathsAndLinks, 10, function( pathAndLink, cb ){

				async.waterfall( [ function( cb ){

					// lets first go ahead and handle the file
					self.addDataFromFileToDatabase( pathAndLink.path, cb );

				}, function( cb ){
					
					// Lets go ahead and create the download log
					return cb( null );

				}, function( cb ){

					// Lets go ahead and remove the file if appropriate ( see config ).
					fs.unlink( pathAndLink.path, cb );

				} ], cb );

			}, function( err ){

				if( err ){ return cb( err ); }

				return cb( null );
			} );

		} ], function( err, result ){		// This is the end of mapLimit on the matching URLs.
			if( err ){ return cb( err ); }	// because we don't want to shove back an array, we
			return cb( null );		// simply return null if successful.
		} );
	}, cb );
};

OnionoJS.prototype.addDataFromFileToDatabase = function( filePath, cb ){
	console.log( "addDataFromFileToDatabase " + filePath );
	return cb( null );
};

exports.OnionoJS = OnionoJS;
