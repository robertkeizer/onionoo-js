"use strict";

var request	= require( "request" );
var async	= require( "async" );

var htmlparser	= require( "htmlparser2" );
var url		= require( "url" );

// Lets find all the links matching a given regex on a page
exports.getLinksMatching = function( _url, regex, cb ){
	async.waterfall( [ function( cb ){

		// Lets get the page contents; We force a GET request with a 
		// simple 200 response.
		request.get( _url, function( err, response, body ){

			/* istanbul ignore if */
			if( err ){ return cb( err ); }

			/* istanbul ignore if */
			if( response.statusCode !== 200 ){
				return cb( "Non 200 response code (" + _url + ")" );
			}

			return cb( null, body );
		} );

	}, function( body, cb ){
		var links	= [ ];
		var parser	= new htmlparser.Parser( {
			onopentag: function( tagname, attributes ){

				if( tagname === "a" && attributes.href.match( regex ) ){
					links.push( url.resolve( _url, attributes.href ) );
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
