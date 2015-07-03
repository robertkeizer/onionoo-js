"use strict";

var async	= require( "async" );
var request	= require( "request" );
var htmlparser	= require( "htmlparser2" );

var getLinksMatching = function( url, regex, cb ){

	async.waterfall( [ function( cb ){

		request.get( url, function( err, response, body ){
			/* istanbul ignore if */
			if( err ){ return cb( err ); }

			/* istanbul ignore if */
			if( response.statusCode !== 200 ){
				return cb( "Non 200 response code (" + url + ")" );
			}

			return cb( null, body );
		} );

	}, function( body, cb ){

		var links = [ ];
		var parser = new htmlparser.Parser( {
			onopentag: function( tagname, attributes ){
				if( tagname === "a" ){
					if( attributes.href.match( regex ) ){
						links.push( attributes.href );
					}
				}
			},
			onend: function( ){
				return cb( null, links );
			},
			onerror: function( err ){
				return cb( err );
			}
		}, { decodeEntites: true } );

		parser.write( body );
		parser.end( );

	} ], cb );
};

var GrabData = function( cb ){

	/* istanbul ignore else */
	if( !cb ){
		throw new Error( "Callback must be specified." );
	}

	var baseCollectorUrl	= "https://collector.torproject.org/recent/";
	var directoryDetails	= [
		{ path: "relay-descriptors/consensuses/", regex: new RegExp( "consensus$" ) },
		{ path: "relay-descriptors/server-descriptors/", regex: new RegExp( "server-descriptors$" ) },
		{ path: "relay-descriptors/extra-infos/", regex: new RegExp( "extra-infos$" ) },
		{ path: "exit-lists/", regex: new RegExp( "[0-9]{4}(-[0-9]{2}){5}" ) },
		{ path: "bridge-descriptors/server-descriptors/", regex: new RegExp( "server-descriptors$" ) },
		{ path: "bridge-descriptors/extra-infos/", regex: new RegExp( "extra-infos$" ) },
		{ path: "bridge-descriptors/statuses/", regex: new RegExp( "[0-9]{8}-[0-9]{6}-[A-Z0-9]{41}$" ) }
	];
	
	async.waterfall( [ function( cb ){

		async.map( directoryDetails, function( details, cb ){

			getLinksMatching(
				baseCollectorUrl + details.path,
				details.regex,
				cb
			);
		}, function( err, results ){

			if( err ){ return cb( err ); }

			var _return = [ ];
			results.forEach( function( result, i ){
				result.forEach( function( link ){
					_return.push( baseCollectorUrl + directoryDetails[i].path + link );
				} );
			} );

			return cb( null, _return );
		} );

	}, function( links, cb ){

		console.log( "I have links of " );
		console.log( links );
		return cb( null, [ ] );
	} ], cb );
};

exports.GrabData = GrabData;
