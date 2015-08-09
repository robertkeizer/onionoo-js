"use strict";

var assert	= require( "assert" );
var onionojs	= require( "../" );

var _validOptions = { 
	elasticsearch: {
		host: "localhost:9200",
		indexSearch: "onionojs-*",
		insertIndex: "onionojs-YYYY-MMM-DD"
	},
	downloadLocation: "/tmp",
	removeRawDownloads: true
};

describe( "Ensuring options", function( ){

	it( "Gets callback if invalid options defined", function( cb ){

		new onionojs.OnionoJS( { "foo": "bar" }, function( err ){
			if( !err ){
				return cb( "No error was returned" );
			}
			return cb( null );
		} );
	} );

	it( "Can be created with valid options", function( cb ){
		new onionojs.OnionoJS( _validOptions, cb );
	} );
} );

describe( "GrabData", function( ){
	var instance;

	before( function( cb ){
		instance = new onionojs.OnionoJS( _validOptions, cb );
	} );

	after( function( ){
		
	} );

	it( "Fails without a callback", function( ){
		assert.throws( function( ){
			instance.GrabData( );
		} );
	} );

	it( "Works with valid options", function( cb ){
		instance.GrabData( function( err, result ){
			if( err ){ return cb( err ); }
			console.log( "TEST HAS RESULT O F" );
			console.log( result );
			return cb( null );
		} );
	} );

} );
