// rollup.config.js
export default {
    input: 'examples/jsm/loaders/GCodeLoader.js', // Path to your entry file
    output: {
      file: 'dist/GCodeLoader.js', // Path to the output file
      format: 'umd' // Output format (iife for browsers, cjs for Node, etc.)
    }
  };
  