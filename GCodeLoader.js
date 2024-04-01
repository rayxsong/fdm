(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
	typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.GCodeLoader = {}, global.three));
})(this, (function (exports, three) { 'use strict';

	/**
	 * GCodeLoader is used to load gcode files usually used for 3D printing or CNC applications.
	 *
	 * Gcode files are composed by commands used by machines to create objects.
	 *
	 * @class GCodeLoader
	 * @param {Manager} manager Loading manager.
	 */

	class GCodeLoader extends three.Loader {

		constructor( manager ) {

			super( manager );

			this.splitLayer = true;
			this.debug = true;
			this.ifPath = false;
			this.ifExtrude = true;
			this.ifWall = true;

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;

			const loader = new three.FileLoader( scope.manager );
			loader.setPath( scope.path );
			loader.setRequestHeader( scope.requestHeader );
			loader.setWithCredentials( scope.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		parse( data ) {

			let state = { x: 0, y: 0, z: 0, e: 0, f: 0, extruding: false, relative: false };
			const layers = [];

			let currentLayer = undefined;

			const pathMaterial = new three.LineBasicMaterial( { color: 0xFF0000 } );
			pathMaterial.name = 'path';

			const extrudingMaterial = new three.LineBasicMaterial( { color: 0x666666 } );
			extrudingMaterial.name = 'extruded';

			function newLayer( line ) {

				currentLayer = { vertex: [], pathVertex: [], z: line.z };
				layers.push( currentLayer );

			}

			//Create line segment between p1 and p2
			function addSegment( p1, p2 ) {

				if ( currentLayer === undefined ) {

					newLayer( p1 );

				}

				if ( state.extruding ) {

					currentLayer.vertex.push( p1.x, p1.y, p1.z );
					currentLayer.vertex.push( p2.x, p2.y, p2.z );

				} else {
					
					currentLayer.pathVertex.push( p1.x, p1.y, p1.z );
					currentLayer.pathVertex.push( p2.x, p2.y, p2.z );

				}

			}

			function delta( v1, v2 ) {

				return state.relative ? v2 : v2 - v1;

			}

			function absolute( v1, v2 ) {

				return state.relative ? v1 + v2 : v2;

			}

			const lines = data.replace( /;.+/g, '' ).split( '\n' );

			for ( let i = 0; i < lines.length; i ++ ) {

				const tokens = lines[ i ].split( ' ' );
				const cmd = tokens[ 0 ].toUpperCase();

				//Argumments
				const args = {};
				tokens.splice( 1 ).forEach( function ( token ) {

					if ( token[ 0 ] !== undefined ) {

						const key = token[ 0 ].toLowerCase();
						const value = parseFloat( token.substring( 1 ) );
						args[ key ] = value;

					}

				} );

				//Process commands
				//G0/G1 – Linear Movement
				if ( cmd === 'G0' || cmd === 'G1' ) {

					const line = {
						x: args.x !== undefined ? absolute( state.x, args.x ) : state.x,
						y: args.y !== undefined ? absolute( state.y, args.y ) : state.y,
						z: args.z !== undefined ? absolute( state.z, args.z ) : state.z,
						e: args.e !== undefined ? absolute( state.e, args.e ) : state.e,
						f: args.f !== undefined ? absolute( state.f, args.f ) : state.f,
					};

					//Layer change detection is or made by watching Z, it's made by watching when we extrude at a new Z position
					if ( delta( state.e, line.e ) > 0 ) {
						state.extruding = delta( state.e, line.e ) > 0;

						if ( currentLayer == undefined || line.z != currentLayer.z ) {
							newLayer( line );
							// print current layer number
							// layer_count += 1;
							// console.log( 'Layer:' + layer_count);

						}

					}

					addSegment( state, line );
					state = line;

				} else if ( cmd === 'G2' || cmd === 'G3' ) ; else if ( cmd === 'G90' ) {

					//G90: Set to Absolute Positioning
					state.relative = false;

				} else if ( cmd === 'G91' ) {

					//G91: Set to state.relative Positioning
					state.relative = true;

				} else if ( cmd === 'G92' ) {

					//G92: Set Position
					const line = state;
					line.x = args.x !== undefined ? args.x : line.x;
					line.y = args.y !== undefined ? args.y : line.y;
					line.z = args.z !== undefined ? args.z : line.z;
					line.e = args.e !== undefined ? args.e : line.e;

				} else ;

			}

			function addObject( vertex, extruding, i ) {

				const geometry = new three.BufferGeometry();
				geometry.setAttribute( 'position', new three.Float32BufferAttribute( vertex, 3 ) );
				const segments = new three.LineSegments( geometry, extruding ? extrudingMaterial : pathMaterial );
				segments.name = 'layer' + i;
				// print layer number
				// console.log( 'layer' + i );
				segments.userData.layerNumber = i;
				object.add( segments );
			}

			const object = new three.Group();
			object.name = 'gcode';

			if ( this.splitLayer ) {

				for ( let i = 0; i < layers.length; i ++ ) {
					if ( !this.ifPath ) {
						const layer = layers[ i ];
						addObject( layer.vertex, true, i );
						console.log( 'layer' + i );
					} else {
						const layer = layers[ i ];
						addObject( layer.vertex, true, i );
						addObject( layer.pathVertex, false, i );
						console.log( 'layer' + i );
					}
				}

			} else {

				const vertex = [],
					pathVertex = [];

				for ( let i = 0; i < layers.length; i ++ ) {

					const layer = layers[ i ];
					const layerVertex = layer.vertex;
					const layerPathVertex = layer.pathVertex;

					for ( let j = 0; j < layerVertex.length; j ++ ) {

						vertex.push( layerVertex[ j ] );

					}

					for ( let j = 0; j < layerPathVertex.length; j ++ ) {

						pathVertex.push( layerPathVertex[ j ] );

					}

				}

				addObject( vertex, true, layers.length );
				addObject( pathVertex, false, layers.length );

			}

			object.rotation.set( - Math.PI / 2, 0, 0 );

			return object;

		}

	}

	exports.GCodeLoader = GCodeLoader;

}));
