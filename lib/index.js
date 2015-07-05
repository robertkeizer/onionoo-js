"use strict";

//var elasticsearch	= require( "elasticsearch" );
var async		= require( "async" );
var request		= require( "request" );
var utils		= require( "./utils" );

function OnionoJS( options ){
	this.options = options;
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
	
	async.mapLimit( directoryDetails, 1, function( details, cb ){
		async.waterfall( [ function( cb ){

			utils.getLinksMatching(
				baseCollectorUrl + details.path,
				details.regex,
				cb
			);

		}, function( links, cb ){
	
			// Lets filter out the links that we've already downloaded and
			// have in the database.
			return cb( null, links );
					

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
