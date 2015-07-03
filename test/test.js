"use strict";

var assert	= require( "assert" );
var onionojs	= require( "../" );

describe( "GrabData", function( ){
	it( "Fails without a callback", function( ){
		assert.throws( function( ){
			onionojs.GrabData( );
		} );
	} );

	it( "Returns valid objects", function( cb ){
		onionojs.GrabData( function( err, results ){
			if( err ){ return cb( err ); }

			console.log( results );

			return cb( null );
		} );
	} );
} );
