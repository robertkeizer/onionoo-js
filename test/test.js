"use strict";

var assert	= require( "assert" );
var onionojs	= require( "../" );

describe( "GrabData", function( ){
	var instance;

	before( function( ){
		instance = new onionojs.OnionoJS( );
	} );

	after( function( ){
		
	} );

	it( "Fails without a callback", function( ){
		assert.throws( function( ){
			instance.GrabData( );
		} );
	} );

} );
