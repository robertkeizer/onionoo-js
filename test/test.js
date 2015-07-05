"use strict";

var util	= require( "util" );
//var assert	= require( "assert" );
var onionojs	= require( "../" );

describe( "GrabData", function( ){
	var instance;

	before( function( ){
		instance = new onionojs.OnionoJS( );
	} );

	after( function( ){
		
	} );

	it( "Fails without a callback", function( ){

		console.log( "I have instance of ");
		console.log( util.inspect( instance, 9, true ) );

		console.log( instance.GrabData );

	} );
} );
