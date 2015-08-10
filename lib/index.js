"use strict";

var path	= require( "path" );
var fs		= require( "fs" );

var Joi			= require( "joi" );
var elasticsearch	= require( "elasticsearch" );
var async		= require( "async" );
var request		= require( "request" );
var uuid		= require( "uuid" );
var utils		= require( "./utils" );
var byline		= require( "byline" );

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
	} ], function( err ){
		if( err ){
			return cb( err );
		}

		return cb( null );
	} );
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

OnionoJS.prototype.GrabLinks = function( cb ){

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
	
	async.mapLimit( directoryDetails, 1, function( details, cb ){
		utils.getLinksMatching(
			baseCollectorUrl + details.path,
			details.regex,
			cb
		);
	}, function( err, result ){
		if( err ){
			return cb( err ); 
		}

		// We want to return a single array rather than multiples; So we
		// use this to reduce the array back down.
		var _return = [ ];
		result.forEach( function( partialResult ){
			partialResult.forEach( function( individualResult ){
				_return.push( individualResult );
			} );
		} );

		return cb( null, _return );
	} );

};

// This function takes in an array of links and returns an array of links.
// Any links that are returned were not found in the database.
OnionoJS.prototype.FilterLinks = function( links, cb ){

	var self = this;

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
};

OnionoJS.prototype.DownloadAndInjectLinks = function( links, cb ){

	var self = this;

	async.eachLimit( links, 10, function( link, cb ){

		async.waterfall( [ function( cb ){

			var _pathForFile = path.join(
						self.options.downloadLocation,
						"oniono-download-" + uuid.v4()
					);
			
			request.get( link )
				.on( "error", cb )
				.on( "response", function( response ){
					if( response.statusCode !== 200 ){
						return cb( "Non-200 error code: " + response.statusCode );
					}
				} )
				.pipe( fs.createWriteStream( _pathForFile ) )
				.on( "close", function( ){
					return cb( null, { link: link, path: _pathForFile } );
				} );

		}, function( details, cb ){

			// lets first go ahead and handle the file
			self.addDataFromFileToDatabase( details.path, function( err ){
				if( err ){ return cb( err ); }
				return cb( null, details );
			} );

		}, function( details, cb ){
			
			// Lets go ahead and create the download log
			return cb( null, details );

		}, function( details, cb ){

			if( self.options.removeRawDownloads ){

				// Lets go ahead and remove the file if appropriate
				fs.unlink( details.path, cb );
				return;
			}

			return cb( null );

		} ], cb );

	}, cb );
};

// This function takes a raw file and handles streaming it line by line and injecting it 
// into the database.
OnionoJS.prototype.addDataFromFileToDatabase = function( filePath, cb ){

	var self = this;

	// We want to be able to store the header information
	// somewhere, so we do it in this object.
	var _state = { };

	// Lets define a queue so that we can insert many documents into the 
	// database without going insane with requests.

	// It expects to have items pushed to it that are in the form of 
	// { type: "some-type-for-es", body: { "the actual": "raw", "json": "object" } }
	var insertQueue = async.queue( function( detailsToInsert, cb ){
		
		// Lets insert the object into the database.
		self._client.index( {
			index: self.options.elasticsearch.insertIndex,
			type: detailsToInsert.type,
			body: detailsToInsert.body
		}, function( err, response ){
			// If we couldn't insert to the database, lets
			// error out of the entire function.
			if( err ){ return cb( err ); }

			return cb( null );
		} );

	}, 1 );

	// This function is called every time there is a line
	// that we read from the raw file. It provides a single place
	// to keep and modify the _state object, which we will then 
	// use in injecting items.
	var parseLine = function( line ){
		if( _state['header_complete'] ){
			parseDataLine( line );
		}else{
			parseHeaderLine( line );
		}
	};

	var parseDataLine = function( line ){
		
	};

	var parseHeaderLine = function( line ){
		// We check to see if this is the first data line;
		// If it is we should set header_complete to true in the state
		// and call parseDataLine instead.
		if( line[0] == "r" && line[1] == " " ){

			// We're done with the header; Lets push that into the queue. 

			_state['header_complete'] = true;
			return parseDataLine( line );
		}

		// Lets make sure the header is of a known type; This
		// can be done by matching the first string to one of the following.

		/*
		@type
		network-status-version
		vote-status
		consensus-method
		valid-after
		fresh-until
		valid-until
		voting-delay
		client-versions
		server-versions
		known-flags
		params
		
		dir-source
		contact
		vote-digest
		*/

	};

	// We want to use a stream based parser rather than load up everything
	// into memory and use splits on newlines..
	var lineStream = byline( fs.createReadStream( filePath, { 'encoding': 'utf8' } ) );

	lineStream.on( "data", function( line ){ parseLine( line ); } );
	lineStream.on( "error", cb );

	lineStream.on( "end", function( ){

		// Lets make sure that all the database transactions are done
		// for this file before calling the callback.
		
		//console.log( "addDataFromFileToDatabase " + filePath );
		return cb( null );

	} );
};

OnionoJS.prototype.UpdateDatabase = function( cb ){
	var self = this;

	async.waterfall( [ function( cb ){
		self.GrabLinks( cb );
	}, function( links, cb ){
		self.FilterLinks( links, cb );
	}, function( links, cb ){
		self.DownloadAndInjectLinks( links, cb );
	} ], cb );
};

exports.OnionoJS = OnionoJS;
