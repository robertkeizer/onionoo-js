"use strict";

var assert	= require( "assert" );
var onionojs	= require( "../" );

var _validOptions = { 
	elasticsearch: {
		host: "localhost",
		port: 9200,
		indexSearch: "onionojs-*",
		insertIndex: "onionojs-YYYY-MMM-DD"
	}
};

describe( "Ensuring options", function( ){

	it( "Throws an error if undefined is passed in", function( ){
		assert.throws( function( ){
			new onionojs.OnionoJS( );
		} );
	} );

	it( "Fails with invalid options", function( ){

		assert.throws( function( ){
			new onionojs.OnionoJS( { "foo": "bar" } );
		} );
	} );

	it( "Can be created with valid options", function( ){
		new onionojs.OnionoJS( _validOptions );
	} );

} );

/*
describe( "GrabData", function( ){
	var instance;

	before( function( ){
		instance = new onionojs.OnionoJS( { "foo": "bar" );
	} );

	after( function( ){
		
	} );

	it( "Fails without a callback", function( ){
		assert.throws( function( ){
			instance.GrabData( );
		} );
	} );

} );
*/
